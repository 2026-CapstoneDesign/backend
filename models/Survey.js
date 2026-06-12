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

  // ?”¥ [ë°©ë²• B ìºì‹±???„ë“œ ì¶”ê?] 
  // ?¬ì¥?˜ì´ ?±ë¡/?˜ì • ?œì ??FastAPI ê²°ê³¼ë¬?8ê°?ì§ˆë¬¸)???´ê³³??ë°°ì—´ë¡??´ì•„?¡ë‹ˆ??
  recommendedQuestions: { type: [String], default: [] },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Survey', surveySchema);
