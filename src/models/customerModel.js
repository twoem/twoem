const mongoose = require('mongoose');
const validator =require('validator');

const paymentLogSchema = new mongoose.Schema({
    paymentDate: {
        type: Date,
        default: Date.now,
        required: true,
    },
    mode: {
        type: String,
        required: [true, 'Payment mode is required.'],
        enum: ['Mpesa', 'Bank', 'Cash', 'Other'], // Example modes
    },
    amount: {
        type: Number,
        required: [true, 'Payment amount is required.'],
    },
    transactionCode: {
        type: String,
        trim: true,
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin', // Assuming you have an Admin model
    },
    approvalDate: {
        type: Date,
    },
    verificationStatus: {
        type: String,
        enum: ['verified', 'unverified', 'queried'],
    },
    adminRemarks: {
        type: String,
        trim: true,
    }
});

const customerSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required.'],
        trim: true,
    },
    secondName: {
        type: String,
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required.'],
        trim: true,
    },
    organisationName: {
        type: String,
        trim: true,
    },
    phoneNumber: {
        type: String,
        required: [true, 'Phone number is required.'],
        unique: true,
        trim: true,
        validate: {
            validator: function (v) {
                return /^(0[17])\d{8}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number! Must be 10 digits and start with 01 or 07.`,
        },
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Please provide a valid email.'],
    },
    location: {
        type: String,
        required: [true, 'Location is required.'],
        trim: true,
    },
    installationDate: {
        type: Date,
        required: [true, 'Installation date is required.'],
        default: Date.now,
    },
    paymentPerMonth: {
        type: Number,
        required: [true, 'Payment per month is required.'],
        min: [0, 'Payment per month cannot be negative.'],
    },
    accountNumber: {
        type: String,
        required: [true, 'Account number is required.'],
        unique: true,
        trim: true,
        // You might want to add a specific format or generation logic later
    },
    initialAccountBalance: {
        type: Number,
        required: [true, 'Initial account balance is required.'],
    },
    currentBalance: {
        type: Number,
        // Default will be set based on initialAccountBalance
    },
    disconnectionDate: {
        type: Date,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    paymentLogs: [paymentLogSchema],
    lastBillingDate: { // New field for tracking billing
        type: Date,
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Initialize fields for new documents
customerSchema.pre('save', function (next) {
    if (this.isNew) {
        // Set currentBalance to initialAccountBalance if not already set
        if (typeof this.currentBalance === 'undefined') {
            this.currentBalance = this.initialAccountBalance;
        }
        // Set initial lastBillingDate to the 1st of the installation month
        if (!this.lastBillingDate) {
            const instDate = new Date(this.installationDate);
            // Ensures billing starts from the month *after* installation if inst. date is not 1st.
            // Or, if payment is upfront for the first month, this could be end of installation month.
            // For "bill on 1st for upcoming month":
            this.lastBillingDate = new Date(instDate.getFullYear(), instDate.getMonth(), 1);
        }
    }
    // If initialAccountBalance is modified on an existing document, and currentBalance is not being explicitly set,
    // it might indicate a correction. However, typically balance changes come via payments or specific adjustments.
    // The initial setup of currentBalance is the primary goal here for new docs.
    // If an existing doc's initialAccountBalance is changed, currentBalance should likely be reviewed/adjusted by an admin.
    // This hook will also run if initialAccountBalance is modified on an existing doc,
    // and if currentBalance was undefined, it would set it. This might be okay.
     else if (this.isModified('initialAccountBalance') && typeof this.currentBalance === 'undefined') {
        this.currentBalance = this.initialAccountBalance;
    }
    next();
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
