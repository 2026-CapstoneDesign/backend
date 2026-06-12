const mongoose = require('mongoose');

const SummarySchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', // User Î™®Îç∏Í≥??∞Í≤∞
        required: true 
    },
    category: { 
        type: String, 
        default: '?ºÎ∞ò' 
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
    },
    recommendedQuestions: { type: [String], default: [] }
});

module.exports = mongoose.model('Summary', SummarySchema);
