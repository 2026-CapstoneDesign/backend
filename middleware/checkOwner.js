const mongoose = require("mongoose");
const StoreMember = require("../models/storeMember");

module.exports = async (req, res, next) => {
  try {
    console.log(req.user);
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const { storeId } = req.params;

    const member = await StoreMember.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      userId: userId,
      role: "OWNER",
    });

    if (!member) {
      return res.status(403).json({
        error: "OWNER 권한 필요",
      });
    }

    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "권한 확인 실패",
    });
  }
};