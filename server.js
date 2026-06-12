require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const auth = require("./middleware/auth");
const User = require("./models/User");
const storeRoutes = require("./routes/storeRoutes");
const quizRoutes = require("./routes/quizRoutes");
const dashboardRoutes = require('./routes/dashboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const questionRoutes = require("./routes/questionRoutes");
const learningProgressRoutes = require("./routes/learningProgressRoutes");
const Survey = require("./models/Survey");
const multer = require("multer");
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const summaryRoutes = require("./routes/summaryRoutes");
const { router: alertRoutes } = require("./routes/alertRoutes");
const jwt = require("jsonwebtoken");

require("./config/passport");

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use("/uploads", express.static("uploads"));
app.use("/", userRoutes);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage: storage });

// DB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB 연결 성공"))
  .catch(err => console.log(err));

// 기본 테스트
app.get("/", (req, res) => {
  res.send("Server running");
});

// Google 로그인 시작
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google 콜백
app.get("/auth/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  }
);

// Kakao 로그인 시작
app.get("/auth/kakao",
  passport.authenticate("kakao")
);

// Kakao 콜백
app.get("/auth/kakao/callback",
  passport.authenticate("kakao", { session: false }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
  }
);

// 스토어 API
app.use("/store", storeRoutes);

// 업종별 질문 가져오기 API
app.get("/survey/questions", async (req, res) => {
  try {
    const { category } = req.query;
    const questions = await mongoose.connection.db.collection("questions").find({ category }).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: "질문 조회 실패" });
  }
});

// 설문 답변 및 파일 제출 API
app.post("/survey/submit", auth, upload.fields([
  { name: 'step1File' }, { name: 'step2File' }, { name: 'step3File' }
]), async (req, res) => {
  try {
    const surveyData = new Survey({
      userId: req.user.id,
      category: req.body.category,
      answers: {
        step1: JSON.parse(req.body.step1),
        step2: JSON.parse(req.body.step2),
        step3: JSON.parse(req.body.step3),
      },
      files: {
        step1: req.files['step1File'] ? req.files['step1File'][0].path : null,
        step2: req.files['step2File'] ? req.files['step2File'][0].path : null,
        step3: req.files['step3File'] ? req.files['step3File'][0].path : null,
      }
    });
    await surveyData.save();
    res.json({ message: "설문 저장 성공!", surveyId: surveyData._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "저장 실패" });
  }
});

// 사장님 대시보드 API
app.use('/dashboard', dashboardRoutes);

// 알림 API
app.use("/alert", alertRoutes);

// 매뉴얼 요약 API
app.use("/summary", summaryRoutes);

// 질문 게시판 API
app.use("/questions", questionRoutes);

// 학습 진행률 API
app.use("/learning-progress", learningProgressRoutes);

// 학습 퀴즈 API
app.use("/quiz", quizRoutes);

// 챗봇 API
app.use('/chat', chatRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});