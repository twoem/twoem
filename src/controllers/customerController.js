const Customer = require('../models/customerModel');
// Add other necessary imports like mongoose, validator if needed for future functions

// Render Customer Dashboard
exports.renderDashboard = async (req, res) => {
    try {
        // The customerId is attached to req by the authCustomer middleware
        const customer = await Customer.findById(req.customerId)
            .populate('paymentLogs.approvedBy', 'name') // Example: if you want admin name for payment logs
            .lean(); // Use .lean() for faster queries if you don't need Mongoose documents features in template

        if (!customer) {
            req.flash('error', 'Customer data not found. Please login again.');
            return res.redirect('/portal/customer/login');
        }

        // Ensure paymentLogs is sorted, most recent first, if not handled by schema/query default
        if (customer.paymentLogs) {
            customer.paymentLogs.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        }


        const errorMessages = req.flash('error');
        const successMessages = req.flash('success');
        const infoMessages = req.flash('info');

        res.render('pages/customer/dashboard', {
            title: 'Dashboard',
            customer: customer,
            messages: {
                error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
                success: successMessages.length > 0 ? successMessages.join('<br>') : null,
                info: infoMessages.length > 0 ? infoMessages.join('<br>') : null
            }
        });
    } catch (err) {
        console.error('Error rendering customer dashboard:', err);
        req.flash('error', 'An error occurred while loading your dashboard.');
        res.redirect('/portal/customer/login'); // Redirect to login on error
    }
};

const validator = require('validator'); // Ensure validator is available

// Render Edit Profile Form
exports.renderEditProfileForm = async (req, res) => {
    try {
        const customer = await Customer.findById(req.customerId).lean();
        if (!customer) {
            req.flash('error', 'Customer not found.');
            return res.redirect('/portal/customer/dashboard');
        }

        const formData = req.flash('formData');
        const errorMessages = req.flash('error');
        const successMessages = req.flash('success');

        res.render('pages/customer/updateProfile', {
            title: 'Update Profile',
            customer: customer,
            formData: formData.length > 0 ? formData[0] : {},
            messages: {
                error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
                success: successMessages.length > 0 ? successMessages.join('<br>') : null
            }
        });
    } catch (err) {
        console.error('Error rendering edit profile form:', err);
        req.flash('error', 'An error occurred while loading the profile form.');
        res.redirect('/portal/customer/dashboard');
    }
};

// Update Customer Profile
exports.updateProfile = async (req, res) => {
    const { email, phoneNumber, location } = req.body;
    const customerId = req.customerId;

    req.flash('formData', req.body); // Flash input data for repopulation on error

    // Validation
    const errors = [];
    if (!email || !validator.isEmail(email)) {
        errors.push('A valid email address is required.');
    }
    if (!phoneNumber || !/^(0[17])\d{8}$/.test(phoneNumber)) {
        errors.push('A valid 10-digit phone number (starting with 01 or 07) is required.');
    }
    if (!location || location.trim() === '') {
        errors.push('Location is required.');
    }

    if (errors.length > 0) {
        req.flash('error', errors.join('<br>'));
        return res.redirect('/portal/customer/profile/edit');
    }

    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            req.flash('error', 'Customer not found.');
            return res.redirect('/portal/customer/dashboard');
        }

        // Check if email or phone number is being changed to one that already exists for another user
        if (email.toLowerCase() !== customer.email) {
            const existingEmail = await Customer.findOne({ email: email.toLowerCase(), _id: { $ne: customerId } });
            if (existingEmail) {
                req.flash('error', 'This email address is already in use by another account.');
                return res.redirect('/portal/customer/profile/edit');
            }
            customer.email = email.toLowerCase();
        }

        if (phoneNumber !== customer.phoneNumber) {
            const existingPhone = await Customer.findOne({ phoneNumber: phoneNumber, _id: { $ne: customerId } });
            if (existingPhone) {
                req.flash('error', 'This phone number is already in use by another account.');
                return res.redirect('/portal/customer/profile/edit');
            }
            customer.phoneNumber = phoneNumber;
        }

        customer.location = location;
        // customer.updatedAt = Date.now(); // Handled by Mongoose timestamps: true

        await customer.save();

        req.flash('formData', {}); // Clear flashed data on success
        req.flash('success', 'Profile updated successfully!');
        res.redirect('/portal/customer/profile/edit');

    } catch (err) {
        console.error('Error updating customer profile:', err);
        let errorMsg = 'An error occurred while updating your profile.';
        if (err.name === 'ValidationError') {
            errorMsg = Object.values(err.errors).map(e => e.message).join('<br>');
        } else if (err.code === 11000) {
            errorMsg = 'The email or phone number you entered is already associated with another account.';
        }
        req.flash('error', errorMsg);
        res.redirect('/portal/customer/profile/edit');
    }
};


// Placeholder for future controller functions:
exports.renderSubscriptionPage = async (req, res) => {
    try {
        const customer = await Customer.findById(req.customerId)
            .populate('paymentLogs.approvedBy', 'name') // Populate admin name if available
            .lean();

        if (!customer) {
            req.flash('error', 'Customer data not found. Please login again.');
            return res.redirect('/portal/customer/login');
        }

        // Ensure paymentLogs is sorted, most recent first
        if (customer.paymentLogs) {
            customer.paymentLogs.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        }

        res.render('pages/customer/subscriptionStatus', {
            title: 'Subscription Status',
            customer: customer,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            }
        });
    } catch (err) {
        console.error('Error rendering subscription status page:', err);
        req.flash('error', 'An error occurred while loading your subscription details.');
        res.redirect('/portal/customer/dashboard');
    }
};

const { sendEmailWithTemplate } = require('../config/mailer'); // Import email utility

// Render Make Payment Page
exports.renderMakePaymentPage = async (req, res) => {
    try {
        const customer = await Customer.findById(req.customerId).lean();
        if (!customer) {
            req.flash('error', 'Customer not found.');
            return res.redirect('/portal/customer/dashboard');
        }

        const formData = req.flash('formData');
        const errorMessages = req.flash('error');
        const successMessages = req.flash('success');
        const infoMessages = req.flash('info');


        res.render('pages/customer/makePayment', {
            title: 'Make Payment',
            customer: customer,
            BUSINESS_NO: process.env.BUSINESS_NO, // Pass Business Number from .env
            formData: formData.length > 0 ? formData[0] : {},
            messages: {
                error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
                success: successMessages.length > 0 ? successMessages.join('<br>') : null,
                info: infoMessages.length > 0 ? infoMessages.join('<br>') : null
            }
        });
    } catch (err) {
        console.error('Error rendering make payment page:', err);
        req.flash('error', 'An error occurred while loading the payment page.');
        res.redirect('/portal/customer/dashboard');
    }
};

// Handle Submit Mpesa Transaction Code
exports.handleSubmitPaymentCode = async (req, res) => {
    const { transactionCode } = req.body;
    const customerId = req.customerId;

    req.flash('formData', { transactionCode });


    if (!transactionCode || transactionCode.trim() === '') {
        req.flash('error', 'Mpesa transaction code/message is required.');
        return res.redirect('/portal/customer/pay');
    }

    try {
        const customer = await Customer.findById(customerId).lean();
        if (!customer) {
            req.flash('error', 'Customer not found. Please login again.');
            return res.redirect('/portal/customer/login');
        }

        // Send email to admin
        const adminEmail = process.env.CONTACT_RECEIVER_EMAIL;
        if (!adminEmail) {
            console.error('Admin contact email (CONTACT_RECEIVER_EMAIL) not configured in .env');
            req.flash('error', 'Payment submission failed. System configuration error. Please contact support.');
            return res.redirect('/portal/customer/pay');
        }

        await sendEmailWithTemplate({
            to: adminEmail,
            subject: `Mpesa Payment Submission - Acc: ${customer.accountNumber}`,
            templateName: 'mpesaCodeSubmission', // The new EJS template
            data: {
                customerName: `${customer.firstName} ${customer.lastName}`,
                accountNumber: customer.accountNumber,
                phoneNumber: customer.phoneNumber,
                accountDueAmount: customer.currentBalance, // Current balance before this payment
                mpesaCode: transactionCode.trim(),
                siteUrl: process.env.FRONTEND_URL || 'https://twoemcyberkagwe.onrender.com' // Added siteUrl
            },
            replyTo: customer.email // Optional: set customer's email as reply-to
        });

        req.flash('formData', {}); // Clear form data on success
        req.flash('success', 'Your Mpesa transaction code has been submitted successfully! Our team will verify it shortly and update your account.');
        res.redirect('/portal/customer/pay');

    } catch (err) {
        console.error('Error submitting Mpesa code:', err);
        req.flash('error', 'An error occurred while submitting your transaction code. Please try again or contact support.');
        res.redirect('/portal/customer/pay');
    }
};
