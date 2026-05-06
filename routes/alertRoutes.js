const express = require("express");
const router = express.Router();
const Alert = require("../models/Alert");
const auth = require("../middleware/auth")


// 알림 생성 (테스트용)
router.post("/", auth, async (req, res) => {
  const alert = await Alert.create({
    ...req.body,
    userId: req.user.id
  });
  res.json(alert);
});

// 알림 목록 조회
router.get("/", async (req, res) => {
  const alert = await Alert.find({ userId: req.params.userId })
    .sort({ createdAt: -1 });

  res.json(alert);
});

// 읽음 처리
router.patch("/:id/read", async (req, res) => {
  await Alert.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ message: "updated" });
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
router.delete("/:id", async (req, res) => {
  await Alert.findByIdAndDelete(req.params.id);
  res.json({ message: "deleted" });
});


// ---------- 퀴즈 제출 시 자동 알림 ----------
// 예: 퀴즈 제출 후
async function handleQuizResult(userId, quizId, score, wrongAnswers) {

  const wrongCount = wrongAnswers.length;

  // 1️) 많이 틀림 → 복습 알림
  if (wrongCount >= 3) {
    await Alert.create({
      userId,
      type: "QUIZ_RETRY",
      title: "복습 필요",
      message: "틀린 문제가 많습니다. 다시 학습해보세요.",
      relatedId: quizId
    });
  }

  // 2️) 점수 낮음 → 취약 영역 알림
  if (score < 50) {
    await Alert.create({
      userId,
      type: "WEAK_PART",
      title: "취약 영역 발견",
      message: "특정 개념에서 반복적인 실수가 발생하고 있습니다.",
      relatedId: quizId
    });
  }

  // 3️) 특정 개념 반복 틀림 (핵심 기능)
  const topicCount = {};

  wrongAnswers.forEach(q => {
    const topic = q.topic; // 문제에 topic 넣어놔야 함
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
// 예: 야간 근무 실수 방지
function getCurrentTimeZone() {
  const hour = new Date().getHours();

  if (hour >= 22 || hour < 6) return "야간";
  if (hour >= 6 && hour < 12) return "오전";
  if (hour >= 12 && hour < 18) return "오후";
  return "저녁";
}

// ---------- 시즌 기반 알림 ----------
// 예: 여름 = 냉동 식품, 겨울 = 온장고
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