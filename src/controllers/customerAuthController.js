const Customer = require('../models/customerModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');

// Render Customer Login Page
exports.renderCustomerLoginPage = (req, res) => {
    const formData = req.flash('formData');
    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');

    res.render('pages/customer/login', {
        title: 'Customer Login',
        messages: {
            error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
            success: successMessages.length > 0 ? successMessages.join('<br>') : null
        },
        formData: formData.length > 0 ? formData[0] : {}
    });
};

// Login Customer
exports.loginCustomer = async (req, res) => {
    const { loginIdentifier, password } = req.body;
    req.flash('formData', { loginIdentifier }); // Flash identifier back

    if (!loginIdentifier || !password) {
        req.flash('error', 'Please provide an identifier and password.');
        return res.redirect('/portal/customer/login');
    }

    try {
        let customer;
        // Determine if loginIdentifier is email, phone, or account number
        if (validator.isEmail(loginIdentifier)) {
            customer = await Customer.findOne({ email: loginIdentifier.toLowerCase() }).select('+password');
        } else if (validator.isMobilePhone(loginIdentifier, 'any', { strictMode: false }) && /^(0[17])\d{8}$/.test(loginIdentifier)) {
            // Basic check for 01/07 followed by 8 digits for phone
            customer = await Customer.findOne({ phoneNumber: loginIdentifier }).select('+password');
        } else {
            // Assume it's an account number
            customer = await Customer.findOne({ accountNumber: loginIdentifier }).select('+password');
        }

        if (!customer) {
            req.flash('error', 'Invalid credentials or customer not found.');
            return res.redirect('/portal/customer/login');
        }

        // Check if account is active
        if (!customer.isActive) {
            req.flash('error', 'Your account is inactive. Please contact support.');
            return res.redirect('/portal/customer/login');
        }

        const isMatch = await customer.correctPassword(password, customer.password);
        if (!isMatch) {
            req.flash('error', 'Invalid credentials.');
            return res.redirect('/portal/customer/login');
        }

        // Generate JWT
        const payload = {
            id: customer._id,
            type: 'customer'
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { // Using main JWT_SECRET for now, can customize for customer
            expiresIn: process.env.JWT_CUSTOMER_EXPIRE || '1h'
        });

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
            maxAge: parseInt(process.env.JWT_CUSTOMER_EXPIRE_MS || '3600000') // e.g. 1 hour
        });

        // Clear flashed form data on successful login
        req.flash('formData', {});


        // Check for first login and redirect to change password if needed
        if (customer.firstLogin) {
            // Store something in session to indicate password change is required
            // req.session.requiresPasswordChange = true; // if using express-session
            req.flash('info', 'Welcome! Please update your default password.'); // Temporary until session setup
            // For now, redirect to dashboard, will implement change password flow next
            // return res.redirect('/portal/customer/change-password');
        }

        req.flash('success', 'Login successful! Welcome to your dashboard.');

        // Check for first login and redirect to change password if needed
        if (customer.firstLogin) {
            req.flash('info', 'Welcome! For your security, please update your default password.');
            return res.redirect('/portal/customer/change-password');
        }

        res.redirect('/portal/customer/dashboard'); // Redirect to customer dashboard

    } catch (err) {
        console.error('Customer login error:', err);
        req.flash('error', 'An error occurred during login. Please try again.');
        res.redirect('/portal/customer/login');
    }
};

// Logout Customer
exports.logoutCustomer = (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0) // Set expiry to past date
    });
    req.flash('success', 'You have been logged out successfully.');
    res.redirect('/portal/customer/login');
};

// Render Change Password Page
exports.renderChangePasswordPage = (req, res) => {
    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');
    const infoMessages = req.flash('info');

    res.render('pages/customer/changePassword', {
        title: 'Change Password',
        messages: {
            error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
            success: successMessages.length > 0 ? successMessages.join('<br>') : null,
            info: infoMessages.length > 0 ? infoMessages.join('<br>') : null
        },
        CUSTOMER_PASSWORD_MIN_LENGTH: process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8
    });
};

// Handle Change Password
exports.handleChangePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const customerId = req.customerId; // From authCustomer middleware

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        req.flash('error', 'Please fill in all fields.');
        return res.redirect('/portal/customer/change-password');
    }

    if (newPassword !== confirmNewPassword) {
        req.flash('error', 'New passwords do not match.');
        return res.redirect('/portal/customer/change-password');
    }

    if (newPassword.length < (parseInt(process.env.CUSTOMER_PASSWORD_MIN_LENGTH) || 8)) {
        req.flash('error', `New password must be at least ${process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8} characters long.`);
        return res.redirect('/portal/customer/change-password');
    }

    try {
        const customer = await Customer.findById(customerId).select('+password');
        if (!customer) {
            req.flash('error', 'Customer not found.');
            // Log out the user as their session might be invalid
            res.clearCookie('token');
            return res.redirect('/portal/customer/login');
        }

        // Verify current password
        const isMatch = await customer.correctPassword(currentPassword, customer.password);
        if (!isMatch) {
            req.flash('error', 'Incorrect current password.');
            return res.redirect('/portal/customer/change-password');
        }

        // Check if the new password is the same as the old default password (if it's the first login)
        // Or if it's the same as the current password if not first login (though this page is primarily for first login)
        if (newPassword === currentPassword || (customer.firstLogin && newPassword === process.env.DEFAULT_CUSTOMER_PASSWORD)) {
             req.flash('error', 'New password cannot be the same as the default or current password.');
             return res.redirect('/portal/customer/change-password');
        }


        customer.password = newPassword; // The pre-save hook in the model will hash it
        customer.firstLogin = false;
        customer.passwordChangedAt = Date.now();
        await customer.save();

        req.flash('success', 'Password updated successfully! You can now use your new password.');
        res.redirect('/portal/customer/dashboard'); // Or login page if re-auth is desired

    } catch (err) {
        console.error('Change password error:', err);
        req.flash('error', 'An error occurred while changing your password.');
        res.redirect('/portal/customer/change-password');
    }
};

const crypto = require('crypto');
const { sendEmailWithTemplate } = require('../config/mailer');


// Render Forgot Password Page
exports.renderForgotPasswordPage = (req, res) => {
    const formData = req.flash('formData');
    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');

    res.render('pages/customer/forgotPassword', {
        title: 'Forgot Password',
        messages: {
            error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
            success: successMessages.length > 0 ? successMessages.join('<br>') : null
        },
        formData: formData.length > 0 ? formData[0] : {}
    });
};

// Handle Forgot Password Request
exports.handleForgotPasswordRequest = async (req, res) => {
    const { phoneNumber, anyName } = req.body;
    req.flash('formData', { phoneNumber, anyName });

    if (!phoneNumber || !anyName) {
        req.flash('error', 'Phone number and a name are required.');
        return res.redirect('/portal/customer/forgot-password');
    }

    if (!/^(0[17])\d{8}$/.test(phoneNumber)) {
        req.flash('error', 'Invalid phone number format.');
        return res.redirect('/portal/customer/forgot-password');
    }

    try {
        const customer = await Customer.findOne({
            phoneNumber: phoneNumber,
            $or: [
                { firstName: new RegExp(`^${anyName}$`, 'i') },
                { secondName: new RegExp(`^${anyName}$`, 'i') },
                { lastName: new RegExp(`^${anyName}$`, 'i') }
            ]
        });

        if (!customer) {
            req.flash('error', 'No account found matching the provided phone number and name. Please check your details and try again.');
            return res.redirect('/portal/customer/forgot-password');
        }

        const otp = customer.createPasswordResetToken(); // This generates and saves the hashed token internally
        await customer.save({ validateBeforeSave: false }); // Skip validation to only save token fields

        // Send email with OTP and reset link
        const resetURL = `${req.protocol}://${req.get('host')}/portal/customer/reset-password/${otp}`; // OTP is used as part of link for simplicity here, or use a different token

        // For a more secure link, you'd generate a separate random token for the URL
        // and the OTP would be for a secondary verification step if the user chooses to enter it.
        // For now, the OTP itself is part of the reset mechanism.
        // The model's createPasswordResetToken method returns the unhashed OTP.

        const emailData = {
            to: customer.email,
            subject: 'Mynet Customer Portal - Password Reset Request',
            templateName: 'customerPasswordReset',
            data: {
                customerName: customer.firstName,
                otp: otp, // The unhashed OTP
                resetLink: resetURL
            }
        };

        await sendEmailWithTemplate(emailData);

        req.flash('success', 'Password reset instructions (including an OTP and a reset link) have been sent to your email address if an account matches. Please check your inbox and spam folder.');
        req.flash('formData', {}); // Clear form
        res.redirect('/portal/customer/forgot-password');

    } catch (err) {
        console.error('Forgot password error:', err);
        // Avoid saving customer if email sending fails, by not calling customer.save() if there's an error after token generation but before email success.
        // The customer.save() above is only for the token fields.
        req.flash('error', 'An error occurred while processing your request. Please try again.');
        res.redirect('/portal/customer/forgot-password');
    }
};


// Render Reset Password Page
exports.renderResetPasswordPage = (req, res) => {
    const { token } = req.params; // This token is the OTP
    const errorMessages = req.flash('error');
    const successMessages = req.flash('success');

    res.render('pages/customer/resetPassword', {
        title: 'Reset Password',
        token: token, // Pass the token (OTP) to prefill the form if desired
        CUSTOMER_PASSWORD_MIN_LENGTH: process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8,
        messages: {
            error: errorMessages.length > 0 ? errorMessages.join('<br>') : null,
            success: successMessages.length > 0 ? successMessages.join('<br>') : null
        }
    });
};

// Handle Reset Password
exports.handleResetPassword = async (req, res) => {
    const { token } = req.params; // This is the raw OTP from the URL
    const { otp, newPassword, confirmNewPassword } = req.body;

    // It's good practice to ensure the OTP from URL matches the one submitted in form,
    // or primarily rely on the one in the form if the URL token is just for page loading.
    // Here, we'll use the 'otp' field from the form body as the primary OTP.
    // The token from URL param is mostly to load the page and can prefill the field.

    if (!otp || !newPassword || !confirmNewPassword) {
        req.flash('error', 'Please fill in OTP, new password, and confirm password.');
        return res.redirect(`/portal/customer/reset-password/${token}`); // Redirect back with original token
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        req.flash('error', 'Invalid OTP format. Must be 6 digits.');
        return res.redirect(`/portal/customer/reset-password/${token}`);
    }

    if (newPassword !== confirmNewPassword) {
        req.flash('error', 'New passwords do not match.');
        return res.redirect(`/portal/customer/reset-password/${token}`);
    }

    if (newPassword.length < (parseInt(process.env.CUSTOMER_PASSWORD_MIN_LENGTH) || 8)) {
        req.flash('error', `New password must be at least ${process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8} characters long.`);
        return res.redirect(`/portal/customer/reset-password/${token}`);
    }

    try {
        // Hash the provided OTP to compare with the stored hashed token
        const hashedOTP = crypto
            .createHash('sha256')
            .update(otp)
            .digest('hex');

        const customer = await Customer.findOne({
            passwordResetToken: hashedOTP,
            passwordResetExpires: { $gt: Date.now() } // Check if token is not expired
        });

        if (!customer) {
            req.flash('error', 'Invalid or expired OTP. Please request a new password reset.');
            return res.redirect('/portal/customer/forgot-password');
        }

        // Set new password and clear reset token fields
        customer.password = newPassword; // Pre-save hook will hash it
        customer.passwordResetToken = undefined;
        customer.passwordResetExpires = undefined;
        customer.firstLogin = false; // Assuming password reset means they've actively set a password
        customer.passwordChangedAt = Date.now();
        await customer.save();

        // Log the customer in (optional, or redirect to login)
        // For simplicity, redirect to login with a success message.
        req.flash('success', 'Your password has been successfully reset! Please login with your new password.');
        res.redirect('/portal/customer/login');

    } catch (err) {
        console.error('Reset password error:', err);
        req.flash('error', 'An error occurred while resetting your password. Please try again.');
        res.redirect(`/portal/customer/reset-password/${token}`);
    }
};
