const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'First name is required']
    },
    otherNames: { // For storing multiple other names if needed
        type: String,
        required: [true, 'Other names are required']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please fill a valid email address']
    },
    password: { // This will store the hashed password
        type: String,
        required: [true, 'Password is required'],
        minlength: 8 // Enforce a minimum password length
    },
    // We can add a field like 'envAdminId' (e.g., 'ADMIN1', 'ADMIN2') if we want to link DB record to .env definition explicitly
    envAdminId: {
      type: String, // e.g., ADMIN1, ADMIN2, ADMIN3
      unique: true,
      sparse: true // Allows null values but ensures uniqueness for non-null ones
    }
    // Add roles or permissions later if needed:
    // role: { type: String, enum: ['superadmin', 'editor'], default: 'editor' }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Pre-save hook to hash password if it's modified
AdminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    // Avoid re-hashing an already hashed password
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
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

// Method to compare entered password with hashed password
AdminSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);
