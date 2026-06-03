const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");
const pdf = require("pdf-parse");
const multer = require("multer");

const auth = require("../middleware/auth");
const Summary = require("../models/Summary");

const Store = require("../models/store");
const StoreMember = require("../models/storeMember");

//용량 제한 5MB 및 메모리 스토리지
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 },
    storage: multer.memoryStorage(),
});

/**
 * 데이터 정제 함수
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
 * @route   POST /summary/process
 * @desc    텍스트+PDF 분석 요청 및 결과 DB 저장
 */
router.post("/process", auth, upload.single("manualFile"), async (req, res) => {
    try {
        let combinedText = "";

        if (req.body.manualText) {
            combinedText += req.body.manualText + "\n";
        }

        if (req.file) {
            if (req.file.mimetype !== "application/pdf") {
                return res.status(400).json({
                    success: false,
                    message: "PDF 파일만 업로드 가능합니다.",
                });
            }

            const pdfData = await pdf(req.file.buffer);
            combinedText += pdfData.text;
        }

        const finalContent = cleanText(combinedText);

        if (!finalContent || finalContent.length < 10) {
            return res.status(400).json({
                success: false,
                message: "분석할 내용이 부족합니다.",
            });
        }

        const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://localhost:8000";

        const formData = new FormData();

        formData.append("file", Buffer.from(finalContent), {
            filename: "manual.txt",
            contentType: "text/plain",
        });

        console.log(`[AI Request] POST ${AI_SERVER_URL}/analyze 호출`);
        console.log(`[AI Request] 분석 텍스트 길이: ${finalContent.length}`);

        const aiResponse = await axios.post(`${AI_SERVER_URL}/analyze`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
            timeout: 40000,
        });

        // 1. AI 서버의 최종 응답 
        const aiData = aiResponse.data;
        
        let extractedSummary = "";
        let extractedRecommendations = [];

        // 2. AI 서버 응답 구조
        if (typeof aiData === "object" && aiData !== null) {
            // 요약 텍스트 정제 추출
            extractedSummary = aiData.summary || aiData.error || JSON.stringify(aiData);
            // AI추천 질문 배열 추출
            extractedRecommendations = aiData.recommendations || [];
        } else {
            extractedSummary = String(aiData);
        }

       
        const newSummary = new Summary({
            userId: req.user.id,
            category: req.body.category || "미지정",
            originalText: finalContent,
            summaryContent: extractedSummary,
            recommendedQuestions: extractedRecommendations 
        });

        await newSummary.save();

        res.status(200).json({
            success: true,
            data: newSummary,
        });
    } catch (err) {
        console.error("분석 프로세스 에러:", err.message);

        res.status(500).json({
            success: false,
            message: "요약 처리 중 오류가 발생했습니다.",
            error: err.message,
        });
    }
});

/**
 * @route   GET /summary/list
 * @desc    사용자의 요약 내역 리스트 가져오기
 */
router.get("/list", auth, async (req, res) => {
    try {
        const summaries = await Summary.find({ userId: req.user.id }).sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            count: summaries.length,
            data: summaries,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "보관함을 불러오지 못했습니다.",
        });
    }
});

/**
 * @route   PUT /summary/:id
 * @desc    특정 요약 내역 수정
 */
router.put("/:id", auth, async (req, res) => {
    try {
        const { category, summaryContent } = req.body;

        const summary = await Summary.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!summary) {
            return res.status(404).json({
                success: false,
                message: "내역을 찾을 수 없습니다.",
            });
        }

        if (category) summary.category = category;
        if (summaryContent) summary.summaryContent = summaryContent;

        await summary.save();

        res.status(200).json({
            success: true,
            data: summary,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "수정 중 오류 발생",
        });
    }
});

/**
 * @route   DELETE /summary/:id
 * @desc    특정 요약 내역 삭제
 */
router.delete("/:id", auth, async (req, res) => {
    try {
        const summary = await Summary.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!summary) {
            return res.status(404).json({
                success: false,
                message: "내역 없음",
            });
        }

        if (!summary) {
            return res.status(404).json({
                success: false,
                message: "내역 없음",
            });
        }

        res.status(200).json({
            success: true,
            message: "삭제되었습니다.",
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "삭제 중 오류 발생",
        });
    }
});

/**
 * @route   GET /summary/store/:storeId/latest
 * @desc    
 */
router.get("/store/:storeId/latest", auth, async (req, res) => {
    try {
        const { storeId } = req.params;
        const userId = req.user.id;

        // 1. 권한 검증
        const isMember = await StoreMember.findOne({ storeId, userId });
        if (!isMember) {
            return res.status(403).json({
                success: false,
                message: "해당 매장의 매뉴얼을 조회할 권한이 없습니다.",
            });
        }

        // 2. 매장 정보 조회를 통해 사장님 ID(ownerId) 확보
        const store = await Store.findOne({ _id: storeId, isDeleted: false });
        if (!store) {
            return res.status(404).json({
                success: false,
                message: "매장을 찾을 수 없거나 삭제된 매장입니다.",
            });
        }

        // 3. 사장님 ID(ownerId)가 생성한 가장 최신 요약본 조회
        const latestSummary = await Summary.findOne({ userId: store.ownerId })
            .sort({ createdAt: -1 });

        if (!latestSummary) {
            return res.status(404).json({
                success: false,
                message: "아직 매장에 등록된 매뉴얼 요약본이 없습니다.",
            });
        }

        res.status(200).json({
            success: true,
            data: {
                summaryId: latestSummary._id, 
                category: latestSummary.category,
                summaryContent: latestSummary.summaryContent,
                recommendedQuestions: latestSummary.recommendedQuestions
            }
        });
    } catch (err) {
        console.error("매뉴얼 요약 조회 에러:", err.message);
        res.status(500).json({
            success: false,
            message: "매뉴얼 요약 조회 중 오류가 발생했습니다.",
            error: err.message,
        });
    }
});

module.exports = router;