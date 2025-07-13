const mongoose = require('mongoose');

const PaymentConfirmationSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    mpesaConfirmationCode: {
        type: String,
        required: [true, 'M-Pesa confirmation code is required.'],
        trim: true,
        uppercase: true // M-Pesa codes are typically uppercase
    },
    amountPaid: {
        type: Number,
        required: [true, 'Amount paid is required.'],
        min: [1, 'Amount paid must be at least 1.']
    },
    status: {
        type: String,
        enum: ['Pending Verification', 'Verified', 'Rejected'],
        default: 'Pending Verification'
    },
    adminNotes: { // For admin to add notes during verification
        type: String,
        trim: true
    },
    verifiedBy: { // Admin who verified this
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin' // Assuming an Admin model will exist
    },
    dateVerified: {
        type: Date
    }
}, {
    timestamps: true // Adds createdAt (submission date) and updatedAt
});

// Ensure a customer cannot submit the exact same M-Pesa code multiple times if it's still pending.
// This is a basic check; more robust checks might be needed based on M-Pesa code uniqueness rules.
PaymentConfirmationSchema.index({ customer: 1, mpesaConfirmationCode: 1, status: 1 });


module.exports = mongoose.model('PaymentConfirmation', PaymentConfirmationSchema);
