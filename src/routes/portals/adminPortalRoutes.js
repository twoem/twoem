const express = require('express');
const router = express.Router();
const { loginAdmin } = require('../../controllers/authController');
const {
    getAdminDashboard,
    getStudentManagementPage,
    registerStudent,
    resetStudentPasswordToDefault,
    getCustomerManagementPage,
    registerCustomer,
    resetCustomerPasswordToDefault,
    getMailerPage,
    sendTestCustomerPasswordResetEmail,
    sendTestStudentPasswordResetEmail,
    sendTestNewStudentInitialDetailsEmail,
    sendBulkStudentEmail,
    sendBulkCustomerEmail,
    sendSingleEmail,
    getBackupPage,
    downloadBackup,
    uploadBackup,
    getStudentDetailsJson,
    getCustomerDetailsJson,
    toggleCustomerConnectionStatus
} = require('../../controllers/adminController');
const { protect, protectAdmin } = require('../../middleware/authMiddleware'); // Added 'protect'
const uploadBackupFile = require('../../middleware/uploadMiddleware');

// @route   GET /admin/login
// @desc    Admin login page
// @access  Public
router.get('/login', (req, res) => {
    res.render('admin/login', {
        pageTitle: 'Twoem Admin | Login',
        error: req.query.error || null,
        success: req.query.success || null,
        oldInput: {}
    });
});

// @route   POST /admin/login
// @desc    Process admin login
// @access  Public
router.post('/login', loginAdmin);

// @route   GET /admin/dashboard
// @desc    Admin dashboard page
// @access  Private (Admin)
router.get('/dashboard', protect, protectAdmin, getAdminDashboard);

// Student Management Routes
router.get('/students', protect, protectAdmin, getStudentManagementPage);
router.post('/students/register', protect, protectAdmin, registerStudent);
router.post('/students/:studentId/reset-password', protect, protectAdmin, resetStudentPasswordToDefault);
router.get('/students/:studentId/details-json', protect, protectAdmin, getStudentDetailsJson);

// Customer Management Routes
router.get('/customers', protect, protectAdmin, getCustomerManagementPage);
router.post('/customers/register', protect, protectAdmin, registerCustomer);
router.post('/customers/:customerId/reset-password', protect, protectAdmin, resetCustomerPasswordToDefault);
router.get('/customers/:customerId/details-json', protect, protectAdmin, getCustomerDetailsJson);
router.post('/customers/:customerId/toggle-connection', protect, protectAdmin, toggleCustomerConnectionStatus);

// Mailer Routes
router.get('/mailer', protect, protectAdmin, getMailerPage);
router.post('/mailer/test/customer-password-reset', protect, protectAdmin, sendTestCustomerPasswordResetEmail);
router.post('/mailer/test/student-password-reset', protect, protectAdmin, sendTestStudentPasswordResetEmail);
router.post('/mailer/test/new-student-details', protect, protectAdmin, sendTestNewStudentInitialDetailsEmail);
router.post('/mailer/bulk-students', protect, protectAdmin, sendBulkStudentEmail);
router.post('/mailer/bulk-customers', protect, protectAdmin, sendBulkCustomerEmail);
router.post('/mailer/send-single', protect, protectAdmin, sendSingleEmail);

// Backup Routes
router.get('/backup', protect, protectAdmin, getBackupPage);
router.get('/backup/download', protect, protectAdmin, downloadBackup);
router.post('/backup/upload', protect, protectAdmin, uploadBackupFile, uploadBackup);

// Admin Logout
router.get('/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
        secure: process.env.NODE_ENV === 'production'
    });
    res.redirect('/admin/login?success=You have been logged out.');
});

module.exports = router;
