const express = require('express');
const router = express.Router();
const authStudentController = require('../controllers/authStudentController');
const { authStudent } = require('../middleware/authMiddleware');
const mainController = require('../controllers/mainController'); // For rendering public login page

// --- Publicly Accessible Student Routes (No Auth Required) ---

// GET Student login page
router.get('/login', (req, res) => {
    // If student is already logged in (e.g., valid student_auth_token exists),
    // they could be redirected to dashboard.
    // However, simply rendering login page is fine; if they try to access protected parts,
    // authStudent will catch it. The `authStudent` middleware on dashboard route
    // will handle verification if they navigate there.
    // A simple check like below could be added if desired, but might lead to redirect loops if token is present but invalid for some reason.
    // if (req.cookies.student_auth_token) {
    //     return res.redirect('/student/dashboard');
    // }
    mainController.renderStudentLoginPage(req, res);
});

// POST Student login
router.post('/login', authStudentController.loginStudent);

// POST Student Retrieve Credentials
router.post('/retrieve-credentials', authStudentController.retrieveStudentCredentials);

// Forgot Password / Reset Password Routes
router.post('/forgot-password', authStudentController.handleForgotPassword);
router.get('/reset-password-form', authStudentController.renderResetPasswordForm);
router.post('/reset-password', authStudentController.handleResetPassword);

// --- Protected Student Routes (Auth Required) ---

// GET Student dashboard
router.get('/dashboard', authStudent, (req, res) => {
    res.render('pages/student-dashboard', {
        title: 'Student Dashboard',
        student: req.student
    });
});

// POST Student logout
router.post('/logout', authStudent, authStudentController.logoutStudent); // Protected: only logged-in student can log themselves out

// Initial Setup Routes (Force Password Change, Complete Profile)
router.get('/change-password-initial', authStudent, authStudentController.renderChangePasswordInitialForm);
router.post('/change-password-initial', authStudent, authStudentController.handleChangePasswordInitial);
router.get('/complete-profile-initial', authStudent, authStudentController.renderCompleteProfileInitialForm);
router.post('/complete-profile-initial', authStudent, authStudentController.handleCompleteProfileInitial);

// Student Portal - View Academics
router.get('/my-academics', authStudent, authStudentController.viewMyAcademics);

// Student Portal - View Fees
router.get('/my-fees', authStudent, authStudentController.viewMyFees);

// Student Portal - View Notifications
router.get('/notifications', authStudent, authStudentController.listMyNotifications);
router.post('/notifications/mark-read/:notificationId', authStudent, authStudentController.markNotificationAsRead);

// Student Portal - View Study Resources
router.get('/study-resources', authStudent, authStudentController.listMyStudyResources);

// Student Portal - View WiFi Credentials
router.get('/wifi-credentials', authStudent, authStudentController.viewWifiCredentials);

// Student Portal - Certificates
router.get('/my-certificates', authStudent, authStudentController.renderMyCertificatesPage);
router.get('/certificate/download/:enrollmentId', authStudent, authStudentController.downloadCertificate);

// Student Profile Self-Service
router.get('/profile/change-password', authStudent, authStudentController.renderChangePasswordForm);
router.post('/profile/change-password', authStudent, authStudentController.handleChangePassword);
router.get('/profile/edit-nok', authStudent, authStudentController.renderEditNokForm);
router.post('/profile/edit-nok', authStudent, authStudentController.handleUpdateNok);

module.exports = router;
