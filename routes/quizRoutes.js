const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth")

app.post("/quiz/submit", auth, async (req, res) => {

  const { quizId, score, wrongAnswers } = req.body;

  const userId = req.user.id;

  // 🔥 여기 핵심 연결
  await handleQuizResult(userId, quizId, score, wrongAnswers);

  res.json({ message: "퀴즈 제출 완료 + 알림 생성" });
});