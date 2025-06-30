const express = require('express');
const router = express.Router();
const customerAuthController = require('../../controllers/customer/customerAuthController');
const { authCustomer } = require('../../middleware/authMiddleware'); // Import the new middleware

// @route   GET /portal/customer/login
// @desc    Render customer login page
// @access  Public
router.get('/login', customerAuthController.renderCustomerLoginPage);

// @route   POST /portal/customer/login
// @desc    Authenticate customer and get token
// @access  Public
router.post('/login', customerAuthController.loginCustomer);

// @route   GET /portal/customer/logout
// @desc    Logout customer
// @access  Private (requires login)
router.get('/logout', customerAuthController.logoutCustomer); // Will add middleware later

// Placeholder for forgot/reset password routes - will be detailed in later steps
// router.get('/forgot-password', customerAuthController.renderForgotPasswordPage);
// router.post('/forgot-password', customerAuthController.handleForgotPassword);
// router.get('/reset-password/:token', customerAuthController.renderResetPasswordPage);
// router.post('/reset-password/:token', customerAuthController.handleResetPassword);

// @route   GET /portal/customer/change-password
// @desc    Render page for customer to change their (default) password
// @access  Private (Customer only)
router.get('/change-password', authCustomer, customerAuthController.renderChangePasswordPage);

// @route   POST /portal/customer/change-password
// @desc    Handle customer password change
// @access  Private (Customer only)
router.post('/change-password', authCustomer, customerAuthController.handleChangePassword);

// @route   GET /portal/customer/forgot-password
// @desc    Render forgot password page
// @access  Public
router.get('/forgot-password', customerAuthController.renderForgotPasswordPage);

// @route   POST /portal/customer/forgot-password
// @desc    Handle forgot password request (send OTP and link)
// @access  Public
router.post('/forgot-password', customerAuthController.handleForgotPasswordRequest);

// @route   GET /portal/customer/reset-password/:token
// @desc    Render reset password page with token (OTP)
// @access  Public
router.get('/reset-password/:token', customerAuthController.renderResetPasswordPage);

// @route   POST /portal/customer/reset-password/:token
// @desc    Handle actual password reset
// @access  Public
router.post('/reset-password/:token', customerAuthController.handleResetPassword);


module.exports = router;
