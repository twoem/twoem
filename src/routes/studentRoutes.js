const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { ensureStudent } = require('../utils/authMiddleware');

// Authentication
router.get('/login', studentController.showLogin);
router.post('/login', studentController.login);
router.get('/reset-password-first', studentController.showResetPasswordFirst);
router.post('/reset-password-first', studentController.processResetPasswordFirst);
router.get('/forgot-password', studentController.showForgotPassword);
router.post('/forgot-password', studentController.processForgotPassword);
router.get('/reset-password', studentController.showResetPassword);
router.post('/reset-password', studentController.processResetPassword);
router.get('/logout', studentController.logout);

// Dashboard
router.get('/dashboard', ensureStudent, studentController.dashboard);

// Profile
router.get('/profile', ensureStudent, studentController.showProfile);
router.post('/profile', ensureStudent, studentController.updateProfile);

// Academics
router.get('/academics', ensureStudent, studentController.showAcademics);

// Fees
router.get('/fees', ensureStudent, studentController.showFees);
router.post('/fees/request-receipt', ensureStudent, studentController.requestReceipt);

// Resources
router.get('/resources', ensureStudent, studentController.showResources);

// Notifications
router.get('/notifications', ensureStudent, studentController.showNotifications);
router.post('/notifications/:id/read', ensureStudent, studentController.markNotificationAsRead);

// WiFi Information
router.get('/wifi-info', ensureStudent, studentController.showWifiInfo);

// Support
router.get('/support', ensureStudent, studentController.showSupport);
router.post('/support', ensureStudent, studentController.submitSupportRequest);

module.exports = router;
