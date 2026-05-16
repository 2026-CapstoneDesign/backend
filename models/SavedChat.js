const mongoose = require('mongoose');

const SavedChatSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // 토큰(JWT)에서 추출한 유저 고유 식별자 값 저장
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  savedAt: { type: Date, default: Date.now }
});

// 코드 오타 수정 및 안전한 엑스포트 구조 적용
module.exports = mongoose.models.SavedChat || mongoose.model('SavedChat', SavedChatSchema);