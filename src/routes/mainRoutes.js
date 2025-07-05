// src/routes/mainRoutes.js
const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');
const customerPortalController = require('../controllers/customerPortalController');
const studentPortalController = require('../controllers/studentPortalController');
const adminPortalController = require('../controllers/adminPortalController');

// Home page route
router.get('/', mainController.renderHomePage);

// Contact page routes
router.get('/contact', mainController.renderContactPage);
router.post('/contact/send', mainController.handleContactForm);

// Routes for other main pages
router.get('/services', mainController.renderServicesPage);
router.get('/downloads', mainController.renderDownloadsPage);
router.get('/gallery', mainController.renderGalleryPage);
router.get('/data-protection', mainController.renderDataProtectionPage);

// Route for download redirection
router.get('/redirect', mainController.handleRedirect);

// Portal Routes
// GET routes for portal landing/dashboard (will redirect to login for now)
router.get('/portals/customer', customerPortalController.renderCustomerPortal); // Should ideally render a dashboard or redirect
router.get('/portals/student', studentPortalController.renderStudentPortal);   // Should ideally render a dashboard or redirect
router.get('/portals/admin', adminPortalController.renderAdminPortal);     // Should ideally render a dashboard or redirect

// GET routes for login pages
router.get('/portals/customer/login', customerPortalController.renderLogin);
router.get('/portals/student/login', studentPortalController.renderLogin);
router.get('/portals/admin/login', adminPortalController.renderLogin);

// POST routes for login attempts
router.post('/portals/customer/login', customerPortalController.handleLogin);
router.post('/portals/student/login', studentPortalController.handleLogin);
router.post('/portals/admin/login', adminPortalController.handleLogin);

// POST routes for student portal specific forms
router.post('/portals/student/forgot-password', studentPortalController.handleForgotPassword);
router.post('/portals/student/retrieve-credentials', studentPortalController.handleRetrieveCredentials);

// Customer Password Management Routes
router.get('/portals/customer/change-password', customerPortalController.renderChangePasswordForm);
router.post('/portals/customer/change-password', customerPortalController.handleChangePassword);

// Customer Forgot Password Routes
router.get('/portals/customer/forgot-password', customerPortalController.renderForgotPasswordForm);
router.post('/portals/customer/forgot-password', customerPortalController.handleForgotPassword);
router.get('/portals/customer/reset-password', customerPortalController.renderResetPasswordForm); // Page to enter OTP & new pass
router.post('/portals/customer/reset-password', customerPortalController.handleResetPassword);

// Customer Make Payment Routes
router.get('/portals/customer/makepayment', customerPortalController.renderMakePaymentPage);
router.post('/portals/customer/submit-payment-confirmation', customerPortalController.handleSubmitPaymentConfirmation);

// Student Password Management Routes
router.get('/portals/student/change-password', studentPortalController.renderStudentChangePasswordForm);
router.post('/portals/student/change-password', studentPortalController.handleStudentChangePassword);

// Student Reset Password Routes
router.get('/portals/student/reset-password', studentPortalController.renderStudentResetPasswordForm); // Takes ?token=... query param
router.post('/portals/student/reset-password', studentPortalController.handleStudentResetPassword);

// Student Academics Route
router.get('/portals/student/academics', studentPortalController.renderAcademicsPage);

// Student Financial Route
router.get('/portals/student/financial', studentPortalController.renderFinancialPage);

// Student Resources Route
router.get('/portals/student/resources', studentPortalController.renderResourcesPage);

// Admin - Student Management Routes
router.get('/portals/admin/students', adminPortalController.renderStudentListPage);
router.get('/portals/admin/students/register', adminPortalController.renderRegisterStudentForm);
router.post('/portals/admin/students/register', adminPortalController.handleRegisterStudent);
// More student management routes (edit, view, etc.) will be added here.


module.exports = router;
