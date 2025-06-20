const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAdmin } = require('../utils/authMiddleware');
const fileUpload = require('../utils/fileUpload');

// Authentication
router.get('/login', adminController.showLogin);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);

// Dashboard
router.get('/dashboard', ensureAdmin, adminController.dashboard);

// Student Management
router.get('/students', ensureAdmin, adminController.listStudents);
router.post('/students/register', ensureAdmin, adminController.registerStudent);
router.get('/students/:id/edit', ensureAdmin, adminController.showEditStudent);
router.post('/students/:id/edit', ensureAdmin, adminController.updateStudent);
router.post('/students/:id/deactivate', ensureAdmin, adminController.deactivateStudent);
router.post('/students/:id/reset-password', ensureAdmin, adminController.resetStudentPassword);

// Fees Management
router.get('/fees', ensureAdmin, adminController.listFees);
router.post('/fees/record-payment', ensureAdmin, adminController.recordPayment);
router.post('/fees/send-reminders', ensureAdmin, adminController.sendFeeReminders);

// Academics Management
router.get('/academics', ensureAdmin, adminController.listStudentsForGrades);
router.get('/academics/:id', ensureAdmin, adminController.showGradeForm);
router.post('/academics/:id', ensureAdmin, adminController.saveGrades);

// Resources Management
router.get('/resources', ensureAdmin, adminController.listResources);
router.post('/resources/upload', 
    ensureAdmin, 
    fileUpload.upload.single('resourceFile'), 
    adminController.uploadResource
);
router.post('/resources/:id/delete', ensureAdmin, adminController.deleteResource);

// Notifications Management
router.get('/notifications', ensureAdmin, adminController.listNotifications);
router.post('/notifications/send', ensureAdmin, adminController.sendNotification);
router.post('/notifications/broadcast', ensureAdmin, adminController.broadcastNotification);

module.exports = router;
