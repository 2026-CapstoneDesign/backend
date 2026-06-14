const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");

const Summary = require("../models/Summary"); 
const FrequentlyQuestion = require("../models/FrequentlyQuestion");
const UnansweredQuestion = require("../models/UnansweredQuestion");
const SavedChat = require("../models/SavedChat");

const auth = require("../middleware/auth");

const cleanText = (text) => {
    if (!text) return "";
    return text
        .replace(/\r\n/g, "\n")
        .replace(/[\t ]+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .trim();
};

function analyzeKeyword(question) {
    if (/돈|시급|월급|급여|수당|정산|지급/.test(question)) return "급여 및 수당";
    if (/시간|스케줄|대타|출근|퇴근|지각|요일/.test(question)) return "근무 시간/스케줄";
    if (/옷|복장|유니폼|앞치마|모자|머리/.test(question)) return "복장 및 용모 규정";
    if (/보건증|위생|보건|카드/.test(question)) return "보건증 관련";
    if (/휴식|휴게|밥|식사|브레이크/.test(question)) return "휴게 시간";
    return "기타 업무 질문";
}

router.get("/recommendations/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params; 
        if (!summaryId) return res.status(400).json({ success: false, message: "summaryId가 필요합니다." });

        const manual = await Summary.findById(summaryId);
        if (!manual) return res.status(404).json({ success: false, message: "존재하지 않는 매뉴얼입니다." });

        let recommendations = [];
        
        if (manual.recommendedQuestions) {
            try {
                recommendations = typeof manual.recommendedQuestions === "string" 
                    ? JSON.parse(manual.recommendedQuestions) 
                    : manual.recommendedQuestions;
            } catch (e) {
                recommendations = manual.recommendedQuestions;
            }
        }

        return res.status(200).json({
            success: true,
            data: recommendations.slice(0, 8)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "추천 질문 로드 실패" });
    }
});

router.post("/ask/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params;
        const { question } = req.body;

        if (!question) return res.status(400).json({ success: false, message: "질문을 입력해주세요." });

        const manual = await Summary.findById(summaryId);
        if (!manual) return res.status(404).json({ success: false, message: "매뉴얼을 찾을 수 없습니다." });

        const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://localhost:8000";

        const aiResponse = await axios.post(`${AI_SERVER_URL}/ask`, {
            question: question,
            manual_text: manual.summaryContent || manual.originalText || ''
        });

        const rawAnswer = aiResponse.data.answer;
        const cleanAnswer = typeof rawAnswer === 'string' 
            ? rawAnswer 
            : JSON.stringify(rawAnswer || aiResponse.data);
        const actions = aiResponse.data.actions || [];

        return res.status(200).json({
            success: true,
            answer: cleanAnswer.trim(),
            actions: actions
        });
    } catch (error) {
        console.error("챗봇 답변 오류:", error.message);
        return res.status(500).json({ success: false, message: "AI 서버 대답 실패" });
    }
});

router.post("/save/:summaryId", auth, async (req, res) => {
    try {
        let { summaryId } = req.params;
        const { question, answer } = req.body;
        
        const userId = (req.user && req.user.id) ? req.user.id : "65f1a2b3c4d5e6f7a8b9c0d1"; 

        console.log("=== [저장 API 디버깅] ===");
        console.log("주소창에서 읽은 summaryId:", summaryId);
        console.log("보낸 데이터:", { question, answer });

        if (!summaryId || summaryId === ":summaryId" || summaryId === "undefined") {
            summaryId = "6a0833ef28e49fb9bb6192e7";
        }

        if (!question || !answer) {
            return res.status(400).json({ success: false, message: "question과 answer는 필수입니다." });
        }

        const savedItem = await SavedChat.create({
            userId: userId,
            surveyId: summaryId,
            question: question,
            answer: answer
        });

        return res.status(201).json({
            status: "success",
            message: "알바생 보관함에 성공적으로 저장되었습니다.",
            data: savedItem
        });

    } catch (error) {
        console.error("❌ 저장 도중 백엔드 최종 에러 터짐:", error);
        return res.status(500).json({ success: false, message: "서버 내부 오류로 저장 실패" });
    }
});

router.get("/frequently/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params;
        
        if (!summaryId) {
            return res.status(400).json({ success: false, message: "summaryId가 필요합니다." });
        }

        const statistics = await FrequentlyQuestion.find({ surveyId: summaryId })
            .sort({ count: -1 })
            .limit(5);

        return res.status(200).json({
            status: "success",
            data: statistics
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "통계 데이터 로드 실패" });
    }
});

router.get("/unanswered/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params;

        if (!summaryId) {
            return res.status(400).json({ success: false, message: "summaryId가 필요합니다." });
        }

        const unansweredList = await UnansweredQuestion.find({ surveyId: summaryId })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            count: unansweredList.length,
            data: unansweredList
        });
    } catch (error) {
        console.error("❌ 미답변 질문 조회 에러:", error);
        return res.status(500).json({ success: false, message: "미답변 질문 목록 로드 실패" });
    }
});

module.exports = router;