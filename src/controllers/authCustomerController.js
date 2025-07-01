const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');
const { getJwtSecret } = require('../utils/jwtHelper');
const crypto = require('crypto');
const { sendEmailWithTemplate } = require('../config/mailer');

// Render customer login page
const renderCustomerLoginPage = (req, res) => {
    // If customer is already logged in, redirect to dashboard
    if (req.cookies.customer_auth_token) {
        // A quick check could be added here, or just let them see login.
        // For simplicity, we'll render the login page.
        // authCustomer middleware will protect the dashboard.
    }
    res.render('pages/customer/customer-login', { // Path: views/pages/customer/customer-login.ejs
        title: 'Customer Portal Login',
        // errors: [], // Handled by flash messages
        // oldInput: {}, // Handled by flash messages or direct render
        activeTab: req.query.activeTab || 'login-panel' // For tabbed interface if any
    });
};

// Handle customer login
const loginCustomer = async (req, res) => {
    const { loginIdentifier, password } = req.body;

    if (!loginIdentifier || !password) {
        req.flash('error_msg', '⚠️ Please enter your Phone/Email/Account Number and Password.');
        return res.redirect('/customer/login');
    }

    // Basic validation: if it looks like a phone number, validate its format.
    // More sophisticated type detection (email regex, account number pattern) could be added.
    if (/^\d+$/.test(loginIdentifier) && !/^(0[17])\d{8}$/.test(loginIdentifier)) {
        req.flash('error_msg', '⚠️ Invalid phone number format. Must be 10 digits starting with 01 or 07.');
        return res.redirect('/customer/login');
    }

    try {
        // Try to find customer by phone, email, or account number
        const customer = await db.getAsync(
            "SELECT * FROM customers WHERE phone_number = ? OR email = ? OR account_number = ?",
            [loginIdentifier, loginIdentifier.toLowerCase(), loginIdentifier]
        );

        if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
            req.flash('error_msg', '⚠️Oops! The login details or password seem incorrect. 🧐');
            return res.redirect('/customer/login');
        }

        if (!customer.is_active) {
            req.flash('error_msg', '⚠️ Your account is inactive. Please contact support.');
            return res.redirect('/customer/login');
        }

        // Update last login time (optional, but good practice)
        // await db.runAsync("UPDATE customers SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [customer.id]);

        const tokenPayload = {
            id: customer.id,
            phoneNumber: customer.phone_number,
            email: customer.email,
            firstName: customer.first_name,
            isCustomer: true // Explicitly mark as customer token
        };
        const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: process.env.JWT_CUSTOMER_EXPIRE || '1h' });

        res.cookie('customer_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: parseInt(process.env.JWT_CUSTOMER_EXPIRE_MS || (1 * 60 * 60 * 1000).toString(), 10), // 1 hour
            path: '/', // Cookie available site-wide
            sameSite: 'Lax'
        });

        req.flash('success_msg', '🎉 Welcome Back! 🎉 You’ve successfully logged in🌟');

        if (customer.requires_password_change) {
            req.flash('info_msg', 'Please change your default password to continue.'); // This is an instructional message, not an error/success
            return res.redirect('/customer/change-password-initial');
        }

        res.redirect('/customer/dashboard');

    } catch (err) {
        console.error("Customer login error:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred during login. Please try again. 😔');
        res.redirect('/customer/login');
    }
};

// Handle customer logout
const logoutCustomer = (req, res) => {
    res.cookie('customer_auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(0),
        path: '/',
        sameSite: 'Lax'
    });
    req.flash('success_msg', '✨ Success! ✨ You have been logged out successfully! 🎉');
    res.redirect('/customer/login');
};

// Render initial password change form
const renderChangePasswordInitialForm = (req, res) => {
    res.render('pages/customer/change-password-initial', { // Path: views/pages/customer/change-password-initial.ejs
        title: 'Change Your Password',
        customer: req.customer, // req.customer populated by authCustomer middleware
        // errors: [],
        defaultCustomerPassword: process.env.DEFAULT_CUSTOMER_PASSWORD || "Mynet@2020",
        passwordMinLength: process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8
    });
};

// Handle initial password change
const handleChangePasswordInitial = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const customerId = req.customer.id; // From authCustomer middleware
    const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || "Mynet@2020";
    const minLength = parseInt(process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8, 10);

    // Specific validation errors will get ⚠️ prepended by flash-messages.ejs
    if (currentPassword !== defaultPassword) {
        req.flash('error_msg', 'Incorrect current default password.');
        return res.redirect('/customer/change-password-initial');
    }
    if (!newPassword || newPassword.length < minLength) {
        req.flash('error_msg', `New password must be at least ${minLength} characters long.`);
        return res.redirect('/customer/change-password-initial');
    }
    if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New passwords do not match.');
        return res.redirect('/customer/change-password-initial');
    }
    if (newPassword === defaultPassword) {
        req.flash('error_msg', 'New password cannot be the same as the default password.');
        return res.redirect('/customer/change-password-initial');
    }

    try {
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync(
            "UPDATE customers SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [newPasswordHash, customerId]
        );
        req.flash('success_msg', '✨ Update Successful! ✨ Password changed successfully! 🎉');
        // info_msg for profile completion is handled by login controller if still needed
        res.redirect('/customer/dashboard');
    } catch (err) {
        console.error("Error changing initial customer password:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while changing password. 😔');
        res.redirect('/customer/change-password-initial');
    }
};

// Render forgot password form (can be part of login page or separate)
const renderForgotPasswordForm = (req, res) => {
     // This might be integrated into the login page, or be a separate view.
     // For now, let's assume it's part of 'customer-login.ejs' toggled by a tab/link.
    res.render('pages/customer/customer-login', {
        title: 'Forgot Password',
        activeTab: 'forgot-password-panel' // To show the forgot password section
    });
};

// Handle forgot password submission
const handleForgotPassword = async (req, res) => {
    const anyName = req.body.anyName;
    const phoneNumber = req.body.phoneNumber ? req.body.phoneNumber.trim() : "";
    const errorRedirectUrl = '/customer/login?activeTab=forgot-password-panel#forgot-password-panel';

    if (!phoneNumber || !anyName) {
        req.flash('error_msg', '⚠️ Phone number and one of your names are required.');
        return res.redirect(errorRedirectUrl);
    }
    // Add phone number format validation here too
    if (!/^(0[17])\d{8}$/.test(phoneNumber)) {
        req.flash('error_msg', '⚠️ Invalid phone number format. Must be 10 digits starting with 01 or 07.');
        return res.redirect(errorRedirectUrl);
    }

    try {
        // Find customer by phone and any of the names (first, second, last, or organisation)
        const customer = await db.getAsync(
            `SELECT id, email, first_name, phone_number FROM customers
             WHERE phone_number = ? AND
             (LOWER(first_name) = LOWER(?) OR LOWER(second_name) = LOWER(?) OR LOWER(last_name) = LOWER(?) OR LOWER(organisation_name) = LOWER(?))`,
            [phoneNumber, anyName, anyName, anyName, anyName]
        );

        if (!customer) {
            req.flash('error_msg', '⚠️ No account found matching the provided phone number and name.');
            return res.redirect(errorRedirectUrl);
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const token = crypto.randomBytes(32).toString('hex'); // For unique URL
        const otpHash = await bcrypt.hash(otp, 10);
        const tokenHash = await bcrypt.hash(token, 10); // Store hash of the URL token
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        await db.runAsync(
            "INSERT INTO customer_password_reset_tokens (customer_id, otp_hash, token_hash, expires_at) VALUES (?, ?, ?, ?)",
            [customer.id, otpHash, tokenHash, expiresAt.toISOString()]
        );

        const resetLink = `${req.protocol}://${req.get('host')}/customer/reset-password?token=${token}`;

        console.log(`OTP for ${customer.phone_number}: ${otp}`); // For testing, remove in prod
        console.log(`Reset Link for ${customer.phone_number}: ${resetLink}`); // For testing

        try {
            const emailSubject = "Your Internet Account Password Reset";
            const emailData = {
                customerName: customer.first_name,
                otp: otp,
                resetLink: resetLink
            };
            await sendEmailWithTemplate({
                to: customer.email,
                subject: emailSubject,
                templateName: 'customer-otp-email', // Ensure this template exists
                data: emailData
            });
            req.flash('success_msg', '✅ Email Sent Successfully! 📩 If your account exists, an OTP and reset link have been sent to your email. 🎉');
        } catch (emailError) {
            console.error("Failed to send OTP email to customer:", emailError);
            req.flash('error_msg', '❌ Failed to Send Email ⚠️ Oops! Something went wrong. Password reset initiated, but email failed. Try again Later or contact support. 😔');
        }

        res.redirect(`/customer/reset-password-form?phone=${encodeURIComponent(customer.phone_number)}`);

    } catch (err) {
        console.error("Forgot password error (customer):", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Something went wrong. Please try again. 😔');
        res.redirect(errorRedirectUrl);
    }
};

// Render reset password form (where OTP is entered)
const renderResetPasswordForm = (req, res) => {
    const { phone, token } = req.query; // token is from URL, phone for pre-filling
    if (!phone && !token) { // Require at least one, ideally token if direct link, or phone if coming from forgot pass
        req.flash('error_msg', 'Invalid password reset request.');
        return res.redirect('/customer/login');
    }
    res.render('pages/customer/reset-password-form', { // Path: views/pages/customer/reset-password-form.ejs
        title: 'Reset Your Password',
        phoneNumber: phone || '',
        token: token || '', // URL token
        passwordMinLength: process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8
        // errors: []
    });
};

// Handle reset password submission (with OTP and new password)
const handleResetPassword = async (req, res) => {
    const { otp, newPassword, confirmNewPassword, urlToken } = req.body;
    const phoneNumber = req.body.phoneNumber ? req.body.phoneNumber.trim() : "";
    const errorRedirectUrl = `/customer/reset-password-form?phone=${encodeURIComponent(phoneNumber || '')}&token=${encodeURIComponent(urlToken || '')}`;
    const minLength = parseInt(process.env.CUSTOMER_PASSWORD_MIN_LENGTH || 8, 10);

    // Specific validation errors will get ⚠️ prepended by flash-messages.ejs
    if (!otp || !newPassword || !confirmNewPassword || !phoneNumber) {
        req.flash('error_msg', '⚠️ All fields (Phone, OTP, New Password, Confirm Password) are required.');
        return res.redirect(errorRedirectUrl);
    }
    if (!/^(0[17])\d{8}$/.test(phoneNumber)) { // Added format check
        req.flash('error_msg', '⚠️ Invalid phone number format. Must be 10 digits starting with 01 or 07.');
        return res.redirect(errorRedirectUrl);
    }
    if (newPassword.length < minLength) {
        req.flash('error_msg', `New password must be at least ${minLength} characters.`);
        return res.redirect(errorRedirectUrl);
    }
    if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New passwords do not match.');
        return res.redirect(errorRedirectUrl);
    }

    try {
        const customer = await db.getAsync("SELECT id, password_hash, requires_password_change FROM customers WHERE phone_number = ?", [phoneNumber]);
        if (!customer) {
            req.flash('error_msg', '⚠️ Invalid phone number.'); // Specific error
            return res.redirect(errorRedirectUrl);
        }

        // Find the latest valid token for this customer
        // If urlToken is provided, it's more secure to match against token_hash
        let tokenRecord;
        if (urlToken) {
             // This requires iterating and comparing hashes if we only store token_hash
             // A simpler way is to query for the record and then compare the provided token with the hash
             const potentialTokens = await db.allAsync(
                "SELECT * FROM customer_password_reset_tokens WHERE customer_id = ? AND used = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC",
                [customer.id]
            );
            for (let pt of potentialTokens) {
                if (await bcrypt.compare(urlToken, pt.token_hash)) {
                    tokenRecord = pt;
                    break;
                }
            }
        } else { // Fallback to OTP if no URL token or if it's a direct OTP entry form
            const potentialTokens = await db.allAsync(
                "SELECT * FROM customer_password_reset_tokens WHERE customer_id = ? AND used = FALSE AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC",
                [customer.id]
            );
             for (let pt of potentialTokens) {
                if (await bcrypt.compare(otp, pt.otp_hash)) {
                    tokenRecord = pt;
                    break;
                }
            }
        }

        if (!tokenRecord) {
            req.flash('error_msg', '⚠️ Invalid or expired OTP/token. Please request a new one.');
            return res.redirect(errorRedirectUrl);
        }

        const isOtpMatch = await bcrypt.compare(otp, tokenRecord.otp_hash);
        if (!isOtpMatch) {
            req.flash('error_msg', '⚠️ Invalid OTP.');
            return res.redirect(errorRedirectUrl);
        }

        // Check if new password is the same as default password (if they were on default)
        const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || "Mynet@2020";
        if (customer.requires_password_change && newPassword === defaultPassword) {
             req.flash('error_msg', '⚠️ New password cannot be the default password if you are resetting from it.');
             return res.redirect(errorRedirectUrl);
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync(
            "UPDATE customers SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [newPasswordHash, customer.id]
        );
        await db.runAsync("UPDATE customer_password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecord.id]);

        req.flash('success_msg', '✨ Update Successful! ✨ Password reset successfully. You can now login with your new password. 🎉');
        res.redirect('/customer/login');

    } catch (err) {
        console.error("Error resetting customer password:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred. Please try again. 😔');
        res.redirect(errorRedirectUrl);
    }
};


module.exports = {
    renderCustomerLoginPage,
    loginCustomer,
    logoutCustomer,
    renderChangePasswordInitialForm,
    handleChangePasswordInitial,
    renderForgotPasswordForm, // Or integrate into login page
    handleForgotPassword,
    renderResetPasswordForm,
    handleResetPassword
};
