// src/controllers/customerPortalController.js
const Customer = require('../models/customerModel');
const bcrypt = require('bcryptjs'); // Only if comparing default password directly, model handles hashing

/**
 * Renders the main customer portal page.
 * For now, this might be a dashboard or a welcome page after login.
 * Placeholder directs to login.
 */
exports.renderCustomerPortal = (req, res) => {
    // If user is logged in, render dashboard, else redirect to login
    // For now, let's assume we always show a generic landing or redirect to login.
    // This will be replaced by actual dashboard rendering later.
    // res.render('pages/customer/dashboard', { title: 'Customer Dashboard' });
    res.redirect('/portals/customer/login');
};

/**
 * Renders the customer login page.
 */
exports.renderLogin = (req, res) => {
    // The existing EJS file is a full HTML document.
    res.render('pages/customer/login', {
        title: 'Customer Portal | Login',
        messages: req.flash(), // Pass flash messages
        formData: req.body // Repopulate form on error
    });
};

/**
 * Handles customer login submission.
 */
exports.handleLogin = async (req, res) => {
    const { loginIdentifier, password } = req.body;

    if (!loginIdentifier || !password) {
        req.flash('error_msg', 'Please enter both identifier and password.');
        return res.redirect('/portals/customer/login');
    }

    try {
        const customer = await Customer.findOne({
            $or: [
                { accountNumber: loginIdentifier },
                { email: loginIdentifier.toLowerCase() },
                { phoneNumber: loginIdentifier }
            ]
        }).select('+password'); // Explicitly select password

        if (!customer) {
            req.flash('error_msg', 'Invalid credentials. Please try again.');
            return res.redirect('/portals/customer/login');
        }

        // Check if it's the first login and if the provided password is the default one
        if (customer.firstLogin) {
            // Compare plaintext default password (from .env) with provided password
            // IMPORTANT: This is a specific case for default password.
            // Normally, we'd use bcrypt.compare for hashed passwords.
            const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || 'Mynet@2020';
            if (password === defaultPassword) {
                // Temporarily store customer ID in session to proceed to change password
                req.session.tempCustomerId = customer._id;
                req.flash('info_msg', 'Welcome! Please change your default password to continue.');
                return res.redirect('/portals/customer/change-password');
            }
        }

        // For subsequent logins, or if firstLogin is true but a different password was entered (should fail here)
        const isMatch = await customer.correctPassword(password, customer.password);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid credentials. Please try again.');
            return res.redirect('/portals/customer/login');
        }

        // If it was a firstLogin attempt but the password was NOT the default, it should have been caught by isMatch.
        // However, if somehow they passed isMatch but still have firstLogin = true (e.g. admin reset), force change.
        if (customer.firstLogin) {
             req.session.tempCustomerId = customer._id; // Still need to change password
             req.flash('info_msg', 'Security update required. Please change your password.');
             return res.redirect('/portals/customer/change-password');
        }

        // --- Successful Login ---
        customer.lastLoginAt = new Date();
        await customer.save({ validateBeforeSave: false }); // Save last login time

        req.session.customerId = customer._id;
        req.session.userType = 'customer';

        req.flash('success_msg', 'You are now logged in.');
        res.redirect('/portals/customer/dashboard'); // To be created

    } catch (error) {
        console.error('Customer login error:', error);
        req.flash('error_msg', 'An error occurred during login. Please try again.');
        res.redirect('/portals/customer/login');
    }
};

/**
 * Renders the Make Payment page.
 */
exports.renderMakePaymentPage = async (req, res) => {
    if (!req.session.customerId || req.session.userType !== 'customer') {
        req.flash('error_msg', 'Please login to make a payment.');
        return res.redirect('/portals/customer/login');
    }

    try {
        const customer = await Customer.findById(req.session.customerId).select('accountNumber currentBalance firstName');
        if (!customer) {
            req.flash('error_msg', 'Could not find your account. Please login again.');
            delete req.session.customerId;
            delete req.session.userType;
            return res.redirect('/portals/customer/login');
        }

        const mpesaPaybill = process.env.BUSINESS_NO || 'YOUR_PAYBILL'; // From .env

        res.render('pages/customer/makePayment', { // Assuming this EJS file exists or will be created
            title: 'Make Payment',
            customerName: customer.firstName, // For layout greeting
            customer: customer, // For accountNumber, currentBalance
            mpesaPaybill: mpesaPaybill,
            messages: req.flash(),
            layout: 'layouts/portal-customer'
        });

    } catch (error) {
        console.error('Error rendering make payment page:', error);
        req.flash('error_msg', 'An error occurred while loading the payment page.');
        res.redirect('/portals/customer/dashboard');
    }
};

/**
 * Handles the submission of a payment confirmation by the customer.
 */
exports.handleSubmitPaymentConfirmation = async (req, res) => {
    if (!req.session.customerId || req.session.userType !== 'customer') {
        req.flash('error_msg', 'Please login to submit payment confirmation.');
        return res.redirect('/portals/customer/login');
    }

    const { confirmationCode, paymentAmount } = req.body;

    if (!confirmationCode || !paymentAmount) {
        req.flash('error_msg', 'Please provide both confirmation code and payment amount.');
        return res.redirect('/portals/customer/makepayment');
    }

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        req.flash('error_msg', 'Invalid payment amount.');
        return res.redirect('/portals/customer/makepayment');
    }

    try {
        const customer = await Customer.findById(req.session.customerId);
        if (!customer) {
            req.flash('error_msg', 'Could not find your account. Please login again.');
            delete req.session.customerId;
            delete req.session.userType;
            return res.redirect('/portals/customer/login');
        }

        // Create a new payment log entry for user submission
        const newPaymentLog = {
            paymentDate: new Date(), // Date of submission
            mode: 'Mpesa', // Assuming Mpesa for now as per instructions
            amount: 0, // Actual amount is in userSubmittedAmount, admin will confirm
            userSubmittedConfirmationCode: confirmationCode,
            userSubmittedAmount: parsedAmount,
            isUserSubmission: true,
            verificationStatus: 'pending_verification',
            // approvedBy and approvalDate will be set by admin
        };

        customer.paymentLogs.push(newPaymentLog);
        await customer.save();

        // Optionally, send an email notification to admin about this submission
        // await sendEmailToAdmin('New Payment Confirmation', `Customer ${customer.accountNumber} submitted payment: ${confirmationCode}, Amount: ${parsedAmount}`);

        req.flash('success_msg', 'Your payment confirmation has been submitted successfully. It will be verified by an admin shortly.');
        res.redirect('/portals/customer/makepayment');

    } catch (error) {
        console.error('Error submitting payment confirmation:', error);
        if (error.name === 'ValidationError') {
            let messages = [];
            for (let field in error.errors) { messages.push(error.errors[field].message); }
            req.flash('error_msg', messages.join(', '));
        } else {
            req.flash('error_msg', 'An error occurred while submitting your payment confirmation.');
        }
        res.redirect('/portals/customer/makepayment');
    }
};


/**
 * Renders the change password form.
 */
exports.renderChangePasswordForm = async (req, res) => {
    // If accessed via first login flow, tempCustomerId will be in session
    // Otherwise, this route might need protection to ensure a logged-in user is changing their own password
    let customerDetails = null;
    if (req.session.tempCustomerId) {
        customerDetails = { firstLogin: true }; // Simplified, actual customer data could be fetched if needed
    } else if (req.session.customerId) {
        // This case would be for a logged-in user changing their password, not first-time
        // customerDetails = await Customer.findById(req.session.customerId).select('firstLogin');
        // For now, assume this route is primarily for the firstLogin flow from tempCustomerId
    }

    if (!req.session.tempCustomerId && !req.session.customerId) {
         req.flash('error_msg', 'You must be logged in to change your password.');
         return res.redirect('/portals/customer/login');
    }

    res.render('pages/customer/changePassword', {
        title: 'Change Password',
        messages: req.flash(),
        customer: customerDetails, // Pass customer firstLogin status to the template
        CUSTOMER_PASSWORD_MIN_LENGTH: process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8
    });
};

/**
 * Handles submission of the change password form.
 */
exports.handleChangePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const customerId = req.session.tempCustomerId || req.session.customerId;

    if (!customerId) {
        req.flash('error_msg', 'Session expired or invalid. Please login again.');
        return res.redirect('/portals/customer/login');
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        req.flash('error_msg', 'Please fill in all password fields.');
        return res.redirect('/portals/customer/change-password');
    }

    if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New passwords do not match.');
        return res.redirect('/portals/customer/change-password');
    }

    if (newPassword.length < (parseInt(process.env.CUSTOMER_PASSWORD_MIN_LENGTH) || 8)) {
        req.flash('error_msg', `Password must be at least ${process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8} characters long.`);
        return res.redirect('/portals/customer/change-password');
    }

    try {
        const customer = await Customer.findById(customerId).select('+password');
        if (!customer) {
            req.flash('error_msg', 'User not found. Please login again.');
            delete req.session.tempCustomerId; // Clean up temp session
            delete req.session.customerId;
            return res.redirect('/portals/customer/login');
        }

        let isCurrentPasswordCorrect = false;
        if (customer.firstLogin || req.session.tempCustomerId) { // Check if it's the initial default password change
            const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || 'Mynet@2020';
            isCurrentPasswordCorrect = (currentPassword === defaultPassword);
            if (newPassword === defaultPassword) {
                 req.flash('error_msg', 'New password cannot be the same as the default password.');
                 return res.redirect('/portals/customer/change-password');
            }
        } else { // For regular password changes by an already active user
            isCurrentPasswordCorrect = await customer.correctPassword(currentPassword, customer.password);
        }

        if (!isCurrentPasswordCorrect) {
            req.flash('error_msg', 'Incorrect current password.');
            return res.redirect('/portals/customer/change-password');
        }

        customer.password = newPassword; // Mongoose pre-save hook will hash it
        customer.firstLogin = false;
        customer.passwordChangedAt = Date.now(); // Manually set
        customer.lastLoginAt = new Date(); // Set last login on successful first password change
        await customer.save();

        delete req.session.tempCustomerId; // Clean up temp session variable

        // Establish permanent session if it was a first login
        req.session.customerId = customer._id;
        req.session.userType = 'customer';

        req.flash('success_msg', 'Password changed successfully. You are now logged in.');
        res.redirect('/portals/customer/dashboard'); // To be created

    } catch (error) {
        console.error('Change password error:', error);
        // Check for Mongoose validation error (e.g. password length if not caught above)
        if (error.name === 'ValidationError') {
            let messages = [];
            for (let field in error.errors) {
                messages.push(error.errors[field].message);
            }
            req.flash('error_msg', messages.join(', '));
        } else {
            req.flash('error_msg', 'An error occurred while changing your password.');
        }
        res.redirect('/portals/customer/change-password');
    }
};

const crypto = require('crypto');
const { sendEmailWithTemplate } = require('../config/mailer'); // Assuming mailer is configured

// ... (keep existing methods like renderLogin, handleLogin, renderChangePasswordForm, handleChangePassword)

/**
 * Renders the forgot password form.
 */
exports.renderForgotPasswordForm = (req, res) => {
    res.render('pages/customer/forgotPassword', {
        title: 'Forgot Password',
        messages: req.flash(),
        formData: {} // Or pass req.body if repopulating on error
    });
};

/**
 * Handles forgot password submission.
 * Sends an OTP to the customer's email.
 */
exports.handleForgotPassword = async (req, res) => {
    const { phoneNumber, anyName } = req.body;

    if (!phoneNumber || !anyName) {
        req.flash('error_msg', 'Please provide both phone number and a name.');
        return res.redirect('/portals/customer/forgot-password');
    }

    try {
        const customer = await Customer.findOne({ phoneNumber: phoneNumber });

        if (!customer) {
            req.flash('error_msg', 'No account found with that phone number.');
            return res.redirect('/portals/customer/forgot-password');
        }

        // Check if anyName matches any of the customer's names (case-insensitive)
        const nameLower = anyName.toLowerCase();
        const isNameMatch = (customer.firstName && customer.firstName.toLowerCase() === nameLower) ||
                            (customer.secondName && customer.secondName.toLowerCase() === nameLower) ||
                            (customer.lastName && customer.lastName.toLowerCase() === nameLower);

        if (!isNameMatch) {
            req.flash('error_msg', 'The provided name does not match our records for this phone number.');
            return res.redirect('/portals/customer/forgot-password');
        }

        const resetOTP = customer.createPasswordResetToken(); // Get the raw OTP
        await customer.save({ validateBeforeSave: false }); // Save the hashed OTP and expiry to DB

        // Send email with OTP
        const emailData = {
            customerName: customer.firstName,
            otp: resetOTP,
            otpExpiryMinutes: 10, // Matches model
            siteUrl: process.env.FRONTEND_URL || 'http://localhost:' + (process.env.PORT || 3000),
            resetUrl: `${process.env.FRONTEND_URL || ''}/portals/customer/reset-password`, // Generic link
            logoUrl: process.env.EMAIL_LOGO_URL
        };

        await sendEmailWithTemplate({
            to: customer.email,
            subject: 'Your Password Reset OTP',
            templateName: 'customerPasswordResetOtp', // Needs this EJS template
            data: emailData
        });

        req.flash('success_msg', 'An OTP has been sent to your registered email address. Please check your inbox (and spam folder).');
        res.redirect('/portals/customer/forgot-password'); // Or redirect to OTP entry page with email prefilled?

    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error_msg', 'An error occurred. Please try again.');
        res.redirect('/portals/customer/forgot-password');
    }
};

/**
 * Renders the form to enter OTP and new password.
 */
exports.renderResetPasswordForm = (req, res) => {
    res.render('pages/customer/resetPasswordWithOtpForm', { // New EJS file needed
        title: 'Reset Your Password',
        messages: req.flash(),
        loginIdentifier: req.query.email || req.query.accountNumber || '', // Optional: prefill from query
        CUSTOMER_PASSWORD_MIN_LENGTH: process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8
    });
};

/**
 * Handles submission of the reset password form (with OTP).
 */
exports.handleResetPassword = async (req, res) => {
    const { loginIdentifier, otp, newPassword, confirmNewPassword } = req.body;

    if (!loginIdentifier || !otp || !newPassword || !confirmNewPassword) {
        req.flash('error_msg', 'Please fill in all fields.');
        return res.redirect('/portals/customer/reset-password');
    }

    if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New passwords do not match.');
        return res.redirect('/portals/customer/reset-password');
    }

    if (newPassword.length < (parseInt(process.env.CUSTOMER_PASSWORD_MIN_LENGTH) || 8)) {
        req.flash('error_msg', `Password must be at least ${process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8} characters long.`);
        return res.redirect('/portals/customer/reset-password');
    }

    try {
        const customer = await Customer.findOne({
            $or: [
                { accountNumber: loginIdentifier },
                { email: loginIdentifier.toLowerCase() },
                { phoneNumber: loginIdentifier } // Less likely to be used here if email/acc no. is primary ID for reset
            ]
        }).select('+password +passwordResetToken +passwordResetExpires'); // Select necessary fields

        if (!customer) {
            req.flash('error_msg', 'Invalid identifier or OTP.');
            return res.redirect('/portals/customer/reset-password');
        }

        const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

        if (customer.passwordResetToken !== hashedOTP || customer.passwordResetExpires < Date.now()) {
            req.flash('error_msg', 'Invalid or expired OTP. Please request a new one.');
            customer.passwordResetToken = undefined; // Clear token on failure
            customer.passwordResetExpires = undefined;
            await customer.save({ validateBeforeSave: false });
            return res.redirect('/portals/customer/reset-password');
        }

        customer.password = newPassword; // Hook will hash
        customer.firstLogin = false;
        customer.passwordChangedAt = Date.now();
        customer.passwordResetToken = undefined;
        customer.passwordResetExpires = undefined;
        await customer.save();

        // Log the user in
        req.session.customerId = customer._id;
        req.session.userType = 'customer';

        req.flash('success_msg', 'Your password has been reset successfully. You are now logged in.');
        res.redirect('/portals/customer/dashboard');

    } catch (error) {
        console.error('Reset password error:', error);
        if (error.name === 'ValidationError') {
            let messages = [];
            for (let field in error.errors) { messages.push(error.errors[field].message); }
            req.flash('error_msg', messages.join(', '));
        } else {
            req.flash('error_msg', 'An error occurred. Please try again.');
        }
        res.redirect('/portals/customer/reset-password');
    }
};

/**
 * Renders the customer dashboard.
 */
exports.renderDashboard = async (req, res) => {
    if (!req.session.customerId || req.session.userType !== 'customer') {
        req.flash('error_msg', 'Please login to view the dashboard.');
        return res.redirect('/portals/customer/login');
    }

    try {
        const customer = await Customer.findById(req.session.customerId)
            .populate({ // If paymentLogs had an 'approvedBy' admin ref and you wanted their name
                path: 'paymentLogs.approvedBy',
                select: 'name' // Assuming Admin model has a 'name' field
            });

        if (!customer) {
            req.flash('error_msg', 'Could not find your account. Please login again.');
            delete req.session.customerId;
            delete req.session.userType;
            return res.redirect('/portals/customer/login');
        }

        // Calculate Last Payment Date
        let lastPaymentDate = null;
        if (customer.paymentLogs && customer.paymentLogs.length > 0) {
            // Sort by paymentDate descending to get the latest
            const sortedPayments = [...customer.paymentLogs].sort((a, b) => b.paymentDate - a.paymentDate);
            // Assuming we only want to show approved payments, filter if 'approvedBy' or similar field exists and is set
            // For now, just taking the latest payment log entry.
            if (sortedPayments.length > 0) {
                 lastPaymentDate = sortedPayments[0].paymentDate;
            }
        }

        // Placeholder for notifications - this will need a proper implementation
        const notifications = [
            // { id: 1, title: "Scheduled Maintenance", message: "Our portal will be down for maintenance on Sunday at 2 AM.", date: new Date() },
            // { id: 2, title: "New Payment Options", message: "We now support direct bank transfers. Check the Make Payment page.", date: new Date(Date.now() - 86400000) }
        ];


        res.render('pages/customer/dashboard', {
            title: 'Customer Dashboard',
            customer: customer,
            lastPaymentDate: lastPaymentDate,
            notifications: notifications, // Pass notifications to the view
            currentDate: new Date(),
            layout: 'layouts/portal-customer' // Use the new customer portal layout
        });

    } catch (error) {
        console.error('Error rendering customer dashboard:', error);
        req.flash('error_msg', 'An error occurred while loading your dashboard.');
        res.redirect('/portals/customer/login');
    }
};
