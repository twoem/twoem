const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    originalName: {
        type: String,
        required: true
    },
    storedName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    targetCourse: {
        type: String,
        enum: [
            'Introduction to Computers',
            'Keyboard Management',
            'Microsoft Word',
            'Microsoft Excel',
            'Microsoft Publisher',
            'Microsoft PowerPoint',
            'Microsoft Access',
            'Internet and Email'
        ]
    },
    expiryDate: Date,
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    }
}, {
    timestamps: true
});

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;
