const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/customer/customerController');
const { authCustomer } = require('../../middleware/authMiddleware');

// @route   GET /portal/customer/dashboard
// @desc    Display customer dashboard
// @access  Private (Customer only)
router.get('/dashboard', authCustomer, customerController.renderDashboard);

// @route   GET /portal/customer/profile/edit
// @desc    Display form to edit customer profile
// @access  Private (Customer only)
router.get('/profile/edit', authCustomer, customerController.renderEditProfileForm);

// @route   POST /portal/customer/profile/edit
// @desc    Update customer profile information
// @access  Private (Customer only)
router.post('/profile/edit', authCustomer, customerController.updateProfile);

// @route   GET /portal/customer/subscription
// @desc    Display customer subscription status and payment history
// @access  Private (Customer only)
router.get('/subscription', authCustomer, customerController.renderSubscriptionPage);

// @route   GET /portal/customer/pay
// @desc    Display payment instructions and form to submit transaction code
// @access  Private (Customer only)
router.get('/pay', authCustomer, customerController.renderMakePaymentPage);

// @route   POST /portal/customer/pay/submit-code
// @desc    Handle submission of Mpesa transaction code
// @access  Private (Customer only)
router.post('/pay/submit-code', authCustomer, customerController.handleSubmitPaymentCode);


// Future routes for this file:


module.exports = router;
