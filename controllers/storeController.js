const Store = require("../models/store");
const StoreMember = require("../models/storeMember");


// =============================
// 매장 생성
// =============================
exports.createStore = async (req, res) => {
  try {
    const { name, category, description } = req.body;

    const userId = req.user.id;

    // store 생성
    const store = await Store.create({
      ownerId: userId,
      name,
      category,
      description,
    });

    // owner를 멤버에도 추가
    await StoreMember.create({
      storeId: store._id,
      userId: userId,
      role: "OWNER",
    });

    res.status(201).json({
      message: "매장 생성 완료",
      store,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "매장 생성 실패",
    });
  }
};


// =============================
// 내 매장 조회
// =============================
exports.getMyStores = async (req, res) => {
  try {
    const userId = req.user.id;

    const stores = await StoreMember.find({
      userId,
    }).populate("storeId");

    res.status(200).json({
      stores,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "조회 실패",
    });
  }
};


// =============================
// 매장 수정
// =============================
exports.updateStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const { name, category, description } = req.body;

    // 매장 찾기
    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        error: "매장을 찾을 수 없습니다.",
      });
    }

    // 값 수정
    if (name) store.name = name;
    if (category) store.category = category;
    if (description) store.description = description;

    // 저장
    await store.save();

    res.status(200).json({
      message: "매장 수정 완료",
      store,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "수정 실패",
    });
  }
};


// =============================
// 매장 삭제 (soft delete)
// =============================
exports.deleteStore = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findById(storeId);

    if (!store) {
      return res.status(404).json({
        error: "매장을 찾을 수 없습니다.",
      });
    }

    store.isDeleted = true;

    await store.save();

    res.status(200).json({
      message: "매장 삭제 완료",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "삭제 실패",
    });
  }
};