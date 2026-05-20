const mongoose = require("mongoose");

const storeMemberSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: String,
      enum: ["OWNER", "EMPLOYEE"],
      default: "EMPLOYEE",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "StoreMember",
  storeMemberSchema
);