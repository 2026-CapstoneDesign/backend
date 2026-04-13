const passport = require("passport");
const User = require("../models/User");

// 구글
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {

  let user = await User.findOne({ providerId: profile.id });

  if (!user) {
    user = await User.create({
      email: profile.emails[0].value,
      name: profile.displayName,
      provider: "google",
      providerId: profile.id
    });
  }

  return done(null, user);
}));

// 카카오
const KakaoStrategy = require("passport-kakao").Strategy;

passport.use(new KakaoStrategy({
  clientID: process.env.KAKAO_CLIENT_ID,
  callbackURL: "http://localhost:3000/auth/kakao/callback"
},
async (accessToken, refreshToken, profile, done) => {

  let user = await User.findOne({
    provider: "kakao",
    providerId: profile.id
  });

  if (!user) {
    user = await User.create({
      email: profile._json.kakao_account?.email,
      name: profile.username,
      provider: "kakao",
      providerId: profile.id
    });
  }

  return done(null, user);
}));