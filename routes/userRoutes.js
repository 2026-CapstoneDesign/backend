const express = require("express");
const router = express.Router();

const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

// 회원 조회
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "사용자를 찾을 수 없습니다."
            });
        }

        return res.status(200).json({
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            ownerId: user.ownerId
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: "서버 오류"
        });
    }
});


// 역할 선택
router.patch("/me/role", authMiddleware, async (req, res) => {
    try {
        const { role } = req.body;

        if (!["owner", "employee"].includes(role)) {
            return res.status(400).json({
                message: "올바르지 않은 역할입니다."
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { role },
            { new: true }
        );

        return res.status(200).json({
            message: "역할이 변경되었습니다.",
            role: user.role
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            message: "서버 오류"
        });
    }
});

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