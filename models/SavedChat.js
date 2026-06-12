const mongoose = require('mongoose');

const SavedChatSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // ? í°(JWT)?ì„œ ì¶”ì¶œ??? ì? ê³ ìœ  ?ë³„??ê°??€??
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  savedAt: { type: Date, default: Date.now }
});

// ì½”ë“œ ?¤í? ?˜ì • ë°??ˆì „???‘ìŠ¤?¬íŠ¸ êµ¬ì¡° ?ìš©
module.exports = mongoose.models.SavedChat || mongoose.model('SavedChat', SavedChatSchema);
