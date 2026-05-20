const mongoose = require('mongoose');

const UnansweredQuestionSchema = new mongoose.Schema({
  // 기존 manualId를 surveyId로 변경
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  question: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UnansweredQuestion', UnansweredQuestionSchema);