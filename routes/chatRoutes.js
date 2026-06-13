const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");

// 1. 데이터베이스 모델 로드
const Summary = require("../models/Summary"); 
const FrequentlyQuestion = require("../models/FrequentlyQuestion");
const UnansweredQuestion = require("../models/UnansweredQuestion");
const SavedChat = require("../models/SavedChat");

// 🔒 프로젝트 공통 JWT 인증 미들웨어
const auth = require("../middleware/auth");

/**
 * 데이터 정제 함수 (Summary API와 동일한 정규식 스펙 유지)
 */
const cleanText = (text) => {
    if (!text) return "";
    return text
        .replace(/\r\n/g, "\n")
        .replace(/[\t ]+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .trim();
};

/**
 * 헬퍼 함수: 유저의 자연어 질문에서 통계용 대표 키워드를 매칭/추출
 */
function analyzeKeyword(question) {
    if (/돈|시급|월급|급여|수당|정산|지급/.test(question)) return "급여 및 수당";
    if (/시간|스케줄|대타|출근|퇴근|지각|요일/.test(question)) return "근무 시간/스케줄";
    if (/옷|복장|유니폼|앞치마|모자|머리/.test(question)) return "복장 및 용모 규정";
    if (/보건증|위생|보건|카드/.test(question)) return "보건증 관련";
    if (/휴식|휴게|밥|식사|브레이크/.test(question)) return "휴게 시간";
    return "기타 업무 질문";
}

// ==========================================================
// ① 추천 질문 조회 (GET /chat/recommendations/:summaryId)
// ==========================================================
router.get("/recommendations/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params; 
        if (!summaryId) return res.status(400).json({ success: false, message: "summaryId가 필요합니다." });

        const manual = await Summary.findById(summaryId);
        if (!manual) return res.status(404).json({ success: false, message: "존재하지 않는 매뉴얼입니다." });

        let recommendations = [];
        
        // AI가 문장 형태로 예쁘게 생성해서 DB에 넣어둔 배열이 있다면 파싱해서 바로 사용
        if (manual.recommendedQuestions) {
            try {
                // 만약 DB에 문자열 형태로 저장되어 있다면 JSON.parse를 거치고, 이미 배열이면 그대로 씁니다.
                recommendations = typeof manual.recommendedQuestions === "string" 
                    ? JSON.parse(manual.recommendedQuestions) 
                    : manual.recommendedQuestions;
            } catch (e) {
                recommendations = manual.recommendedQuestions;
            }
        }

        return res.status(200).json({
            success: true,
            data: recommendations.slice(0, 8) // 무조건 딱 8개만 컷
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "추chen 질문 로드 실패" });
    }
});

// ==========================================================
// ② 실시간 대화 질문하기 (POST /chat/ask/:summaryId)
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

        const cleanAnswer = aiResponse.data.answer || aiResponse.data;
        const actions = aiResponse.data.actions || [];

        return res.status(200).json({
            success: true,
            answer: String(cleanAnswer).trim(),
            actions: actions
        });
    } catch (error) {
        console.error("챗봇 답변 오류:", error.message);
        return res.status(500).json({ success: false, message: "AI 서버 대답 실패" });
    }
});

// ==========================================================
// ③ 답변 저장하기 (POST /chat/save/:summaryId) - 완벽 방어판
// ==========================================================
router.post("/save/:summaryId", auth, async (req, res) => {
    try {
        // 1. URL 경로에서 ID를 가져옵니다.
        let { summaryId } = req.params;
        const { question, answer } = req.body;
        
        // 2. 토큰에서 유저 ID 추출 (토큰 없으면 테스트용 가짜 ID 부여)
        const userId = (req.user && req.user.id) ? req.user.id : "65f1a2b3c4d5e6f7a8b9c0d1"; 

        // [디버깅용 로그] - 주소창에서 ID가 잘 들어오는지 서버 터미널에 강제로 찍어봅니다.
        console.log("=== [저장 API 디버깅] ===");
        console.log("주소창에서 읽은 summaryId:", summaryId);
        console.log("보낸 데이터:", { question, answer });

        // 3. 만약 주소창에 ID가 없거나 잘못 들어왔을 때를 대비한 2단계 안전장치
        if (!summaryId || summaryId === ":summaryId" || summaryId === "undefined") {
            console.log("⚠️ 경고: 주소창에 실제 ID를 적지 않았습니다. 테스트용 ID를 강제로 꼽습니다.");
            summaryId = "6a0833ef28e49fb9bb6192e7"; // 👈 본인의 실제 24자리 몽고DB ID를 적어두면 좋습니다.
        }

        if (!question || !answer) {
            return res.status(400).json({ success: false, message: "question과 answer는 필수입니다." });
        }

        // 4. DB 규격인 surveyId에 summaryId 값을 맵핑하여 강제 주입
        const savedItem = await SavedChat.create({
            userId: userId,
            surveyId: summaryId, // 👈 DB가 그토록 요구하는 surveyId에 데이터를 확실히 주입합니다.
            question: question,
            answer: answer
        });

        return res.status(201).json({
            status: "success",
            message: "알바생 보관함에 성공적으로 저장되었습니다.",
            data: savedItem
        });

    } catch (error) {
        // 에러가 나면 서버 터미널에 상세 내역을 출력합니다.
        console.error("❌ 저장 도중 백엔드 최종 에러 터짐:", error);
        return res.status(500).json({ success: false, message: "서버 내부 오류로 저장 실패" });
    }
});

// ==========================================================
// ④ 인기 질문 통계 (GET /chat/frequently/:summaryId)
// ==========================================================
router.get("/frequently/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params;
        
        if (!summaryId) {
            return res.status(400).json({ success: false, message: "summaryId가 필요합니다." });
        }

        // 해당 매뉴얼에서 가장 많이 질문된 키워드 상위 5개 내림차순 추출
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

// ==========================================================
// ⑤ 미답변 질문 목록 조회 (GET /chat/unanswered/:summaryId) 🌟 [신규 추가]
// ==========================================================
// AI가 답변을 찾지 못해 UnansweredQuestion 컬렉션에 쌓인 유저들의 질문을 가져옵니다.
router.get("/unanswered/:summaryId", auth, async (req, res) => {
    try {
        const { summaryId } = req.params;

        if (!summaryId) {
            return res.status(400).json({ success: false, message: "summaryId가 필요합니다." });
        }

        // 해당 매뉴얼(surveyId)에서 AI가 놓친 질문들을 최신순(-1)으로 조회합니다.
        const unansweredList = await UnansweredQuestion.find({ surveyId: summaryId })
            .sort({ createdAt: -1 }); // 최신 질문이 맨 위로 오도록 정렬

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