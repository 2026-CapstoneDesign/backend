const mongoose = require("mongoose");

const LearningProgressSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        targetType: {
            type: String,
            enum: ["summary", "quiz"],
            required: true,
        },

        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        progressRate: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 0,
        },

        isCompleted: {
            type: Boolean,
            default: false,
        },

        completedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

LearningProgressSchema.index(
    { userId: 1, targetType: 1, targetId: 1 },
    { unique: true }
);

module.exports = mongoose.model("LearningProgress", LearningProgressSchema);