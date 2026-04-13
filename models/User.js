const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: String,
  name: String,
  provider: String,
  providerId: String
});

module.exports = mongoose.model("User", userSchema);