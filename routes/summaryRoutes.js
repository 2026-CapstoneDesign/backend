const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");
const pdf = require("pdf-parse");
const multer = require("multer");

const auth = require("../middleware/auth");
const Summary = require("../models/Summary");

// multer 설정: 용량 제한 5MB 및 메모리 스토리지
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

        // AI 서버 기본 주소
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

        // 🌟 1. AI 서버의 최종 응답 데이터 파싱
        const aiData = aiResponse.data;
        
        let extractedSummary = "";
        let extractedRecommendations = [];

        // 🌟 2. AI 서버 응답 구조 분해 및 가공 ([object Object] 방어 코드 포함)
        if (typeof aiData === "object" && aiData !== null) {
            // 요약 텍스트 정제 추출
            extractedSummary = aiData.summary || aiData.error || JSON.stringify(aiData);
            // AI가 문장으로 완전히 새로 창조해 준 추천 질문 배열 추출
            extractedRecommendations = aiData.recommendations || [];
        } else {
            extractedSummary = String(aiData);
        }

        // 🌟 3. 새 몽고디비 모델 객체 생성 시 추천 질문 필드까지 함께 세팅
        const newSummary = new Summary({
            userId: req.user.id,
            category: req.body.category || "미지정",
            originalText: finalContent,
            summaryContent: extractedSummary,
            recommendedQuestions: extractedRecommendations // 👈 몽고DB 스키마의 배열 필드에 저장!
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

module.exports = router;