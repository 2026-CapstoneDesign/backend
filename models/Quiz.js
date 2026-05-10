const mongoose = require("mongoose");

const QuizSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    summaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Summary",
        required: true
    },
    quizzes: [
        {
            question: String,
            choices: [String],
            answer: String,
            explanation: String
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Quiz", QuizSchema);