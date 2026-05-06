const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: String, // QUIZ_RETRY, WEAK_PART, TIME_BASED, SEASONAL
  title: String,
  message: String,

  weakTopic: String, // 취약 영역 (ex: "결제 방법")
  triggerTime: String, // 시간대 (ex: "야간")
  
  isRead: { type: Boolean, default: false },
  relatedId: String // quizId, manualId 등
}, { timestamps: true });

module.exports = mongoose.model("Alert", alertSchema);