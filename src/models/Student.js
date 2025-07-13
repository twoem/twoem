const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AcademicRecordSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
        enum: [ // Predefined topics as per requirements
            'Introduction to Computers',
            'Keyboard Management',
            'Ms Word',
            'Ms Excel',
            'Ms Publisher',
            'Ms PowerPoint',
            'Ms Access', // Corrected typo from Acess to Access
            'Internet and Email'
        ]
    },
    score: {
        type: Number,
        min: 0,
        max: 100,
        default: null // null means not tested/filled
    },
    // Additional fields like 'dateAssigned', 'comments' could be added later
}, { _id: false }); // No separate _id for subdocuments unless needed

const MainExamSchema = new mongoose.Schema({
    theoryScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    practicalScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    examDate: {
        type: Date,
        default: null
    }
}, { _id: false });

const StudentSchema = new mongoose.Schema({
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
        // Assuming same phone number format as customers, can be adjusted if different
        match: [/^(0[17][0-9]{8})$/, 'Please fill a valid phone number (e.g., 0712345678 or 0112345678)']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address']
    },
    registrationNumber: {
        type: String,
        required: [true, 'Registration number is required'],
        unique: true,
        uppercase: true,
        // Example pattern: TWOEM-001. Admin will assign this.
        // match: [/^TWOEM-\d{3,}$/, 'Registration number format is TWOEM-XXX']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6
    },
    isDefaultPassword: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    resetPasswordOtp: String,
    nextOfKinName: {
        type: String,
        trim: true,
        default: null
    },
    nextOfKinPhone: {
        type: String,
        trim: true,
        default: null
        // No strict validation here yet, can be added if needed
    },
    profileRequiresUpdate: { // Flag to prompt for Next of Kin update
        type: Boolean,
        default: true // True if nextOfKinName or nextOfKinPhone is null
    },
    timeStudied: { // Example: "3 Months Certificate Course"
        type: String,
        default: "Standard Course Duration"
    },
    feesBalance: {
        type: Number,
        required: true,
        default: 0
    },
    isStudiesComplete: { // Marked by admin
        type: Boolean,
        default: false
    },
    academicRecords: [AcademicRecordSchema],
    mainExam: {
        type: MainExamSchema,
        default: () => ({}) // Ensures mainExam object exists with defaults
    },
    mainExamScheduledDate: { // As per "scheduled date for the Main Exams"
        type: Date,
        default: null
    },
    initialDetailsViewed: { // For "New Student?" lookup feature
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Pre-save hook to hash password
StudentSchema.pre('save', async function(next) {
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

// Pre-save hook to set profileRequiresUpdate flag
StudentSchema.pre('save', function(next) {
    if (this.isModified('nextOfKinName') || this.isModified('nextOfKinPhone')) {
        this.profileRequiresUpdate = !this.nextOfKinName || !this.nextOfKinPhone;
    }
    // On initial creation if next of kin is not provided
    if (this.isNew && (!this.nextOfKinName || !this.nextOfKinPhone)) {
        this.profileRequiresUpdate = true;
    }
    next();
});


// Method to compare password for login
StudentSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Student', StudentSchema);
