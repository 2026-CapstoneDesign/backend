const User = require("../models/User");
const QuizResult = require('../models/QuizResult');
const Alert = require('../models/Alert');
const LearningProgress = require("../models/LearningProgress");
const Store = require("../models/store");
const StoreMember = require("../models/StoreMember");
const Summary = require("../models/Summary");

// 직원 학습 현황 API
exports.getEmployeeStatus = async (req, res) => {
  try {

    const ownerId = req.user.id || req.user._id;
    const users = await User.find({
        ownerId,
        role: "employee"
    });

    const result = [];

    for (const user of users) {

      const quizzes = await QuizResult.find({
        userId: user._id
      });

      const avgScore =
        quizzes.length > 0
          ? quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length
          : 0;

      result.push({
        name: user.name,
        avgScore,
        progress: quizzes.length,
        lastStudyAt:
          quizzes.length > 0
            ? quizzes[quizzes.length - 1].createdAt
            : null
      });
    }

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: '직원 현황 조회 실패'
    });
  }
};

// 취약 개념 통계 API
exports.getWeaknessStats = async (req, res) => {
    try {
        const ownerId = req.user.id || req.user._id;

        const employees = await User.find({
            ownerId,
            role: "employee",
        });

        const employeeIds = employees.map((employee) => employee._id);

        const results = await QuizResult.aggregate([
            {
                $match: {
                    userId: { $in: employeeIds },
                    wrongTopics: { $exists: true, $ne: [] },
                },
            },
            { $unwind: "$wrongTopics" },
            {
                $group: {
                    _id: "$wrongTopics",
                    wrongCount: { $sum: 1 },
                },
            },
            { $sort: { wrongCount: -1 } },
            { $limit: 5 },
            {
                $project: {
                    _id: 0,
                    concept: "$_id",
                    wrongCount: 1,
                },
            },
        ]);

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "취약 통계 조회 실패" });
    }
};

// 알림 통계 API
exports.getAlertStats = async (req, res) => {
  try {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const todayAlerts = await Alert.countDocuments({
      createdAt: { $gte: today }
    });

    const unreadAlerts = await Alert.countDocuments({
      isRead: false
    });

    res.json({
      todayAlerts,
      unreadAlerts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '알림 통계 조회 실패' });
  }
};

// 학습 진행도 API
exports.getMyLearningStats = async (req, res) => {
    try {

        const userId = req.user.id;

        // 현재 사용자의 매장 찾기
        const member = await StoreMember.findOne({
            userId
        });

        if (!member) {
            return res.status(404).json({
                message: "소속 매장을 찾을 수 없습니다."
            });
        }

        // 매장 조회
        const store = await Store.findById(
            member.storeId
        );

        if (!store) {
            return res.status(404).json({
                message: "매장을 찾을 수 없습니다."
            });
        }

        // 매장의 전체 교육 수
        const totalSummaryCount =
            await Summary.countDocuments({
                userId: store.ownerId
            });

        // 완료한 교육 수
        const completedCount =
            await LearningProgress.countDocuments({
                userId,
                targetType: "summary",
                isCompleted: true
            });

        // 진행 중인 교육 수
        const inProgressCount =
            await LearningProgress.countDocuments({
                userId,
                targetType: "summary",
                isCompleted: false
            });

        const completionRate =
            totalSummaryCount > 0
                ? (completedCount / totalSummaryCount) * 100
                : 0;

        const progresses =
            await LearningProgress.find({
                userId
            });

        const weeklyStudyTime =
            progresses.reduce(
                (sum, item) =>
                    sum + (item.learningTimeMinutes || 0),
                0
            );

        res.json({
            completedCount,
            totalCount: totalSummaryCount,
            completionRate:
                Number(completionRate.toFixed(1)),
            inProgressCount,
            weeklyStudyTime
        });

    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "학습 통계 조회 실패"
        });
    }
};