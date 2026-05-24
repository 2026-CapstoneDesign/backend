const Store = require("../models/store");
const StoreMember = require("../models/storeMember");
const crypto = require("crypto"); 

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


// =============================
// 매장 전용 초대코드 생성
// =============================
exports.createInviteCode = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await Store.findOne({ _id: storeId, isDeleted: false });
    if (!store) {
      return res.status(404).json({
        error: "매장을 찾을 수 없거나 삭제된 매장입니다.",
      });
    }

    // 카테고리명 앞 4자리 + 랜덤 4자리 조합 (예: CAFE-A1B2)
    const newInviteCode = crypto.randomBytes(2).toString("hex").toUpperCase();

    // 매장에 초대코드 등록 및 저장
    store.inviteCode = newInviteCode;
    await store.save();

    res.status(200).json({
      message: "초대코드 생성 완료",
      inviteCode: newInviteCode,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "초대코드 생성 실패",
    });
  }
};

// =============================
// 알바생 초대코드 입력 및 매장 합류
// =============================
exports.joinStore = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    if (!inviteCode) {
      return res.status(400).json({
        error: "초대코드를 입력해주세요.",
      });
    }

    // 1. 활성화된 매장 중 해당 초대코드가 있는지 검증
    const store = await Store.findOne({ inviteCode, isDeleted: false });
    if (!store) {
      return res.status(404).json({
        error: "올바르지 않거나 일치하는 매장이 없는 초대코드입니다.",
      });
    }

    // 사장님이 본인 매장에 알바생으로 들어가는 로직 차단
    if (store.ownerId.toString() === userId) {
      return res.status(400).json({
        error: "매장 관리자는 알바생 멤버로 등록할 수 없습니다.",
      });
    }

    // 2. 이미 소속된 멤버인지 중복 검사
    const alreadyMember = await StoreMember.findOne({ storeId: store._id, userId });
    if (alreadyMember) {
      return res.status(400).json({
        error: "이미 이 매장에 등록되어 있는 직원입니다.",
      });
    }

    // 3. 직원(EMPLOYEE)으로 가입 처리
    const newMember = await StoreMember.create({
      storeId: store._id,
      userId: userId,
      role: "EMPLOYEE",
      progress: 0,
    });

    res.status(201).json({
      message: `'${store.name}' 매장에 성공적으로 소속되었습니다.`,
      member: {
        storeId: store._id,
        role: newMember.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "매장 합류 실패",
    });
  }
};

// =============================
// 특정 매장의 직원 목록 및 진척도 조회
// =============================
exports.getStoreMembers = async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;

   
    const isAuthorized = await Store.findOne({ _id: storeId, ownerId: userId, isDeleted: false })
      || await StoreMember.findOne({ storeId, userId });

    if (!isAuthorized) {
      return res.status(403).json({
        error: "이 매장의 직원 목록을 조회할 권한이 없습니다.",
      });
    }

    const members = await StoreMember.find({ storeId })
      .populate("userId", "name email")
      .sort({ role: 1, createdAt: 1 }); // OWNER 우선 정렬 후 입사순 정렬

    const memberList = members.map((m) => ({
      memberId: m._id,
      userId: m.userId ? m.userId._id : null,
      name: m.userId ? m.userId.name : "탈퇴한 사용자",
      email: m.userId ? m.userId.email : "",
      role: m.role,
      progress: m.progress || 0,
      joinedAt: m.createdAt,
    }));

    res.status(200).json({
      totalCount: memberList.length,
      members: memberList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "직원 목록 조회 실패",
    });
  }
};

// =============================
// 사장님이 특정 알바생 삭제 (퇴사)
// =============================
exports.deleteStoreMember = async (req, res) => {
  try {
    const { storeId, memberId } = req.params;

   
    const firedMember = await StoreMember.findOneAndDelete({ _id: memberId, storeId });
    if (!firedMember) {
      return res.status(404).json({
        error: "매장에 소속된 해당 직원을 찾을 수 없습니다.",
      });
    }

    res.status(200).json({
      message: "해당 직원이 매장에서 성공적으로 삭제(퇴사 처리)되었습니다.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "직원 퇴사 처리 실패",
    });
  }
};