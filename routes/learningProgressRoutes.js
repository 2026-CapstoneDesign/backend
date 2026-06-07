const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const auth = require("../middleware/auth");
const User = require("../models/User");
const Summary = require("../models/Summary");
const Quiz = require("../models/Quiz");
const LearningProgress = require("../models/LearningProgress");
const Store = require("../models/Store");
const StoreMember = require("../models/StoreMember");
const QuizResult = require("../models/QuizResult");

async function getAccessibleOwnerIds(user) {
    const ownerIds = new Set();

    if (user.role === "owner") {
        ownerIds.add(user._id.toString());
    }

    if (user.ownerId) {
        ownerIds.add(user.ownerId.toString());
    }

    const memberships = await StoreMember.find({ userId: user._id });
    const storeIds = memberships.map((member) => member.storeId);

    if (storeIds.length > 0) {
        const stores = await Store.find({
            _id: { $in: storeIds },
            isDeleted: false,
        });

        stores.forEach((store) => {
            ownerIds.add(store.ownerId.toString());
        });
    }

    return Array.from(ownerIds);
}

async function canAccessSummary(userId, summaryId) {
    const user = await User.findById(userId);

    if (!user) return null;

    const summary = await Summary.findById(summaryId);

    if (!summary) return null;

    const accessibleOwnerIds = await getAccessibleOwnerIds(user);

    if (!accessibleOwnerIds.includes(summary.userId.toString())) {
        return null;
    }

    return summary;
}

/**
 * 학습 진행률 저장/수정
 * POST /learning-progress
 */
router.post("/", auth, async (req, res) => {
    try {
        const { targetType, targetId, progressRate } = req.body;

        if (!targetType || !targetId || progressRate === undefined) {
            return res.status(400).json({
                success: false,
                message: "targetType, targetId, progressRate는 필수입니다.",
            });
        }

        if (!["summary", "quiz"].includes(targetType)) {
            return res.status(400).json({
                success: false,
                message: "targetType은 summary 또는 quiz만 가능합니다.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({
                success: false,
                message: "targetId 형식이 올바르지 않습니다.",
            });
        }

        if (progressRate < 0 || progressRate > 100) {
            return res.status(400).json({
                success: false,
                message: "progressRate는 0부터 100 사이여야 합니다.",
            });
        }

        let target = null;

        if (targetType === "summary") {
            target = await canAccessSummary(req.user.id, targetId);
        }

        if (targetType === "quiz") {
            target = await Quiz.findOne({
                _id: targetId,
                userId: req.user.id,
            });
        }

        if (!target) {
            return res.status(404).json({
                success: false,
                message: "학습 대상을 찾을 수 없습니다.",
            });
        }

        const isCompleted = progressRate >= 100;

        const progress = await LearningProgress.findOneAndUpdate(
            {
                userId: req.user.id,
                targetType,
                targetId,
            },
            {
                progressRate,
                isCompleted,
                completedAt: isCompleted ? new Date() : null,
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        res.status(200).json({
            success: true,
            message: "학습 진행률이 저장되었습니다.",
            data: progress,
        });
    } catch (err) {
        console.error("학습 진행률 저장 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "학습 진행률 저장 중 오류가 발생했습니다.",
            error: err.message,
        });
    }
});

/**
 * 내 학습 진행률 조회
 * GET /learning-progress/me
 */
router.get("/me", auth, async (req, res) => {
    try {
        const { targetType } = req.query;

        const filter = {
            userId: req.user.id,
        };

        if (targetType) {
            if (!["summary", "quiz"].includes(targetType)) {
                return res.status(400).json({
                    success: false,
                    message: "targetType은 summary 또는 quiz만 가능합니다.",
                });
            }

            filter.targetType = targetType;
        }

        const progressList = await LearningProgress.find(filter).sort({
            updatedAt: -1,
        });

        res.status(200).json({
            success: true,
            count: progressList.length,
            data: progressList,
        });
    } catch (err) {
        console.error("내 학습 진행률 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "내 학습 진행률 조회 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 직원별 학습 진행률 조회 - 사장님용
 * GET /learning-progress/employees
 * GET /learning-progress/employees?summaryId=요약ID
 */
router.get("/employees", auth, async (req, res) => {
    try {
        const { summaryId } = req.query;

        const owner = await User.findById(req.user.id);

        if (!owner) {
            return res.status(404).json({
                success: false,
                message: "사용자를 찾을 수 없습니다.",
            });
        }

        if (owner.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "사장님만 직원별 진행률을 조회할 수 있습니다.",
            });
        }

        if (summaryId) {
            if (!mongoose.Types.ObjectId.isValid(summaryId)) {
                return res.status(400).json({
                    success: false,
                    message: "summaryId 형식이 올바르지 않습니다.",
                });
            }

            const summary = await Summary.findOne({
                _id: summaryId,
                userId: owner._id,
            });

            if (!summary) {
                return res.status(404).json({
                    success: false,
                    message: "해당 교육 요약을 찾을 수 없습니다.",
                });
            }
        }

        const employees = await User.find({
            ownerId: owner._id,
            role: "employee",
        });

        const employeeIds = employees.map((employee) => employee._id);

        const progressFilter = {
            userId: { $in: employeeIds },
        };

        if (summaryId) {
            progressFilter.targetType = "summary";
            progressFilter.targetId = summaryId;
        }

        const progressList = await LearningProgress.find(progressFilter).sort({
            updatedAt: -1,
        });

        const result = employees.map((employee) => {
            const employeeProgress = progressList.filter(
                (progress) => progress.userId.toString() === employee._id.toString()
            );

            if (summaryId) {
                const progress = employeeProgress[0];

                return {
                    employeeId: employee._id,
                    name: employee.name,
                    email: employee.email,
                    summaryId,
                    progressRate: progress ? progress.progressRate : 0,
                    isCompleted: progress ? progress.isCompleted : false,
                    completedAt: progress ? progress.completedAt : null,
                    updatedAt: progress ? progress.updatedAt : null,
                };
            }

            return {
                employeeId: employee._id,
                name: employee.name,
                email: employee.email,
                progressList: employeeProgress,
            };
        });

        res.status(200).json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (err) {
        console.error("직원별 학습 진행률 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "직원별 학습 진행률 조회 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 교육별 평균 진행률 조회
 * GET /learning-progress/summary/:summaryId/average
 */
router.get("/summary/:summaryId/average", auth, async (req, res) => {
    try {
        const { summaryId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(summaryId)) {
            return res.status(400).json({
                success: false,
                message: "summaryId 형식이 올바르지 않습니다.",
            });
        }

        const summary = await canAccessSummary(req.user.id, summaryId);

        if (!summary) {
            return res.status(404).json({
                success: false,
                message: "조회 가능한 교육 요약을 찾을 수 없습니다.",
            });
        }

        const employees = await User.find({
            ownerId: summary.userId,
            role: "employee",
        });

        const employeeIds = employees.map((employee) => employee._id);

        const progressList = await LearningProgress.find({
            userId: { $in: employeeIds },
            targetType: "summary",
            targetId: summary._id,
        });

        const progressMap = new Map(
            progressList.map((progress) => [
                progress.userId.toString(),
                progress.progressRate,
            ])
        );

        const totalProgress = employeeIds.reduce((sum, employeeId) => {
            return sum + (progressMap.get(employeeId.toString()) || 0);
        }, 0);

        const employeeCount = employees.length;

        const averageProgress =
            employeeCount > 0
                ? Number((totalProgress / employeeCount).toFixed(1))
                : 0;

        const completedCount = progressList.filter(
            (progress) => progress.isCompleted
        ).length;

        const startedCount = progressList.length;
        const notStartedCount = employeeCount - startedCount;

        res.status(200).json({
            success: true,
            data: {
                summaryId: summary._id,
                category: summary.category,
                averageProgress,
                employeeCount,
                startedCount,
                notStartedCount,
                completedCount,
            },
        });
    } catch (err) {
        console.error("교육별 평균 진행률 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "교육별 평균 진행률 조회 중 오류가 발생했습니다.",
            error: err.message,
        });
    }
});

/**
 * 내 학습 리포트 조회
 * GET /learning-progress/report
 */
router.get("/report", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "사용자를 찾을 수 없습니다.",
            });
        }

        const accessibleOwnerIds = await getAccessibleOwnerIds(user);

        const summaries = await Summary.find({
            userId: { $in: accessibleOwnerIds },
        }).sort({ createdAt: -1 });

        const summaryIds = summaries.map((summary) => summary._id);

        const progressList = await LearningProgress.find({
            userId: user._id,
            targetType: "summary",
            targetId: { $in: summaryIds },
        });

        const progressMap = new Map(
            progressList.map((progress) => [
                progress.targetId.toString(),
                progress,
            ])
        );

        const totalProgress = summaries.reduce((sum, summary) => {
            const progress = progressMap.get(summary._id.toString());
            return sum + (progress ? progress.progressRate : 0);
        }, 0);

        const averageProgress =
            summaries.length > 0
                ? Number((totalProgress / summaries.length).toFixed(1))
                : 0;

        const completedEducations = summaries
            .filter((summary) => {
                const progress = progressMap.get(summary._id.toString());
                return progress && progress.isCompleted;
            })
            .map((summary) => {
                const progress = progressMap.get(summary._id.toString());

                return {
                    summaryId: summary._id,
                    category: summary.category,
                    summaryContent: summary.summaryContent,
                    progressRate: progress.progressRate,
                    completedAt: progress.completedAt,
                };
            });

        const weakAreas = await QuizResult.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(user._id),
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
                    topic: "$_id",
                    wrongCount: 1,
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data: {
                progress: averageProgress,
                totalEducationCount: summaries.length,
                completedCount: completedEducations.length,
                completedEducations,
                weakAreas,
            },
        });
    } catch (err) {
        console.error("학습 리포트 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "학습 리포트 조회 중 오류가 발생했습니다.",
            error: err.message,
        });
    }
});

module.exports = router;