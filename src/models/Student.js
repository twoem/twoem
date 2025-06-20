const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const studentSchema = new mongoose.Schema({
    regNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    mustResetPassword: {
        type: Boolean,
        default: true
    },
    enrollmentDate: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: Date,
    passwordResetTokenHash: String,
    passwordResetExpires: Date,
    coursesCompleted: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

// Hash password before saving
studentSchema.pre('save', async function(next) {
    if (this.isModified('passwordHash') || this.isNew) {
        if (!this.passwordHash.startsWith('$2a$')) {
            this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
        }
    }
    next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to generate reset token
studentSchema.methods.createPasswordResetToken = async function() {
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetTokenHash = await bcrypt.hash(resetToken, 10);
    this.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await this.save();
    return resetToken;
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
