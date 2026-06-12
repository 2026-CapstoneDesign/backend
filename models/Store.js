const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    category: {
      type: String,
    },

    description: {
      type: String,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    inviteCode: {
      type: String,
      unique: true, 
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Store || mongoose.model("Store", storeSchema);
