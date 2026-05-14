const User = require("../models/User");
const QuizResult = require('../models/QuizResult');
const Alert = require('../models/Alert');

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
    const results = await QuizResult.aggregate([
      { $match: { correct: false } },

      {
        $group: {
          _id: '$concept',
          wrongCount: { $sum: 1 }
        }
      },

      { $sort: { wrongCount: -1 } },

      { $limit: 5 }
    ]);

    // mock 데이터
    res.json([
    {
      concept: "위생 관리",
      wrongCount: 12
    },
    {
      concept: "POS 사용",
      wrongCount: 7
    }
    ]);
    //res.json(results); <- mock 없애고 사용
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '취약 통계 조회 실패' });
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