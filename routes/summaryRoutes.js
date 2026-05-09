const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const pdf = require('pdf-parse');
const multer = require('multer');
const auth = require('../middleware/auth');
const Summary = require('../models/Summary'); 

// 1. multer 설정: 용량 제한(5MB) 및 메모리 스토리지
const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 }, 
    storage: multer.memoryStorage() 
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
router.post('/process', auth, upload.single('manualFile'), async (req, res) => {
    try {
        let combinedText = "";
        if (req.body.manualText) combinedText += req.body.manualText + "\n";

        if (req.file) {
            if (req.file.mimetype !== 'application/pdf') {
                return res.status(400).json({ success: false, message: 'PDF 파일만 업로드 가능합니다.' });
            }
            const pdfData = await pdf(req.file.buffer);
            combinedText += pdfData.text;
        }

        const finalContent = cleanText(combinedText);
        if (!finalContent || finalContent.length < 10) {
            return res.status(400).json({ success: false, message: '분석할 내용이 부족합니다.' });
        }

        // AI 서버(FastAPI) 호출
        const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://3.26.56.145:8000/analyze";
        const formData = new FormData();
        formData.append('file', Buffer.from(finalContent), {
            filename: 'manual.txt',
            contentType: 'text/plain', 
        }); 

        console.log(`[AI Request] /analyze 호출 (길이: ${finalContent.length})`);

        const aiResponse = await axios.post(AI_SERVER_URL, formData, {
            headers: { ...formData.getHeaders() },
            timeout: 40000 
        });

        // [핵심 수정] AI 응답이 객체(Object)일 경우 문자열로 추출/변환
        let analysisResult = aiResponse.data;
        if (typeof analysisResult === 'object') {
            // 에러 메시지 필드가 있다면 그걸 쓰고, 아니면 전체를 문자열로 변환
            analysisResult = analysisResult.summary || analysisResult.error || JSON.stringify(analysisResult);
        }

        // DB에 요약 결과 저장 (이제 summaryContent는 항상 문자열로 들어감)
        const newSummary = new Summary({
            userId: req.user.id,
            category: req.body.category || '미지정',
            originalText: finalContent,
            summaryContent: String(analysisResult) 
        });

        await newSummary.save();
        res.status(200).json({ success: true, data: newSummary });

    } catch (err) {
        console.error('분석 프로세스 에러:', err.message);
        res.status(500).json({ 
            success: false, 
            message: '요약 처리 중 오류가 발생했습니다.',
            error: err.message 
        });
    }
});

/**
 * @route   GET /summary/list
 * @desc    사용자의 요약 내역 리스트 가져오기
 */
router.get('/list', auth, async (req, res) => {
    try {
        const summaries = await Summary.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: summaries.length, data: summaries });
    } catch (err) {
        res.status(500).json({ success: false, message: '보관함을 불러오지 못했습니다.' });
    }
});

/**
 * @route   PUT /summary/:id
 * @desc    특정 요약 내역 수정
 */
router.put('/:id', auth, async (req, res) => {
    try {
        const { category, summaryContent } = req.body;
        let summary = await Summary.findOne({ _id: req.params.id, userId: req.user.id });

        if (!summary) {
            return res.status(404).json({ success: false, message: '내역을 찾을 수 없습니다.' });
        }

        if (category) summary.category = category;
        if (summaryContent) summary.summaryContent = summaryContent;

        await summary.save();
        res.status(200).json({ success: true, data: summary });
    } catch (err) {
        res.status(500).json({ success: false, message: '수정 중 오류 발생' });
    }
});

/**
 * @route   DELETE /summary/:id
 * @desc    특정 요약 내역 삭제
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const summary = await Summary.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!summary) return res.status(404).json({ success: false, message: '내역 없음' });
        res.status(200).json({ success: true, message: '삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '삭제 중 오류 발생' });
    }
});

module.exports = router;