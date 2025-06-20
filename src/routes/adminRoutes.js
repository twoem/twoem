const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAdmin } = require('../utils/authMiddleware');
const fileUpload = require('../utils/fileUpload');

// Login routes
router.get('/login', adminController.showLogin);
router.post('/login', adminController.login);
router.get('/logout', adminController.logout);

// Dashboard
router.get('/dashboard', ensureAdmin, adminController.dashboard);

// Student management
router.get('/students', ensureAdmin, adminController.listStudents);
router.post('/students/register', ensureAdmin, adminController.registerStudent);
router.get('/students/:id/edit', ensureAdmin, adminController.showEditStudent);
router.post('/students/:id/edit', ensureAdmin, adminController.updateStudent);
router.post('/students/:id/deactivate', ensureAdmin, adminController.deactivateStudent);
router.post('/students/:id/reset-password', ensureAdmin, adminController.resetStudentPassword);

// Fees management
router.get('/fees', ensureAdmin, adminController.listFees);
router.post('/fees/record-payment', ensureAdmin, adminController.recordPayment);
router.post('/fees/send-reminders', ensureAdmin, adminController.sendFeeReminders);

// Academics
router.get('/academics', ensureAdmin, adminController.listStudentsForGrades);
router.get('/academics/:id', ensureAdmin, adminController.showGradeForm);
router.post('/academics/:id', ensureAdmin, adminController.saveGrades);

// Resources
router.get('/resources', ensureAdmin, adminController.listResources);
router.post('/resources/upload', 
    ensureAdmin, 
    fileUpload.upload.single('resourceFile'), 
    adminController.uploadResource
);
router.post('/resources/:id/delete', ensureAdmin, adminController.deleteResource);

// Notifications
router.get('/notifications', ensureAdmin, adminController.listNotifications);
router.post('/notifications/send', ensureAdmin, adminController.sendNotification);
router.post('/notifications/broadcast', ensureAdmin, adminController.broadcastNotification);

// System
router.get('/backup', ensureAdmin, adminController.showBackup);
router.post('/backup/export', ensureAdmin, adminController.exportData);
router.post('/backup/import', 
    ensureAdmin, 
    fileUpload.upload.single('backupFile'), 
    adminController.importData
);

// Settings
router.get('/settings', ensureAdmin, adminController.showSettings);
router.post('/settings/wifi', ensureAdmin, adminController.updateWifiSettings);

module.exports = router;
