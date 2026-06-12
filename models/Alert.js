const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: String,
  title: String,
  message: String,
  weakTopic: String,
  triggerTime: String,
  isRead: { type: Boolean, default: false },
  relatedId: String,
  createdAt: Date
}, { timestamps: true });

module.exports = mongoose.models.Alert || mongoose.model("Alert", alertSchema);