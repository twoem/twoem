const express = require('express');
const router = express.Router();
const authCustomerController = require('../controllers/authCustomerController');
const customerController = require('../controllers/customerController');
const { authCustomer } = require('../middleware/authMiddleware'); // Import customer auth middleware
// const customerValidators = require('../middleware/validators/customerValidators'); // For future input validations

// --- Publicly Accessible Customer Routes (No Auth Required) ---

// GET Customer login page
router.get('/login', authCustomerController.renderCustomerLoginPage);

// POST Customer login
router.post('/login', authCustomerController.loginCustomer); // Add validators later if needed

// POST Customer Forgot Password
router.post('/forgot-password', authCustomerController.handleForgotPassword); // Add validators later

// GET Customer Reset Password Form (e.g., from email link or after OTP request)
router.get('/reset-password-form', authCustomerController.renderResetPasswordForm);

// POST Customer Reset Password (submit OTP and new password)
router.post('/reset-password', authCustomerController.handleResetPassword); // Add validators later

// --- Protected Customer Routes (Auth Required) ---

// GET Customer Dashboard
router.get('/dashboard', authCustomer, customerController.renderDashboard);

// POST Customer logout
router.post('/logout', authCustomer, authCustomerController.logoutCustomer);

// GET Initial Password Change Form (if required_password_change is true)
router.get('/change-password-initial', authCustomer, authCustomerController.renderChangePasswordInitialForm);
// POST Initial Password Change
router.post('/change-password-initial', authCustomer, /*customerValidators.validatePasswordChange,*/ authCustomerController.handleChangePasswordInitial);


// GET Internet Subscription Status
router.get('/internet-subscription-status', authCustomer, customerController.renderSubscriptionStatus);

// GET Make Payment Page (Instructions + M-PESA code submission form)
router.get('/make-payment', authCustomer, customerController.renderMakePaymentPage);
// POST Submit M-PESA transaction code for notification
router.post('/submit-payment-code', authCustomer, /*customerValidators.validateMpesaCode,*/ customerController.handlePaymentNotification);


// GET Customer Profile Update Form (Placeholder)
// router.get('/profile/edit', authCustomer, customerController.renderUpdateProfileForm);
// POST Customer Profile Update (Placeholder)
// router.post('/profile/edit', authCustomer, /*customerValidators.validateProfileUpdate,*/ customerController.handleUpdateProfile);

// GET Customer Change Password Form (Regular)
// router.get('/profile/change-password', authCustomer, authCustomerController.renderChangePasswordForm);
// POST Customer Change Password (Regular)
// router.post('/profile/change-password', authCustomer, /*customerValidators.validatePasswordChange,*/ authCustomerController.handleChangePassword);


module.exports = router;
