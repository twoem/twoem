const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    amountPaid: {
        type: Number,
        required: true,
        min: 0
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    referenceNumber: {
        type: String,
        required: true,
        trim: true
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }
}, {
    timestamps: true
});

const Fee = mongoose.model('Fee', feeSchema);

module.exports = Fee;
