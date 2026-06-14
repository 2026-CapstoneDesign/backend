const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");
const auth = require("../middleware/auth");
const Store = require("../models/Store");
const StoreMember = require("../models/StoreMember");


// 알림 생성 (사장님용)
router.post("/", auth, async (req, res) => {
  const alert = await Alert.create({
    ...req.body,
    userId: req.user.id
  });
  res.json(alert);
});

// 공지 브로드캐스트 - 사장님 + 모든 직원에게 알림
router.post("/broadcast", auth, async (req, res) => {
  try {
    const { title, message } = req.body;
    const store = await Store.findOne({ ownerId: req.user.id, isDeleted: false });
    const members = store ? await StoreMember.find({ storeId: store._id, role: "EMPLOYEE" }) : [];
    const employeeIds = members.map((m) => m.userId);

    const recipients = [req.user.id, ...employeeIds];
    await Alert.insertMany(recipients.map((userId) => ({ userId, title, message, type: "NOTICE", isRead: false })));

    res.json({ success: true, sentTo: recipients.length });
  } catch (err) {
    res.status(500).json({ message: "알림 전송 실패", error: err.message });
  }
});

// 알림 목록 조회
router.get("/", auth, async (req, res) => {
  try {
    const alerts = await Alert.find({
      userId: req.user.id
    }).sort({ createdAt: -1 });

    res.json(alerts);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "서버 오류"
    });
  }
});

// 읽음 처리
router.patch("/:id/read", auth, async (req, res) => {
  try {

    const alert = await Alert.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id
      },
      {
        isRead: true
      },
      {
        new: true
      }
    );

    if (!alert) {
      return res.status(404).json({
        message: "알림을 찾을 수 없습니다."
      });
    }

    res.json(alert);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "서버 오류"
    });
  }
});

// 전체 읽음
router.patch("/read-all", auth, async (req, res) => {
  await Alert.updateMany(
    { userId: req.user.id },
    { isRead: true }
  );
  res.json({ message: "all read" });
});

// 삭제
router.delete("/:id", auth, async (req, res) => {
  try {

    const alert = await Alert.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!alert) {
      return res.status(404).json({
        message: "알림을 찾을 수 없습니다."
      });
    }

    res.json({
      message: "삭제 완료"
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "서버 오류"
    });
  }
});

// 뱃지 카운트 (읽지 않은 알림 개수)
router.get("/unread-count", auth, async (req, res) => {
  try {

    const count = await Alert.countDocuments({
      userId: req.user.id,
      isRead: false
    });

    res.json({
      unreadCount: count
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "서버 오류"
    });
  }
});

// ---------- 퀴즈 제출 시 자동 알림 ----------
async function handleQuizResult(userId, quizId, score, wrongAnswers) {

  const wrongCount = wrongAnswers.length;

  // 많이 틀림 → 복습 알림
  if (wrongCount >= 3) {
    await Alert.create({
      userId,
      type: "QUIZ_RETRY",
      title: "복습 필요",
      message: "틀린 문제가 많습니다. 다시 학습해보세요.",
      relatedId: quizId
    });
  }

  // 점수 낮음 → 취약 영역 알림
  if (score < 50) {
    await Alert.create({
      userId,
      type: "WEAK_PART",
      title: "취약 영역 발견",
      message: "특정 개념에서 반복적인 실수가 발생하고 있습니다.",
      relatedId: quizId
    });
  }

  // 특정 개념 반복 틀림
  const topicCount = {};

  wrongAnswers.forEach(q => {
    const topic = q.topic;
    topicCount[topic] = (topicCount[topic] || 0) + 1;
  });

  for (const topic in topicCount) {
    if (topicCount[topic] >= 2) {
      await Alert.create({
        userId,
        type: "WEAK_PART",
        title: "취약 개념 집중 필요",
        message: `${topic} 관련 문제를 반복해서 틀리고 있습니다.`,
        weakTopic: topic,
        relatedId: quizId
      });
    }
  }

  // 시간 기반
  const timeZone = getCurrentTimeZone();

  if (timeZone === "야간") {
    await Alert.create({
      userId,
      type: "TIME_BASED",
      title: "야간 근무 주의",
      message: "야간에는 계산 실수가 자주 발생합니다. 확인을 철저히 해주세요.",
      triggerTime: "야간"
    });
  }

  // 시즌 기반
  const season = getSeason();

  if (season === "여름") {
    await Alert.create({
      userId,
      type: "SEASONAL",
      title: "여름 매장 주의사항",
      message: "냉동/냉장 식품 관리 및 상태를 확인하세요."
    });
  }

}

// ---------- 시간 기반 알림 ----------
function getCurrentTimeZone() {
  const hour = new Date().getHours();

  if (hour >= 22 || hour < 6) return "야간";
  if (hour >= 6 && hour < 12) return "오전";
  if (hour >= 12 && hour < 18) return "오후";
  return "저녁";
}

// ---------- 시즌 기반 알림 ----------
function getSeason() {
  const month = new Date().getMonth() + 1;

  if ([6,7,8].includes(month)) return "여름";
  if ([12,1,2].includes(month)) return "겨울";
  return "기타";
}


module.exports = {
  router,
  handleQuizResult
};
