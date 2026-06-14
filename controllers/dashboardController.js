const User = require("../models/User");
const QuizResult = require('../models/QuizResult');
const Alert = require('../models/Alert');
const LearningProgress = require("../models/LearningProgress");
const Store = require("../models/store");
const StoreMember = require("../models/StoreMember");
const Summary = require("../models/Summary");
const mongoose = require("mongoose");

async function getStoreEmployeeIds(ownerId) {
    const stores = await Store.find({ ownerId, isDeleted: { $ne: true } });
    const storeIds = stores.map(s => s._id);
    const members = await StoreMember.find({ storeId: { $in: storeIds } });
    const employeeUserIds = members
        .map(m => m.userId)
        .filter(id => id && id.toString() !== ownerId.toString());
    return employeeUserIds;
}

exports.getEmployeeStatus = async (req, res) => {
    try {
        const ownerId = req.user.id || req.user._id;
        const employeeIds = await getStoreEmployeeIds(ownerId);
        const result = [];
        for (const empId of employeeIds) {
            const user = await User.findById(empId);
            if (!user) continue;
            const quizzes = await QuizResult.find({ userId: empId });
            const avgScore = quizzes.length > 0
                ? quizzes.reduce((sum, q) => sum + q.score, 0) / quizzes.length
                : 0;
            result.push({
                name: user.name,
                avgScore,
                progress: quizzes.length,
                lastStudyAt: quizzes.length > 0 ? quizzes[quizzes.length - 1].createdAt : null
            });
        }
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '직원 현황 조회 실패' });
    }
};

exports.getWeaknessStats = async (req, res) => {
    try {
        const ownerId = req.user.id || req.user._id;
        const employeeIds = await getStoreEmployeeIds(ownerId);
        const objectIds = employeeIds.map(id => new mongoose.Types.ObjectId(id));
        const results = await QuizResult.aggregate([
            { $match: { userId: { $in: objectIds }, wrongTopics: { $exists: true, $ne: [] } } },
            { $unwind: "$wrongTopics" },
            { $group: { _id: "$wrongTopics", wrongCount: { $sum: 1 } } },
            { $sort: { wrongCount: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, concept: "$_id", wrongCount: 1 } },
        ]);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "취약 통계 조회 실패" });
    }
};

exports.getAlertStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayAlerts = await Alert.countDocuments({ createdAt: { $gte: today } });
        const unreadAlerts = await Alert.countDocuments({ isRead: false });
        res.json({ todayAlerts, unreadAlerts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '알림 통계 조회 실패' });
    }
};

exports.getMyLearningStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const member = await StoreMember.findOne({ userId });
        if (!member) {
            return res.status(404).json({ message: "소속 매장을 찾을 수 없습니다." });
        }

        const store = await Store.findById(member.storeId);
        if (!store) {
            return res.status(404).json({ message: "매장을 찾을 수 없습니다." });
        }

        const summaries = await Summary.find({ userId: store.ownerId });
        const summaryIds = summaries.map(s => s._id);
        const totalSummaryCount = summaries.length;

        const progresses = await LearningProgress.find({
            userId,
            targetType: "summary",
            targetId: { $in: summaryIds }
        });

        const completedCount = progresses.filter(p => p.isCompleted).length;
        const inProgressCount = progresses.filter(p => !p.isCompleted && p.progressRate > 0).length;

        const completionRate = totalSummaryCount > 0
            ? (completedCount / totalSummaryCount) * 100
            : 0;

        const weeklyStudyTime = progresses.reduce(
            (sum, item) => sum + (item.learningTimeMinutes || 0), 0
        );

        res.json({
            completedCount,
            totalCount: totalSummaryCount,
            completionRate: Number(completionRate.toFixed(1)),
            inProgressCount,
            weeklyStudyTime
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "학습 통계 조회 실패" });
    }
};