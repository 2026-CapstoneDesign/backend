const express = require("express");
const router = express.Router();

const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

// 회원 탈퇴
router.delete("/me", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
        }

        return res.status(200).json({
            message: "회원 탈퇴가 완료되었습니다."
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: "회원 탈퇴 중 서버 오류가 발생했습니다."
        });
    }
});

module.exports = router;