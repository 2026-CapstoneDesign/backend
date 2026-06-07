const mongoose = require("mongoose");

const QuizResultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quiz",
        required: true
    },

    summaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Summary"
    },

    concept: {
        type: String
    },

    wrongTopics: {
        type: [String],
        default: []
    },

    correct: {
        type: Boolean,
        required: true
    },

    score: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("QuizResult", QuizResultSchema);