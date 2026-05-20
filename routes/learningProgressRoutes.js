const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const auth = require("../middleware/auth");
const User = require("../models/User");
const Summary = require("../models/Summary");
const Quiz = require("../models/Quiz");
const LearningProgress = require("../models/LearningProgress");

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
            target = await Summary.findOne({
                _id: targetId,
                userId: req.user.id,
            });
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
 */
router.get("/employees", auth, async (req, res) => {
    try {
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

        const employees = await User.find({
            ownerId: owner._id,
            role: "employee",
        });

        const employeeIds = employees.map((employee) => employee._id);

        const progressList = await LearningProgress.find({
            userId: { $in: employeeIds },
        }).sort({ updatedAt: -1 });

        const result = employees.map((employee) => {
            const employeeProgress = progressList.filter(
                (progress) => progress.userId.toString() === employee._id.toString()
            );

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

module.exports = router;