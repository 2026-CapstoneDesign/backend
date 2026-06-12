const express = require("express");
const router = express.Router();
const axios = require("axios");

const auth = require("../middleware/auth");
const Summary = require("../models/Summary");
const Quiz = require("../models/Quiz");
const QuizResult = require("../models/QuizResult");
const LearningProgress = require("../models/LearningProgress");

const { handleQuizResult } = require("./alertRoutes");

/**
 * 퀴즈 생성
 * POST /quiz/generate/:summaryId
 */
router.post("/generate/:summaryId", auth, async (req, res) => {
    try {
        const summary = await Summary.findOne({
            _id: req.params.summaryId,
        });

        if (!summary) {
            return res.status(404).json({
                success: false,
                message: "요약 내역을 찾을 수 없습니다.",
            });
        }

        const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://localhost:8000";

        // summaryContent가 JSON 문자열인 경우 텍스트로 변환
        let summaryText = summary.summaryContent;
        try {
            const parsed = JSON.parse(summary.summaryContent);
            if (parsed.content && Array.isArray(parsed.content)) {
                summaryText = parsed.content.map((c) => `${c.title}: ${c.content}`).join('\n');
            } else if (typeof parsed === 'string') {
                summaryText = parsed;
            }
        } catch {
            summaryText = summary.summaryContent;
        }

        const aiResponse = await axios.post(`${AI_SERVER_URL}/quiz/generate`, {
            summary: summaryText,
            quiz_count: req.body.quizCount || 5,
        });

        console.log('AI 응답:', JSON.stringify(aiResponse.data));

        if (!aiResponse.data.success) {
            return res.status(500).json({
                success: false,
                message: "AI 퀴즈 생성 실패",
                error: aiResponse.data.error,
            });
        }

        const newQuiz = await Quiz.create({
            userId: req.user.id,
            summaryId: summary._id,
            quizzes: aiResponse.data.quiz,
        });

        res.status(201).json({
            success: true,
            data: newQuiz,
        });
    } catch (err) {
        console.error("퀴즈 생성 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "퀴즈 생성 중 오류 발생",
            error: err.message,
        });
    }
});

/**
 * 퀴즈 제출
 * POST /quiz/submit
 */
router.post("/submit", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { quizId, score, wrongAnswers = [] } = req.body;

        if (!quizId || score === undefined) {
            return res.status(400).json({
                success: false,
                message: "quizId와 score는 필수입니다.",
            });
        }

        if (!Array.isArray(wrongAnswers)) {
            return res.status(400).json({
                success: false,
                message: "wrongAnswers는 배열 형식이어야 합니다.",
            });
        }

        const quiz = await Quiz.findOne({
            _id: quizId,
            userId,
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "퀴즈를 찾을 수 없습니다.",
            });
        }

        const wrongTopics = [
            ...new Set(
                wrongAnswers
                    .map((item) => item.topic)
                    .filter((topic) => topic && topic.trim() !== "")
            ),
        ];

        const quizResult = await QuizResult.create({
            userId,
            quizId,
            summaryId: quiz.summaryId,
            concept: wrongTopics.length > 0 ? wrongTopics[0] : "전체",
            wrongTopics,
            correct: score >= 60,
            score,
        });

        await LearningProgress.findOneAndUpdate(
            {
                userId,
                targetType: "quiz",
                targetId: quizId,
            },
            {
                progressRate: 100,
                isCompleted: true,
                completedAt: new Date(),
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
            }
        );

        if (typeof handleQuizResult === "function") {
            await handleQuizResult(userId, quizId, score, wrongAnswers);
        }

        res.status(200).json({
            success: true,
            message: "퀴즈 제출 완료 + 결과 저장 + 진행률 저장 + 알림 생성",
            data: quizResult,
        });
    } catch (err) {
        console.error("퀴즈 제출 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "퀴즈 제출 중 오류 발생",
            error: err.message,
        });
    }
});

/**
 * 퀴즈 목록 조회
 * GET /quiz/list
 */
router.get("/list", auth, async (req, res) => {
    try {
        const quizzes = await Quiz.find({ userId: req.user.id })
            .populate("summaryId")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: quizzes.length,
            data: quizzes,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "퀴즈 목록 조회 실패",
        });
    }
});

/**
 * 퀴즈 상세 조회
 * GET /quiz/:id
 */
router.get("/:id", auth, async (req, res) => {
    try {
        const quiz = await Quiz.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "퀴즈를 찾을 수 없습니다.",
            });
        }

        res.status(200).json({
            success: true,
            data: quiz,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "퀴즈 조회 실패",
        });
    }
});

/**
 * 퀴즈 삭제
 * DELETE /quiz/:id
 */
router.delete("/:id", auth, async (req, res) => {
    try {
        const quiz = await Quiz.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "퀴즈를 찾을 수 없습니다.",
            });
        }

        res.status(200).json({
            success: true,
            message: "퀴즈가 삭제되었습니다.",
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "퀴즈 삭제 실패",
        });
    }
});

module.exports = router;