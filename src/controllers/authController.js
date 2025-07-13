const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc    Login customer
// @route   POST /customer/login
// @access  Public
exports.loginCustomer = async (req, res) => {
    const { username, password } = req.body; // Corrected: removed trailing underscore

    // Basic validation
    if (!username || !password) {
        return res.status(400).render('customer/login', {
            pageTitle: 'Twoem Customers | Login',
            error: 'Please provide username and password.',
            success: null,
            oldInput: { username }
        });
    }

    try {
        let customer;
        // Check if username is an email, phone number, or account number
        if (username.includes('@')) {
            customer = await Customer.findOne({ email: username.toLowerCase() });
        } else if (/^(0[17][0-9]{8})$/.test(username)) {
            customer = await Customer.findOne({ phoneNumber: username });
        } else {
            customer = await Customer.findOne({ accountNumber: username });
        }

        if (!customer) {
            return res.status(401).render('customer/login', {
                pageTitle: 'Twoem Customers | Login',
                error: 'Invalid credentials or user not found.',
                success: null,
                oldInput: { username }
            });
        }

        const isMatch = await customer.comparePassword(password);

        if (!isMatch) {
            req.flash('error_msg', 'Invalid credentials or user not found.');
            return res.redirect('/customer/login');
        }

        // Passwords match, create JWT or session
        const payload = {
            user: {
                id: customer.id,
                type: 'customer' // To differentiate between user types if needed later
            }
        };

        // Sign token
        // Store JWT in an HTTP-Only cookie for better security
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            maxAge: 3600000 // 1 hour
        });

        // For pop-up message on success (will be shown on the redirected page)
        // We'll need a way to pass this message to the next page, e.g., via query params or flash messages if using sessions
        // For now, let's assume we set it and the redirect page handles it.
        // A proper flash message system would be better.

        if (customer.isDefaultPassword) {
            // Redirect to change password page
            req.flash('success_msg', 'Login successful! Please change your default password.');
            return res.redirect('/customer/change-password');
        } else {
            // Redirect to dashboard
            req.flash('success_msg', 'Login successful!');
            return res.redirect('/customer/dashboard');
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).render('customer/login', {
            pageTitle: 'Twoem Customers | Login',
            error: 'Server error during login. Please try again later.',
            success: null,
            oldInput: { username }
        });
    }
};

// Placeholder for other auth functions (forgot password, reset password, change password)
// We will add them in subsequent steps.

// @desc    Render Change Password Page (for default password change)
// @route   GET /customer/change-password
// @access  Private (requires login)
exports.getChangePasswordPage = (req, res) => {
    // We need auth middleware to protect this route and provide user info
    // For now, we'll assume it's accessible if a success message implies login
    res.render('customer/change-password', {
        pageTitle: 'Change Your Password',
        user: req.user // This would be populated by auth middleware
    });
};

// @desc    Handle Change Default Password
// @route   POST /customer/change-password
// @access  Private (requires login)
exports.changeDefaultPassword = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id; // Assuming protect middleware attaches user

    if (!newPassword || !confirmNewPassword) {
        return res.status(400).render('customer/change-password', {
            pageTitle: 'Change Your Password',
            error: 'Please fill in all password fields.',
            success: null,
            user: req.user
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).render('customer/change-password', {
            pageTitle: 'Change Your Password',
            error: 'New password must be at least 8 characters long.',
            success: null,
            user: req.user,
        });
    }

    if (newPassword !== confirmNewPassword) {
        return res.status(400).render('customer/change-password', {
            pageTitle: 'Change Your Password',
            error: 'New passwords do not match.',
            success: null,
            user: req.user
        });
    }

    try {
        const customer = await Customer.findById(userId);
        if (!customer) {
            // This case should ideally not happen if protect middleware works correctly
            return res.status(404).redirect('/customer/login?error=User not found.');
        }

        // If it's a default password change, currentPassword might be the known default.
        // Otherwise, verify the actual current password.
        if (customer.isDefaultPassword) {
            // The form has the default password pre-filled and readonly,
            // but we could re-verify it against process.env.DEFAULT_CUSTOMER_PASSWORD if needed for extra security.
            // For this flow, we trust that if isDefaultPassword is true, we are changing from that.
             if (currentPassword !== process.env.DEFAULT_CUSTOMER_PASSWORD) {
                 // This might happen if somehow the readonly field was manipulated client-side
                 console.warn(`Default password mismatch for user ${customer.email}. Expected default, got something else.`);
                 // Potentially log out user or show specific error
             }
        } else {
            // If not a default password change, verify current password
            if (!currentPassword) {
                 return res.status(400).render('customer/change-password', {
                    pageTitle: 'Change Your Password',
                    error: 'Please provide your current password.',
                    success: null,
                    user: req.user
                });
            }
            const isMatch = await customer.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).render('customer/change-password', {
                    pageTitle: 'Change Your Password',
                    error: 'Incorrect current password.',
                    success: null,
                    user: req.user
                });
            }
        }

        // Check if new password is the same as the default password
        if (newPassword === process.env.DEFAULT_CUSTOMER_PASSWORD && customer.isDefaultPassword) {
             return res.status(400).render('customer/change-password', {
                pageTitle: 'Change Your Password',
                error: 'New password cannot be the same as the default password.',
                success: null,
                user: req.user
            });
        }


        customer.password = newPassword; // Hashing is done by pre-save hook
        customer.isDefaultPassword = false;
        await customer.save();

        // If JWT is session-based, it might need to be re-issued if password change invalidates old sessions.
        // For stateless JWTs based on user ID, this is usually fine.

        // Redirect to dashboard with success message
        req.flash('success_msg', 'Password changed successfully!');
        res.redirect('/customer/dashboard');

    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).render('customer/change-password', {
            pageTitle: 'Change Your Password',
            error: 'Server error while changing password. Please try again.',
            success: null,
            user: req.user
        });
    }
};


// @desc    Render Forgot Password Page
// @route   GET /customer/forgot-password
// @access  Public
exports.getForgotPasswordPage = (req, res) => {
    res.render('customer/forgot-password', {
        pageTitle: 'Forgot Your Password',
        error: null,
        success: null,
        oldInput: {}
    });
};

// Assuming Student model is required if not already
const Student = require('../models/Student');
const Admin = require('../models/Admin'); // Added Admin model

const crypto = require('crypto');
const sendEmail = require('../utils/emailUtils'); // We'll create this utility

// @desc    Handle Forgot Password Request
// @route   POST /customer/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    const { firstName, phoneNumber } = req.body;

    if (!firstName || !phoneNumber) {
        return res.status(400).render('customer/forgot-password', {
            pageTitle: 'Forgot Your Password',
            error: 'Please provide both first name and phone number.',
            success: null,
            oldInput: req.body
        });
    }

    // Validate phone number format (basic)
    if (!/^(0[17][0-9]{8})$/.test(phoneNumber)) {
        return res.status(400).render('customer/forgot-password', {
            pageTitle: 'Forgot Your Password',
            error: 'Invalid phone number format. Use 07xxxxxxxx or 01xxxxxxxx.',
            success: null,
            oldInput: req.body
        });
    }

    try {
        const customer = await Customer.findOne({
            firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') }, // Case-insensitive match
            phoneNumber: phoneNumber
        });

        if (!customer) {
            // To prevent user enumeration, show a generic success message even if not found.
            // The user is instructed to check their email.
            // However, the prompt asks for "Details not Matching" error. Let's follow that.
            return res.status(400).render('customer/forgot-password', {
                pageTitle: 'Forgot Your Password',
                error: 'Details not matching our records. Please try again or contact support.',
                success: null,
                oldInput: req.body
            });
        }

        // Generate reset token (for URL)
        const resetToken = crypto.randomBytes(32).toString('hex');
        customer.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex'); // Store hashed token
        customer.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // Token valid for 10 minutes

        // Generate OTP (numeric, 6 digits for email)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Storing OTP: The prompt says email contains both OTP and reset link.
        // The OTP is for the reset-password page. We can store it hashed or derive it if needed.
        // For simplicity, let's assume the reset token is the primary mechanism for the GET /reset-password/:token
        // and the OTP is an additional field on the reset form.
        // We can store the OTP (or its hash) on the customer record as well, or verify it through other means.
        // Let's store it temporarily for verification on the reset page.
        customer.resetPasswordOtp = otp; // Storing plain OTP for now, could be hashed. Expires with token.

        await customer.save();

        // Create reset URL
        const resetUrl = `${req.protocol}://${req.get('host')}/customer/reset-password/${resetToken}`;

        const messageBody = `
            <p>Hello ${customer.firstName},</p>
            <p>You requested a password reset for your Twoem Customer account.</p>
            <p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
            <p>Please use this OTP on the password reset page, or click the link below to reset your password:</p>
            <p><a href="${resetUrl}" target="_blank">Reset Your Password</a></p>
            <p>This link and OTP are valid for 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
        `;

        const emailSubject = 'Twoem Customer - Password Reset Request';

        try {
            await sendEmail({
                to: customer.email,
                subject: emailSubject,
                html: messageBody
                // We will add branding to sendEmail utility later
            });

            // Redirect to a page or show message "Email Sent"
            // For now, re-render forgot-password with success message. A dedicated page might be better.
             res.render('customer/forgot-password', {
                pageTitle: 'Forgot Your Password',
                error: null,
                success: `If an account with First Name: ${firstName} and Phone: ${phoneNumber} exists, an email with reset instructions (OTP and Link) has been sent to ${customer.email}. Please check your inbox and spam folder.`,
                oldInput: {} // Clear form
            });
            // The prompt also says "the website goes to reset-password where User can enter the otp"
            // This means we might want to redirect to /customer/reset-password (without token)
            // and that page would expect OTP. Let's adjust the success path.
            // req.flash('success_msg', `Email with OTP sent to ${customer.email}.`);
            // return res.redirect('/customer/reset-password');
            // For now, success message on same page is simpler.

        } catch (emailErr) {
            console.error('Email sending error:', emailErr);
            // Don't reveal that user was found if email fails
            customer.resetPasswordToken = undefined;
            customer.resetPasswordExpires = undefined;
            customer.resetPasswordOtp = undefined;
            await customer.save();

            return res.status(500).render('customer/forgot-password', {
                pageTitle: 'Forgot Your Password',
                error: 'Could not send reset email. Please try again later or contact support.',
                success: null,
                oldInput: req.body
            });
        }

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).render('customer/forgot-password', {
            pageTitle: 'Forgot Your Password',
            error: 'Server error. Please try again later.',
            success: null,
            oldInput: req.body
        });
    }
};


// @desc    Render Reset Password Page
// @route   GET /customer/reset-password/:token OR GET /customer/reset-password
// @access  Public
exports.getResetPasswordPage = async (req, res) => {
    const { token } = req.params;

    if (token) {
        try {
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            const customer = await Customer.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: Date.now() },
            });

            if (!customer) {
                return res.status(400).render('customer/reset-password', {
                    pageTitle: 'Reset Your Password',
                    error: 'Invalid or expired password reset link.',
                    success: null,
                    tokenValid: false,
                    tokenChecked: true,
                    resetToken: token
                });
            }

            // Token is valid, render the form
            res.render('customer/reset-password', {
                pageTitle: 'Reset Your Password',
                error: null,
                success: 'Please enter your new password. OTP might be pre-verified by link.',
                resetToken: token, // Pass token to form action
                tokenValid: true,
                tokenChecked: true
            });
        } catch (err) {
            console.error(err);
            res.status(500).render('customer/reset-password', {
                pageTitle: 'Reset Your Password',
                error: 'Server error validating reset link.',
                success: null,
                tokenValid: false,
                tokenChecked: true,
                resetToken: token
            });
        }
    } else {
        // No token in URL, render the form for OTP entry
        res.render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            resetToken: null,
            tokenValid: null, // Not applicable or unknown
            tokenChecked: false
        });
    }
};

// @desc    Handle Reset Password Submission
// @route   POST /customer/reset-password/:token OR POST /customer/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    const { token } = req.params; // Token might be in URL
    const { otp, newPassword, confirmNewPassword } = req.body;

    if (!newPassword || !confirmNewPassword) {
        return res.status(400).render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            error: 'Please enter and confirm your new password.',
            resetToken: token,
            oldInput: req.body,
            tokenValid: token ? null : undefined, // Re-evaluate token validity if needed on POST
            tokenChecked: !!token
        });
    }
     if (newPassword.length < 8) {
        return res.status(400).render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            error: 'New password must be at least 8 characters.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            error: 'New passwords do not match.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
    if (!otp && !token) { // If no token in URL, OTP becomes mandatory
         return res.status(400).render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            error: 'OTP is required.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
     if (otp && !/^[0-9]{6}$/.test(otp)) {
        return res.status(400).render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            error: 'Invalid OTP format. Must be 6 digits.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }


    try {
        let customer;
        const hashedTokenFromURL = token ? crypto.createHash('sha256').update(token).digest('hex') : null;

        if (hashedTokenFromURL) {
            customer = await Customer.findOne({
                resetPasswordToken: hashedTokenFromURL,
                resetPasswordExpires: { $gt: Date.now() },
            });
        } else if (otp) { // Fallback to OTP if no token or if token is not the primary means for this POST
            // If relying on OTP, we need a way to identify the user, e.g., email submitted with OTP
            // The current flow (OTP sent to email, user comes to this page) implies we might need user's identifier
            // For now, let's assume OTP is primarily validated IF a customer record is found via token OR if OTP is unique enough (not scalable)
            // The prompt: "User can enter the otp sent to email then password and reset"
            // This implies OTP is a key. The most secure way is if OTP is verified against user identified by the reset token,
            // or if the reset page requires email + OTP.
            // Given the email also has a reset link, the link path is more direct.
            // If user just uses OTP, they must have been identified by firstname/phone on previous page.
            // Let's refine: if token exists, it's primary. If not, OTP is used WITH some identifier.
            // The current design of forgotPassword finds customer by name/phone, then sends OTP/link to THEIR email.
            // So, the OTP is tied to that customer.
            // We will primarily rely on the token for finding the user. OTP is an additional check.
            return res.status(400).render('customer/reset-password', {
                pageTitle: 'Reset Your Password',
                error: 'Invalid reset attempt. Please use the link from your email or restart the process.',
                resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
            });
        }

        if (!customer) {
            return res.status(400).render('customer/reset-password', {
                pageTitle: 'Reset Your Password',
                error: 'Password reset link/token is invalid or has expired. Or, if using OTP, it could not be verified without a valid link context.',
                resetToken: token, oldInput: req.body, tokenValid: false, tokenChecked: true
            });
        }

        // Validate OTP if present and stored (customer.resetPasswordOtp)
        if (customer.resetPasswordOtp && otp !== customer.resetPasswordOtp) {
             return res.status(400).render('customer/reset-password', {
                pageTitle: 'Reset Your Password',
                error: 'OTP does not match or has expired. Please check your email or try again.',
                resetToken: token, oldInput: req.body, tokenValid: true, tokenChecked: true
            });
        }

        // Check if new password is the same as the old (default or current) password
        // This is a good practice but not explicitly asked for.
        // const isSameAsOld = await customer.comparePassword(newPassword);
        // if (isSameAsOld) {
        //     return res.status(400).render('customer/reset-password', {
        //         pageTitle: 'Reset Your Password',
        //         error: 'New password cannot be the same as your current password.',
        //         resetToken: token, oldInput: req.body, tokenValid: true, tokenChecked: true
        //     });
        // }


        customer.password = newPassword; // Hashing done by pre-save hook
        customer.isDefaultPassword = false; // Resetting password implies it's no longer default
        customer.resetPasswordToken = undefined;
        customer.resetPasswordExpires = undefined;
        customer.resetPasswordOtp = undefined; // Clear OTP
        await customer.save();

        // Redirect to login page with success message
        req.flash('success_msg', 'Password has been reset successfully. Please login with your new password.');
        res.redirect('/customer/login');

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).render('customer/reset-password', {
            pageTitle: 'Reset Your Password',
            error: 'Server error during password reset. Please try again.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
};

// @desc    Login student
// @route   POST /student/login
// @access  Public
exports.loginStudent = async (req, res) => {
    const { registrationNumber, password } = req.body;

    if (!registrationNumber || !password) {
        return res.status(400).render('student/login', {
            pageTitle: 'Student Portal | Login',
            error: 'Please provide registration number and password.',
            success: null,
            oldInput: { registrationNumber }
        });
    }

    try {
        const student = await Student.findOne({ registrationNumber: registrationNumber.toUpperCase() });

        if (!student) {
            return res.status(401).render('student/login', {
                pageTitle: 'Student Portal | Login',
                error: 'Invalid credentials or student not found.',
                success: null,
                oldInput: { registrationNumber }
            });
        }

        const isMatch = await student.comparePassword(password);

        if (!isMatch) {
            req.flash('error_msg', 'Invalid credentials or student not found.');
            return res.redirect('/student/login');
        }

        // Create JWT
        const payload = {
            user: {
                id: student.id,
                type: 'student'
            }
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000 // 1 hour
        });

        let redirectUrl = '/student/dashboard';
        if (student.isDefaultPassword) {
            redirectUrl = '/student/change-password';
            req.flash('success_msg', 'Login successful! Please change your default password.');
        } else if (student.profileRequiresUpdate) {
            // This condition means Next of Kin info is missing.
            // The prompt says: "If nextOfKinName or nextOfKinPhone is missing, redirect to a profile update page ... after password change (if applicable)."
            // So, if default password needs changing, that takes precedence. Otherwise, profile update.
            redirectUrl = '/student/update-profile'; // Or /student/dashboard?prompt_update=true
            req.flash('success_msg', 'Login successful! Please update your Next of Kin information.');
        } else {
            req.flash('success_msg', 'Login successful!');
        }

        return res.redirect(redirectUrl);

    } catch (err) {
        console.error('Student login error:', err.message);
        res.status(500).render('student/login', {
            pageTitle: 'Student Portal | Login',
            error: 'Server error during login. Please try again later.',
            success: null,
            oldInput: { registrationNumber }
        });
    }
};


// Placeholder for Customer Dashboard - to allow redirection
// This would typically be in customerController.js
exports.getCustomerDashboard = (req, res) => {
    // This page should be protected by auth middleware
    // For now, just rendering a placeholder
    res.render('customer/dashboard', { // dashboard_placeholder.ejs was renamed to dashboard.ejs
        pageTitle: 'Twoem Customers | Dashboard',
        user: req.user // This would be populated by auth middleware
    });
};

// Placeholders for Student specific auth pages (will be filled in subsequent steps)
exports.getStudentChangePasswordPage = (req, res) => {
    res.render('student/change-password', {
        pageTitle: 'Change Your Password | Student Portal',
        user: req.user
    });
};
exports.changeStudentPassword = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const studentId = req.user.id;

    if (!newPassword || !confirmNewPassword) {
        return res.status(400).render('student/change-password', {
            pageTitle: 'Change Your Password | Student Portal',
            error: 'Please fill in all password fields.',
            success: null,
            user: req.user
        });
    }
    if (newPassword.length < 8) {
        return res.status(400).render('student/change-password', {
            pageTitle: 'Change Your Password | Student Portal',
            error: 'New password must be at least 8 characters long.',
            success: null, user: req.user
        });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).render('student/change-password', {
            pageTitle: 'Change Your Password | Student Portal',
            error: 'New passwords do not match.',
            success: null, user: req.user
        });
    }

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).redirect('/student/login?error=Student not found.');
        }

        const defaultStudentPassword = process.env.DEFAULT_STUDENT_PASSWORD || "Stud@Twoem2025";

        if (student.isDefaultPassword) {
            // currentPassword from form is readonly and prefilled with default
            // A strict check against the actual default password from env could be done here
            // if (currentPassword !== defaultStudentPassword) { ... error ... }
        } else {
            if (!currentPassword) {
                return res.status(400).render('student/change-password', {
                    pageTitle: 'Change Your Password | Student Portal',
                    error: 'Please provide your current password.',
                    success: null, user: req.user
                });
            }
            const isMatch = await student.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).render('student/change-password', {
                    pageTitle: 'Change Your Password | Student Portal',
                    error: 'Incorrect current password.',
                    success: null, user: req.user
                });
            }
        }

        if (newPassword === defaultStudentPassword && student.isDefaultPassword) {
            return res.status(400).render('student/change-password', {
                pageTitle: 'Change Your Password | Student Portal',
                error: 'New password cannot be the same as the default password.',
                success: null, user: req.user
            });
        }

        student.password = newPassword; // Hashing by pre-save hook
        student.isDefaultPassword = false;
        await student.save();

        let redirectUrl = '/student/dashboard';
        if (student.profileRequiresUpdate) { // Check if Next of Kin info is still needed
            redirectUrl = '/student/update-profile';
            req.flash('success_msg', 'Password changed successfully! Please complete your profile by adding Next of Kin information.');
        } else {
            req.flash('success_msg', 'Password changed successfully!');
        }

        res.redirect(redirectUrl);

    } catch (err) {
        console.error('Error changing student password:', err);
        res.status(500).render('student/change-password', {
            pageTitle: 'Change Your Password | Student Portal',
            error: 'Server error while changing password. Please try again.',
            success: null, user: req.user
        });
    }
};

exports.getStudentForgotPasswordPage = (req, res) => {
     res.render('student/forgot-password', {
        pageTitle: 'Forgot Password | Student Portal',
        error: null,
        success: null,
        oldInput: {}
    });
};
exports.forgotStudentPassword = async (req, res) => {
    const { firstName, email } = req.body;

    if (!firstName || !email) {
        return res.status(400).render('student/forgot-password', {
            pageTitle: 'Forgot Password | Student Portal',
            error: 'Please provide both first name and email.',
            success: null, oldInput: req.body
        });
    }

    try {
        const student = await Student.findOne({
            firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') },
            email: email.toLowerCase()
        });

        if (!student) {
            // As per prompt: "Details not Matching"
            return res.status(400).render('student/forgot-password', {
                pageTitle: 'Forgot Password | Student Portal',
                error: 'Details not matching our records. Please try again or contact support.',
                success: null, oldInput: req.body
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        student.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        student.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        student.resetPasswordOtp = otp;
        await student.save();

        const resetUrl = `${req.protocol}://${req.get('host')}/student/reset-password/${resetToken}`;
        const messageBody = `
            <p>Hello ${student.firstName},</p>
            <p>You requested a password reset for your Twoem Student Portal account.</p>
            <p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
            <p>Please use this OTP on the password reset page, or click the link below:</p>
            <p><a href="${resetUrl}" target="_blank">Reset Your Password</a></p>
            <p>This link and OTP are valid for 10 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
        `;
        const emailSubject = 'Twoem Student Portal - Password Reset Request';

        try {
            await sendEmail({ to: student.email, subject: emailSubject, html: messageBody });
            res.render('student/forgot-password', {
                pageTitle: 'Forgot Password | Student Portal',
                error: null,
                success: `If an account for ${firstName} with email ${email} exists, reset instructions (OTP and Link) have been sent. Please check your inbox and spam folder.`,
                oldInput: {}
            });
        } catch (emailErr) {
            console.error('Student email sending error:', emailErr);
            student.resetPasswordToken = undefined;
            student.resetPasswordExpires = undefined;
            student.resetPasswordOtp = undefined;
            await student.save();
            return res.status(500).render('student/forgot-password', {
                pageTitle: 'Forgot Password | Student Portal',
                error: 'Could not send reset email. Please try again later.',
                success: null, oldInput: req.body
            });
        }
    } catch (err) {
        console.error('Student forgot password error:', err);
        res.status(500).render('student/forgot-password', {
            pageTitle: 'Forgot Password | Student Portal',
            error: 'Server error. Please try again later.',
            success: null, oldInput: req.body
        });
    }
};

exports.getStudentResetPasswordPage = async (req, res) => {
    const { token } = req.params;
    const emailSentTo = req.query.email_sent_to || null;

    if (token) {
        try {
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            const student = await Student.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: Date.now() },
            });
            if (!student) {
                return res.status(400).render('student/reset-password', {
                    pageTitle: 'Reset Password | Student Portal',
                    error: 'Invalid or expired password reset link.', success: null,
                    tokenValid: false, tokenChecked: true, resetToken: token
                });
            }
            res.render('student/reset-password', {
                pageTitle: 'Reset Password | Student Portal', error: null,
                success: 'Please enter your new password.', resetToken: token,
                tokenValid: true, tokenChecked: true
            });
        } catch (err) {
            console.error(err);
            res.status(500).render('student/reset-password', {
                pageTitle: 'Reset Password | Student Portal',
                error: 'Server error validating reset link.', success: null,
                tokenValid: false, tokenChecked: true, resetToken: token
            });
        }
    } else {
        res.render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal', error: null,
            success: emailSentTo ? `Email with OTP sent to ${emailSentTo}.` : null,
            resetToken: null, tokenValid: null, tokenChecked: false, email_sent_to: emailSentTo
        });
    }
};

exports.resetStudentPassword = async (req, res) => {
    const { token } = req.params;
    const { otp, newPassword, confirmNewPassword } = req.body;

    if (!newPassword || !confirmNewPassword) {
        return res.status(400).render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal', error: 'Please enter and confirm your new password.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
    if (newPassword.length < 8) {
        return res.status(400).render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal', error: 'New password must be at least 8 characters.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
    if (newPassword !== confirmNewPassword) {
        return res.status(400).render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal', error: 'New passwords do not match.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
    if (!otp && !token) {
         return res.status(400).render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal', error: 'OTP is required.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
     if (otp && !/^[0-9]{6}$/.test(otp)) {
        return res.status(400).render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal', error: 'Invalid OTP format. Must be 6 digits.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }

    try {
        let student;
        const hashedTokenFromURL = token ? crypto.createHash('sha256').update(token).digest('hex') : null;

        if (hashedTokenFromURL) {
            student = await Student.findOne({
                resetPasswordToken: hashedTokenFromURL,
                resetPasswordExpires: { $gt: Date.now() },
            });
        } else {
             // If no token, this path is problematic without also asking for email on the reset form
             // For now, we'll assume the link is the primary method.
            return res.status(400).render('student/reset-password', {
                pageTitle: 'Reset Password | Student Portal',
                error: 'Invalid reset attempt. Please use the link from your email.',
                resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
            });
        }

        if (!student) {
            return res.status(400).render('student/reset-password', {
                pageTitle: 'Reset Password | Student Portal',
                error: 'Password reset link/token is invalid or has expired.',
                resetToken: token, oldInput: req.body, tokenValid: false, tokenChecked: true
            });
        }

        if (student.resetPasswordOtp && otp !== student.resetPasswordOtp) {
             return res.status(400).render('student/reset-password', {
                pageTitle: 'Reset Password | Student Portal',
                error: 'OTP does not match or has expired. Please check your email or try again.',
                resetToken: token, oldInput: req.body, tokenValid: true, tokenChecked: true
            });
        }

        student.password = newPassword; // Hashing by pre-save hook
        student.isDefaultPassword = false;
        student.resetPasswordToken = undefined;
        student.resetPasswordExpires = undefined;
        student.resetPasswordOtp = undefined;
        await student.save();

        res.redirect('/student/login?success=Password has been reset successfully. Please login.');

    } catch (err) {
        console.error('Student reset password error:', err);
        res.status(500).render('student/reset-password', {
            pageTitle: 'Reset Password | Student Portal',
            error: 'Server error during password reset. Please try again.',
            resetToken: token, oldInput: req.body, tokenValid: token ? null : undefined, tokenChecked: !!token
        });
    }
};

// Placeholder for New Student Lookup
exports.getNewStudentLookupPage = (req, res) => {
    res.render('student/new_student_lookup', {
        pageTitle: 'New Student Lookup | Student Portal',
        error: null, success: null, oldInput: {}
    });
};
exports.handleNewStudentLookup = async (req, res) => {
    const { firstName, email } = req.body;

    if (!firstName || !email) {
        return res.status(400).render('student/new_student_lookup', {
            pageTitle: 'New Student Lookup | Student Portal',
            error: 'Please provide both your first name and email address.',
            success: null, oldInput: req.body
        });
    }

    try {
        const student = await Student.findOne({
            firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') },
            email: email.toLowerCase()
        });

        if (!student) {
            return res.status(404).render('student/new_student_lookup', {
                pageTitle: 'New Student Lookup | Student Portal',
                error: 'No student record found matching the provided first name and email. Please check your details or contact administration.',
                success: null, oldInput: req.body
            });
        }

        // Check if details have already been viewed or if student has changed default password
        if (student.initialDetailsViewed || !student.isDefaultPassword) {
            return res.status(403).render('student/new_student_lookup', {
                pageTitle: 'New Student Lookup | Student Portal',
                error: 'Initial details for this account have already been viewed or the password has been changed. Please try logging in or use "Forgot Password" if needed.',
                success: null, oldInput: req.body
            });
        }

        // Mark details as viewed
        student.initialDetailsViewed = true;
        await student.save();

        // Display initial details
        res.render('student/view_initial_details', {
            pageTitle: 'Your Initial Account Details | Student Portal',
            studentDetails: {
                firstName: student.firstName,
                lastName: student.lastName,
                registrationNumber: student.registrationNumber,
                email: student.email,
                phoneNumber: student.phoneNumber,
                defaultPassword: process.env.DEFAULT_STUDENT_PASSWORD || "Stud@Twoem2025"
            },
            success: null, error: null
        });

    } catch (err) {
        console.error('New student lookup error:', err);
        res.status(500).render('student/new_student_lookup', {
            pageTitle: 'New Student Lookup | Student Portal',
            error: 'Server error during lookup. Please try again later.',
            success: null, oldInput: req.body
        });
    }
};

// Placeholder for Student Update Profile Page (for Next of Kin)
exports.getStudentUpdateProfilePage = (req, res) => {
    res.render('student/update-profile', { // This view needs to be created
        pageTitle: 'Update Profile | Student Portal',
        user: req.user,
        success: req.query.message || null,
        error: req.query.error || null
    });
};
exports.updateStudentProfile = async (req, res) => { res.send('POST /student/update-profile placeholder'); };

// Student Dashboard logic is now in studentController.js
// exports.getStudentDashboard = (req, res) => { ... };

// @desc    Login Admin
// @route   POST /admin/login
// @access  Public
exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).render('admin/login', {
            pageTitle: 'Twoem Admin | Login',
            error: 'Please provide email and password.',
            success: null,
            oldInput: { email }
        });
    }

    try {
        let adminUser = await Admin.findOne({ email: email.toLowerCase() });

        if (!adminUser) {
            // If no admin user is found, let's create the first one from the .env file
            if (email.toLowerCase() === process.env.ADMIN1_EMAIL.toLowerCase()) {
                console.log('Creating initial admin user from .env file');
                console.log('Admin password hash from .env:', process.env.ADMIN1_PASSWORD_HASH);
                adminUser = new Admin({
                    email: process.env.ADMIN1_EMAIL,
                    password: process.env.ADMIN1_PASSWORD_HASH,
                    firstName: process.env.ADMIN1_FIRSTNAME,
                    otherNames: process.env.ADMIN1_OTHERNAMES,
                    envAdminId: 'ADMIN1'
                });
                await adminUser.save();
                console.log('Initial admin user created successfully');
            } else {
                return res.status(401).render('admin/login', {
                    pageTitle: 'Twoem Admin | Login',
                    error: 'Invalid credentials.', // Generic error
                    success: null,
                    oldInput: { email }
                });
            }
        }

        console.log('Attempting to log in admin:', email);
        const isMatch = await bcrypt.compare(password, process.env.ADMIN1_PASSWORD_HASH);
        console.log('Password match result:', isMatch);

        if (!isMatch) {
            req.flash('error_msg', 'Invalid credentials.');
            return res.redirect('/admin/login');
        }


        // Create JWT
        const payload = {
            user: {
                id: adminUser.id, // Use MongoDB _id
                type: 'admin',
                firstName: adminUser.firstName // For welcome message
            }
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: (process.env.JWT_EXPIRES_IN === '1h' ? 3600000 : parseInt(process.env.JWT_EXPIRES_IN) * 1000)
        });

        req.flash('success_msg', 'Login successful!');
        res.redirect('/admin/dashboard');

    } catch (err) {
        console.error('Admin login error:', err.message);
        res.status(500).render('admin/login', {
            pageTitle: 'Twoem Admin | Login',
            error: 'Server error during login. Please try again later.',
            success: null,
            oldInput: { email }
        });
    }
};

// Admin Dashboard logic is now in adminController.js
// exports.getAdminDashboard = (req, res) => { ... };
