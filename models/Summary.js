const mongoose = require('mongoose');

const SummarySchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', // User 모델과 연결
        required: true 
    },
    category: { 
        type: String, 
        default: '일반' 
    },
    originalText: { 
        type: String, 
        required: true 
    },
    summaryContent: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Summary', SummarySchema);