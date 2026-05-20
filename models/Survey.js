const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  userId: { type: String, default: "anonymous" },
  category: String,
  
  step1: Array,
  step2: Array,
  step3: Array,
  
  step1FilePath: { type: String, default: null },
  step2FilePath: { type: String, default: null },
  step3FilePath: { type: String, default: null },

  // 🔥 [방법 B 캐싱용 필드 추가] 
  // 사장님이 등록/수정 시점에 FastAPI 결과물(8개 질문)을 이곳에 배열로 담아둡니다.
  recommendedQuestions: { type: [String], default: [] },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Survey', surveySchema);