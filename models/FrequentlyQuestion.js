const mongoose = require('mongoose');

const FrequentlyQuestionSchema = new mongoose.Schema({
  // 기존 manualId 대신 프로젝트 규격인 Survey를 참조하도록 수정
  surveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Survey', required: true },
  keyword: { type: String, required: true }, // 정규화된 키워드 (예: "급여 및 수당")
  count: { type: Number, default: 0 }        // 질문 빈도수
});

// 동일한 매뉴얼(Survey) 내에서 키워드는 유일하도록 복합 인덱스 설정 (성능 최적화 및 중복 방지)
FrequentlyQuestionSchema.index({ surveyId: 1, keyword: 1 }, { unique: true });

module.exports = mongoose.model('FrequentlyQuestion', FrequentlyQuestionSchema);