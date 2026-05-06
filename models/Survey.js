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

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Survey', surveySchema);