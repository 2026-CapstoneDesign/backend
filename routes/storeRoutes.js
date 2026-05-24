const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const checkOwner = require("../middleware/checkOwner");

const {
  createStore,
  getMyStores,
  updateStore,
  deleteStore,
} = require("../controllers/storeController");


// 매장 생성
router.post("/", auth, createStore);


// 내 매장 조회
router.get("/me", auth, getMyStores);


// 매장 수정
router.patch(
  "/:storeId",
  auth,
  checkOwner,
  updateStore
);


// 매장 삭제
router.delete(
  "/:storeId",
  auth,
  checkOwner,
  deleteStore
);

module.exports = router;