const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const Question = require("../models/Question");
const Answer = require("../models/Answer");
const Alert = require("../models/Alert");
const User = require("../models/User");

/**
 * 질문 작성
 * POST /questions
 */
router.post("/", auth, async (req, res) => {
    try {
        const { title, content, category } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: "title과 content는 필수입니다.",
            });
        }

        const question = await Question.create({
            userId: req.user.id,
            title,
            content,
            category: category || "일반",
        });

        // 사장님에게 알림 발송 (ownerId 있는 경우)
        try {
            const asker = await User.findById(req.user.id);
            console.log("질문 작성자:", asker?.name, "ownerId:", asker?.ownerId);
            if (asker?.ownerId) {
                await Alert.create({
                    userId: asker.ownerId,
                    type: "QUESTION",
                    title: "새 질문이 등록되었습니다",
                    message: `${asker.name}님: ${title}`,
                    relatedId: question._id,
                });
                console.log("사장님 알림 생성 완료");
            } else {
                console.log("ownerId 없음 - 알림 미발송");
            }
        } catch (alertErr) {
            console.error("질문 알림 생성 실패:", alertErr.message);
        }

        res.status(201).json({
            success: true,
            message: "질문이 작성되었습니다.",
            data: question,
        });
    } catch (err) {
        console.error("질문 작성 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "질문 작성 중 오류가 발생했습니다.",
            error: err.message,
        });
    }
});

/**
 * 질문 목록 조회
 * GET /questions
 */
router.get("/", auth, async (req, res) => {
    try {
        const questions = await Question.find()
            .populate("userId", "name email role")
            .sort({ createdAt: -1 });

        const questionIds = questions.map((q) => q._id);
        const answerCounts = await Answer.aggregate([
            { $match: { questionId: { $in: questionIds } } },
            { $group: { _id: "$questionId", count: { $sum: 1 } } },
        ]);
        const answerCountMap = Object.fromEntries(answerCounts.map((a) => [a._id.toString(), a.count]));

        const data = questions.map((q) => ({
            ...q.toObject(),
            answerCount: answerCountMap[q._id.toString()] ?? 0,
        }));

        res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (err) {
        console.error("질문 목록 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "질문 목록 조회 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 질문 상세 조회 + 답변 목록
 * GET /questions/:id
 */
router.get("/:id", auth, async (req, res) => {
    try {
        const question = await Question.findById(req.params.id).populate(
            "userId",
            "name email role"
        );

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "질문을 찾을 수 없습니다.",
            });
        }

        const answers = await Answer.find({ questionId: question._id })
            .populate("userId", "name email role")
            .sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            data: {
                question,
                answers,
            },
        });
    } catch (err) {
        console.error("질문 상세 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "질문 상세 조회 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 질문 수정
 * PATCH /questions/:id
 */
router.patch("/:id", auth, async (req, res) => {
    try {
        const { title, content, category } = req.body;

        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "질문을 찾을 수 없습니다.",
            });
        }

        if (question.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "본인이 작성한 질문만 수정할 수 있습니다.",
            });
        }

        if (title) question.title = title;
        if (content) question.content = content;
        if (category) question.category = category;

        await question.save();

        res.status(200).json({
            success: true,
            message: "질문이 수정되었습니다.",
            data: question,
        });
    } catch (err) {
        console.error("질문 수정 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "질문 수정 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 질문 삭제
 * DELETE /questions/:id
 */
router.delete("/:id", auth, async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "질문을 찾을 수 없습니다.",
            });
        }

        if (question.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "본인이 작성한 질문만 삭제할 수 있습니다.",
            });
        }

        await Answer.deleteMany({ questionId: question._id });
        await Question.findByIdAndDelete(question._id);

        res.status(200).json({
            success: true,
            message: "질문이 삭제되었습니다.",
        });
    } catch (err) {
        console.error("질문 삭제 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "질문 삭제 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 답변 작성
 * POST /questions/:id/answers
 */
router.post("/:id/answers", auth, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: "content는 필수입니다.",
            });
        }

        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "질문을 찾을 수 없습니다.",
            });
        }

        const answer = await Answer.create({
            questionId: question._id,
            userId: req.user.id,
            content,
        });

        res.status(201).json({
            success: true,
            message: "답변이 작성되었습니다.",
            data: answer,
        });
    } catch (err) {
        console.error("답변 작성 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "답변 작성 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 답변 수정
 * PATCH /questions/answers/:answerId
 */
router.patch("/answers/:answerId", auth, async (req, res) => {
    try {
        const { content } = req.body;

        const answer = await Answer.findById(req.params.answerId);

        if (!answer) {
            return res.status(404).json({
                success: false,
                message: "답변을 찾을 수 없습니다.",
            });
        }

        if (answer.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "본인이 작성한 답변만 수정할 수 있습니다.",
            });
        }

        if (content) answer.content = content;

        await answer.save();

        res.status(200).json({
            success: true,
            message: "답변이 수정되었습니다.",
            data: answer,
        });
    } catch (err) {
        console.error("답변 수정 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "답변 수정 중 오류가 발생했습니다.",
        });
    }
});

/**
 * 답변 삭제
 * DELETE /questions/answers/:answerId
 */
router.delete("/answers/:answerId", auth, async (req, res) => {
    try {
        const answer = await Answer.findById(req.params.answerId);

        if (!answer) {
            return res.status(404).json({
                success: false,
                message: "답변을 찾을 수 없습니다.",
            });
        }

        if (answer.userId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "본인이 작성한 답변만 삭제할 수 있습니다.",
            });
        }

        await Answer.findByIdAndDelete(answer._id);

        res.status(200).json({
            success: true,
            message: "답변이 삭제되었습니다.",
        });
    } catch (err) {
        console.error("답변 삭제 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "답변 삭제 중 오류가 발생했습니다.",
        });
    }
});

module.exports = router;