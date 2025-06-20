const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    isGlobal: {
        type: Boolean,
        default: false
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    }]
}, {
    timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
