const mongoose = require('mongoose');

const UnansweredQuestionSchema = new mongoose.Schema({
  // ê¸°ì¡´ manualIdë¥?surveyIdë¡?ë³€ê²?
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  question: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UnansweredQuestion', UnansweredQuestionSchema);
