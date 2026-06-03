const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const checkOwner = require("../middleware/checkOwner");

const {
  createStore,
  getMyStores,
  updateStore,
  deleteStore,
  createInviteCode,
  joinStore,
  getStoreMembers,
  deleteStoreMember,
} = require("../controllers/storeController");

// 매장 생성
router.post("/", auth, createStore);

// 내 매장 조회
router.get("/me", auth, getMyStores);

// 매장 수정
router.patch("/:storeId", auth, checkOwner, updateStore);

// 매장 삭제
router.delete("/:storeId", auth, checkOwner, deleteStore);


// 사장님의 매장 전용 초대코드 생성 
router.post("/:storeId/invite", auth, checkOwner, createInviteCode);

// 알바생 초대코드 입력 및 매장 합류
router.post("/join", auth, joinStore);

// 특정 매장의 직원 목록 및 진척도 조회
router.get("/:storeId/members", auth, getStoreMembers);

// 사장님이 특정 알바생 삭제
router.delete("/:storeId/members/:memberId", auth, checkOwner, deleteStoreMember);

module.exports = router;