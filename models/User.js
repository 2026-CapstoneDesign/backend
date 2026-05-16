const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true
        },

        name: {
            type: String,
            required: true
        },

        provider: {
            type: String
        },

        providerId: {
            type: String
        },

        role: {
            type: String,
            enum: ["owner", "employee"],
            default: "employee"
        },

        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);