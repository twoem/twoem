const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const CustomerSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required']
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required'],
        unique: true,
        match: [/^(0[17][0-9]{8})$/, 'Please fill a valid phone number (e.g., 0712345678 or 0112345678)']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address']
    },
    location: {
        type: String,
        required: [true, 'Location is required']
    },
    subscriptionPerMonth: {
        type: Number,
        required: [true, 'Subscription amount per month is required'],
        min: 0
    },
    accountNumber: {
        type: String,
        required: [true, 'Account number is required'],
        unique: true
        // We might want to add a regex or specific format for account numbers later
    },
    balanceDue: { // This was referred to as 'Initial balance dept/Due'
        type: Number,
        required: true,
        default: 0
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6 // Consider a stronger minimum length
    },
    isDefaultPassword: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },
    resetPasswordOtp: { // Added for storing OTP temporarily
        type: String
    },
    // Fields related to payment and connection status as per Customer Dashboard description
    lastPaymentDate: {
        type: Date
    },
    connectionStatus: {
        type: String,
        enum: ['Active', 'Disconnected', 'Suspended'], // Example statuses
        default: 'Active' // Default status on creation, can be updated by admin
    },
    disconnectionDate: { // Relevant if status is Disconnected
        type: Date
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

// Pre-save hook to hash password
CustomerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare password for login
CustomerSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Customer', CustomerSchema);
