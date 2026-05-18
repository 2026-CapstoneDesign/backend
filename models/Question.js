const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        content: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            default: "일반",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Question", QuestionSchema);