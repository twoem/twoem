const express = require('express');
const router = express.Router();
const {
    loginStudent,
    getStudentChangePasswordPage, changeStudentPassword,
    getStudentForgotPasswordPage, forgotStudentPassword,
    getStudentResetPasswordPage, resetStudentPassword,
    getNewStudentLookupPage, handleNewStudentLookup
} = require('../../controllers/authController'); // Corrected path
const {
    getStudentDashboard,
    getStudentUpdateProfilePage,
    updateStudentProfile,
    getAcademicsPage,
    getFinancialPage,
    getResourcesPage
} = require('../../controllers/studentController'); // Corrected path
const { protect, protectStudent, checkStudentDefaultPassword, checkStudentProfile } = require('../../middleware/authMiddleware'); // Corrected path, Added 'protect'

// @route   GET /student/login
// @desc    Student login page
// @access  Public
router.get('/login', (req, res) => {
    res.render('student/login', {
        pageTitle: 'Student Portal | Login',
        error: req.query.error || null,
        success: req.query.success || null,
        oldInput: {}
    });
});

// @route   POST /student/login
// @desc    Process student login
// @access  Public
router.post('/login', loginStudent);

// @route   GET /student/change-password
// @desc    Page for student to change their default/current password
// @access  Private (Student)
router.get('/change-password', protect, checkStudentDefaultPassword, protectStudent, getStudentChangePasswordPage); // Added protectStudent
router.post('/change-password', protect, checkStudentDefaultPassword, protectStudent, changeStudentPassword); // Added protectStudent

// @route   GET /student/forgot-password
// @desc    Page for student to request password reset
// @access  Public
router.get('/forgot-password', getStudentForgotPasswordPage);
router.post('/forgot-password', forgotStudentPassword);

// @route   GET /student/reset-password(/:token)
// @desc    Page for student to reset password
// @access  Public
router.get('/reset-password/:token', getStudentResetPasswordPage);
router.get('/reset-password', getStudentResetPasswordPage); // For OTP only if no token in URL
router.post('/reset-password/:token', resetStudentPassword);
router.post('/reset-password', resetStudentPassword);


// @route   GET /student/new-student-lookup
// @desc    Page for new students to look up their initial details
// @access  Public
router.get('/new-student-lookup', getNewStudentLookupPage);
router.post('/new-student-lookup', handleNewStudentLookup);
// A page to display initial details: router.get('/view-initial-details', ...); // Will be handled by POST logic redirect or render

// @route   GET /student/update-profile
// @desc    Page for student to update their Next of Kin info
// @access  Private (Student)
router.get('/update-profile', protect, protectStudent, getStudentUpdateProfilePage); // Added protect
router.post('/update-profile', protect, protectStudent, updateStudentProfile); // Added protect


// @route   GET /student/dashboard
// @desc    Student dashboard page (placeholder)
// @access  Private (Student)
router.get('/dashboard', protect, checkStudentDefaultPassword, checkStudentProfile, protectStudent, getStudentDashboard);

// @route   GET /student/academics
// @desc    Student academics page (grades, progress)
// @access  Private (Student)
router.get('/academics', protect, checkStudentDefaultPassword, checkStudentProfile, protectStudent, getAcademicsPage);

// @route   GET /student/financial
// @desc    Student financial information page
// @access  Private (Student)
router.get('/financial', protect, checkStudentDefaultPassword, checkStudentProfile, protectStudent, getFinancialPage);

// @route   GET /student/resources
// @desc    Student resources page (materials, Wi-Fi)
// @access  Private (Student)
router.get('/resources', protect, checkStudentDefaultPassword, checkStudentProfile, protectStudent, getResourcesPage);

// Student Logout
router.get('/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
        secure: process.env.NODE_ENV === 'production'
    });
    res.redirect('/student/login?success=You have been logged out.');
});


module.exports = router;
