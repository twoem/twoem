const express = require('express');
const router = express.Router();
const {
    loginCustomer,
    getChangePasswordPage,
    changeDefaultPassword,
    getForgotPasswordPage,
    forgotPassword,
    getResetPasswordPage,
    resetPassword
} = require('../../controllers/authController'); // Corrected path
const { getCustomerDashboard, getMakePaymentPage, submitPaymentConfirmation } = require('../../controllers/customerController'); // Corrected path
const { protect, protectCustomer, checkDefaultPassword } = require('../../middleware/authMiddleware'); // Corrected path

// @route   GET /customer/login
// @desc    Customer login page
// @access  Public
router.get('/login', (req, res) => {
    const error = req.query.error || null;
    const success = req.query.success || null;
    res.render('customer/login', {
        pageTitle: 'Twoem Customers | Login',
        error: error,
        success: success,
        oldInput: {}
    });
});

// @route   POST /customer/login
// @desc    Process customer login
// @access  Public
router.post('/login', loginCustomer);

// @route   GET /customer/change-password
// @desc    Page for customer to change their default password
// @access  Private
router.get('/change-password', protect, protectCustomer, getChangePasswordPage);

// @route   POST /customer/change-password
// @desc    Process customer default password change
// @access  Private
router.post('/change-password', protect, protectCustomer, changeDefaultPassword);

// @route   GET /customer/forgot-password
// @desc    Page for customer to request password reset
// @access  Public
router.get('/forgot-password', getForgotPasswordPage);
router.post('/forgot-password', forgotPassword);

// @route   GET /customer/reset-password(/:token)
// @desc    Page for customer to reset password
// @access  Public
router.get('/reset-password/:token', getResetPasswordPage);
router.get('/reset-password', getResetPasswordPage);
router.post('/reset-password/:token', resetPassword);
router.post('/reset-password', resetPassword);

// @route   GET /customer/dashboard
// @desc    Customer dashboard page
// @access  Private
router.get('/dashboard', protect, protectCustomer, checkDefaultPassword, getCustomerDashboard);

// @route   GET /customer/makepayment
// @desc    Customer make payment page
// @access  Private
router.get('/makepayment', protect, protectCustomer, checkDefaultPassword, getMakePaymentPage);

// @route   POST /customer/submit-payment-confirmation
// @desc    Submit M-Pesa payment confirmation
// @access  Private
router.post('/submit-payment-confirmation', protect, protectCustomer, checkDefaultPassword, submitPaymentConfirmation);

// @route   GET /customer/logout
// @desc    Customer logout
// @access  Public
router.get('/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
        secure: process.env.NODE_ENV === 'production'
    });
    res.redirect('/customer/login?success=You have been logged out.');
});

module.exports = router;
