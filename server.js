require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const auth = require("./middleware/auth");
const User = require("./models/User");
const quizRoutes = require("./routes/quizRoutes");


require("./config/passport");

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());


// DB 연결
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB 연결 성공"))
  .catch(err => console.log(err));

// 기본 테스트
app.get("/", (req, res) => {
  res.send("Server running");
});

// 토큰 검증
app.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json(user);
});

// Google 로그인 시작
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google 콜백
const jwt = require("jsonwebtoken");

app.get("/auth/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {

    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
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

    res.json({ token });
  }
);

// 학습 퀴즈 API
app.use("/quiz", quizRoutes);


app.listen(3000, () => {
  console.log("Server running on port 3000");
});