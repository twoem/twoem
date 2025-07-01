const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { getJwtSecret } = require('../utils/jwtHelper');
const crypto = require('crypto');
const { sendEmailWithTemplate } = require('../config/mailer');

// Student Login
const loginStudent = async (req, res) => {
    const { registrationNumber, password } = req.body;
    const loginPageParams = { title: 'Student Portal Login', activeTab: 'login-panel' };

    if (!registrationNumber || !password) {
        req.flash('error_msg', '⚠️ Registration number and password are required.');
        return res.status(400).render('pages/student-login', loginPageParams);
    }
    try {
        const student = await db.getAsync("SELECT * FROM students WHERE registration_number = ?", [registrationNumber]);
        if (!student) {
            req.flash('error_msg', '⚠️Oops! The Username or password seems incorrect. 🧐');
            return res.status(401).render('pages/student-login', loginPageParams);
        }
        const isMatch = await bcrypt.compare(password, student.password_hash);
        if (!isMatch) {
            req.flash('error_msg', '⚠️Oops! The Username or password seems incorrect. 🧐');
            return res.status(401).render('pages/student-login', loginPageParams);
        }
        await db.runAsync("UPDATE students SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [student.id]);

        const tokenPayload = {
            id: student.id,
            registrationNumber: student.registration_number,
            email: student.email,
            firstName: student.first_name,
            isStudent: true
        };
        const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRE || '1h' });

        res.cookie('student_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: parseInt(process.env.JWT_EXPIRE_MS || (1 * 60 * 60 * 1000).toString(), 10),
            path: '/',
            sameSite: 'Lax'
        });

        req.flash('success_msg', '🎉 Welcome Back! 🎉 You’ve successfully logged in🌟');

        if (student.requires_password_change) {
            req.flash('info_msg', 'Please change your default password to continue.');
            return res.redirect('/student/change-password-initial');
        }
        if (!student.is_profile_complete) {
            req.flash('info_msg', 'Please complete your profile to continue.');
            return res.redirect('/student/complete-profile-initial');
        }
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error("Student login error:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Something went wrong. Please try again. 😔');
        res.status(500).render('pages/student-login', { title: 'Student Portal Login', activeTab: 'login-panel'});
    }
};

const logoutStudent = (req, res) => {
    res.cookie('student_auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(0),
        path: '/',
        sameSite: 'Lax'
    });
    req.flash('success_msg', '✨ Success! ✨ You have been logged out successfully! 🎉');
    res.redirect('/student/login');
};

const renderChangePasswordInitialForm = (req, res) => {
    const viewData = {
        title: 'Change Your Password',
        student: req.student,
        defaultStudentPassword: process.env.DEFAULT_STUDENT_PASSWORD,
        passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8,
        errors: req.flash('validation_errors') ? JSON.parse(req.flash('validation_errors')[0] || '[]') : []
    };
    res.render('layouts/student_layout', {
        title: 'Change Your Password',
        bodyView: 'pages/student/change-password-initial',
        student: req.student,
        viewData: viewData
    });
};

const handleChangePasswordInitial = [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: parseInt(process.env.PASSWORD_MIN_LENGTH || 8, 10) }).withMessage(`New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters long.`),
    body('confirmNewPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('New passwords do not match.');
        }
        return true;
    }),
    async (req, res) => {
        const errors = validationResult(req);
        const { currentPassword, newPassword } = req.body;
        const studentId = req.student.id;
        const redirectUrl = '/student/change-password-initial';

        if (!errors.isEmpty()) {
            req.flash('validation_errors', JSON.stringify(errors.array()));
            return res.redirect(redirectUrl);
        }
        if (currentPassword !== process.env.DEFAULT_STUDENT_PASSWORD) {
            req.flash('validation_errors', JSON.stringify([{param:'currentPassword', msg: 'Incorrect current default password.'}]));
            return res.redirect(redirectUrl);
        }
        if (newPassword === process.env.DEFAULT_STUDENT_PASSWORD) {
            req.flash('validation_errors', JSON.stringify([{param:'newPassword', msg: 'New password cannot be the same as the default password.'}]));
            return res.redirect(redirectUrl);
        }
        try {
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            await db.runAsync("UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newPasswordHash, studentId]);
            const updatedStudent = await db.getAsync("SELECT is_profile_complete FROM students WHERE id = ?", [studentId]);

            req.flash('success_msg', '✨ Update Successful! ✨ Your password has been changed successfully! 🎉');
            if (!updatedStudent.is_profile_complete) {
                req.flash('info_msg', 'Please complete your profile to continue.');
                res.redirect('/student/complete-profile-initial');
            } else {
                res.redirect('/student/dashboard');
            }
        } catch (err) {
            console.error("Error changing initial password:", err);
            req.flash('error_msg', '❌ Operation Failed! ❌ Something went wrong while changing password. Please try again. 😔');
            res.redirect(redirectUrl);
        }
    }
];

const renderCompleteProfileInitialForm = (req, res) => {
    const viewData = {
        title: 'Complete Your Profile',
        student: req.student,
        oldInput: {
            nokName: req.flash('nokName')[0] || '',
            nokRelationship: req.flash('nokRelationship')[0] || '',
            nokPhone: req.flash('nokPhone')[0] || '',
            nokEmail: req.flash('nokEmail')[0] || ''
        },
        errors: req.flash('validation_errors_profile_initial') ? JSON.parse(req.flash('validation_errors_profile_initial')[0]) : []
    };
     res.render('layouts/student_layout', {
        title: 'Complete Your Profile',
        bodyView: 'pages/student/complete-profile-initial',
        student: req.student,
        viewData: viewData
    });
};

const handleCompleteProfileInitial = [
    body('nokName').trim().notEmpty().withMessage('Next of Kin Name is required.'),
    body('nokRelationship').trim().notEmpty().withMessage('Relationship is required.'),
    body('nokPhone').trim().notEmpty().withMessage('Phone number is required.').matches(/^(0[17])\d{8}$/).withMessage('Invalid phone number format (must be 10 digits starting 01/07).'),
    body('nokEmail').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email format for Next of Kin.'),

    async (req, res) => {
        const errors = validationResult(req);
        const { nokName, nokRelationship, nokPhone, nokEmail } = req.body;
        const studentId = req.student.id;

        if (!errors.isEmpty()) {
            req.flash('validation_errors_profile_initial', JSON.stringify(errors.array()));
            req.flash('nokName', nokName);
            req.flash('nokRelationship', nokRelationship);
            req.flash('nokPhone', nokPhone);
            req.flash('nokEmail', nokEmail);
            return res.redirect('/student/complete-profile-initial');
        }

        const nokDetails = JSON.stringify({ name: nokName, relationship: nokRelationship, phone: nokPhone, email: nokEmail });
        try {
            await db.runAsync("UPDATE students SET next_of_kin_details = ?, is_profile_complete = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nokDetails, studentId]);
            req.flash('success_msg', '✨ Update Successful! ✨ Profile completed successfully! Welcome to your dashboard! 🎉');
            res.redirect('/student/dashboard');
        } catch (err) {
            console.error("Error completing initial profile:", err);
            req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while saving your profile. 😔');
            req.flash('nokName', nokName);
            req.flash('nokRelationship', nokRelationship);
            req.flash('nokPhone', nokPhone);
            req.flash('nokEmail', nokEmail);
            res.redirect('/student/complete-profile-initial');
        }
    }
];

function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

const handleForgotPassword = async (req, res) => {
    const { registrationNumber, email, resetMethod } = req.body;
    const activeTabOnError = 'forgot-password-panel';
    const loginRedirectUrl = `/student/login?activeTab=${activeTabOnError}#${activeTabOnError}`;

    if (!registrationNumber || !email || !resetMethod) {
        req.flash('error_msg', '⚠️ Registration number, email, and reset method are required.');
        return res.redirect(loginRedirectUrl);
    }
    try {
        const student = await db.getAsync("SELECT id, email, first_name FROM students WHERE registration_number = ? AND lower(email) = lower(?)", [registrationNumber, email.trim()]);
        if (!student) {
            req.flash('error_msg', '⚠️ No student found with that registration number and email address.');
            return res.redirect(loginRedirectUrl);
        }

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        let emailSubject = "";
        let emailData = { studentName: student.first_name, preheaderText: "" }; // Initialize preheaderText
        let redirectPath = "";
        let tokenRecordId = null;

        if (resetMethod === 'otp') {
            const otp = generateOtp();
            const otpHash = await bcrypt.hash(otp, 10);
            const result = await db.runAsync(
                "INSERT INTO password_reset_tokens (student_id, otp_hash, token_hash, expires_at) VALUES (?, ?, NULL, ?)",
                [student.id, otpHash, expiresAt.toISOString()]
            );
            tokenRecordId = result.lastID;
            emailSubject = "Your Password Reset OTP - Twoem Online Productions";
            emailData.otp = otp;
            emailData.preheaderText = `Your OTP is ${otp}. It expires in 10 minutes.`;
            redirectPath = `/student/reset-password-form?regNo=${encodeURIComponent(registrationNumber)}`;
        } else if (resetMethod === 'link') {
            const linkToken = crypto.randomBytes(32).toString('hex');
            const linkTokenHash = await bcrypt.hash(linkToken, 10);
            const result = await db.runAsync(
                "INSERT INTO password_reset_tokens (student_id, otp_hash, token_hash, expires_at) VALUES (?, NULL, ?, ?)",
                [student.id, linkTokenHash, expiresAt.toISOString()]
            );
            tokenRecordId = result.lastID;
            const fullResetLink = `${req.protocol}://${req.get('host')}/student/reset-password-form?token=${linkToken}`;
            emailSubject = "Password Reset Link - Twoem Online Productions";
            emailData.resetLink = fullResetLink;
            emailData.preheaderText = 'Click the link inside to reset your password. It expires in 10 minutes.';
            redirectPath = `/student/login?activeTab=forgot-password-panel#forgot-password-panel`;
        } else {
            req.flash('error_msg', '⚠️ Invalid reset method selected.');
            return res.redirect(loginRedirectUrl);
        }

        try {
            await sendEmailWithTemplate({
                to: student.email,
                subject: emailSubject,
                templateName: 'otp-email',
                data: emailData
            });
            req.flash('success_msg', `✅ Email Sent Successfully! 📩 Instructions have been sent to ${student.email}. Please check your inbox (and spam folder). 🎉`);
        } catch (emailError) {
            console.error("Forgot password - email send error:", emailError);
            if(tokenRecordId) { // Attempt to mark token as used/failed if email send fails
                await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecordId]).catch(e => console.error("Failed to mark token as used after email failure",e));
            }
            req.flash('error_msg', '❌ Failed to Send Email ⚠️ Oops! Something went wrong while sending the email. Please try again. 😔');
        }

        res.redirect(redirectPath);

    } catch (err) {
        console.error("Forgot password error (overall):", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Something went wrong. Please try again. 😔');
        res.redirect(loginRedirectUrl);
    }
};

const renderResetPasswordForm = (req, res) => {
    const { regNo, token } = req.query;
    res.render('pages/student/reset-password-form', {
        title: 'Reset Your Password',
        registrationNumber: regNo || '',
        token: token || '',
        passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8,
        student: null
    });
};

const handleResetPassword = async (req, res) => {
    const { registrationNumber, otp, newPassword, confirmNewPassword, urlToken } = req.body;
    const errorRedirectUrl = `/student/reset-password-form?regNo=${encodeURIComponent(registrationNumber || '')}&token=${encodeURIComponent(urlToken || '')}`;
    const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH || 8, 10);

    if ((!otp && !urlToken) || !newPassword || !confirmNewPassword ) {
        req.flash('error_msg', '⚠️ Required fields are missing.');
        return res.redirect(errorRedirectUrl);
    }
    if (newPassword.length < minLength) { req.flash('error_msg', `New password must be at least ${minLength} characters.`); return res.redirect(errorRedirectUrl); }
    if (newPassword !== confirmNewPassword) { req.flash('error_msg', 'New passwords do not match.'); return res.redirect(errorRedirectUrl); }

    try {
        let student;
        let tokenRecord;

        if (urlToken) {
            const potentialTokens = await db.allAsync(
                "SELECT * FROM password_reset_tokens WHERE used = FALSE AND token_hash IS NOT NULL AND expires_at > datetime('now') ORDER BY created_at DESC"
            );
            for (let pt of potentialTokens) {
                if (await bcrypt.compare(urlToken, pt.token_hash)) {
                    tokenRecord = pt;
                    break;
                }
            }
            if (tokenRecord) {
                student = await db.getAsync("SELECT * FROM students WHERE id = ?", [tokenRecord.student_id]);
            }
        } else if (otp && registrationNumber) {
            student = await db.getAsync("SELECT * FROM students WHERE registration_number = ?", [registrationNumber]);
            if (student) {
                const potentialTokens = await db.allAsync(
                    "SELECT * FROM password_reset_tokens WHERE student_id = ? AND used = FALSE AND otp_hash IS NOT NULL AND expires_at > datetime('now') ORDER BY created_at DESC",
                    [student.id]
                );
                for (let pt of potentialTokens) {
                    if (await bcrypt.compare(otp, pt.otp_hash)) {
                        tokenRecord = pt;
                        break;
                    }
                }
            }
        }

        if (!student) { req.flash('error_msg', '⚠️ Invalid student identifier or link/OTP.'); return res.redirect(errorRedirectUrl); }
        if (!tokenRecord) { req.flash('error_msg', '⚠️ Invalid or expired OTP/token. Please request a new one.'); return res.redirect(errorRedirectUrl); }

        // If using OTP flow, ensure the OTP field was actually submitted (even if urlToken was also somehow in form)
        if (!urlToken && otp && tokenRecord.otp_hash) {
             const isOtpMatch = await bcrypt.compare(otp, tokenRecord.otp_hash);
             if(!isOtpMatch) {
                req.flash('error_msg', '⚠️ Invalid OTP.'); return res.redirect(errorRedirectUrl);
             }
        } else if (urlToken && !tokenRecord.token_hash) {
            // This case should ideally not happen if tokenRecord was found via urlToken
            req.flash('error_msg', '⚠️ Token mismatch. Please use the link from your email.'); return res.redirect(errorRedirectUrl);
        }


        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD;
        if (student.requires_password_change && defaultPassword && newPassword === defaultPassword) {
             req.flash('error_msg', '⚠️ New password cannot be the default password if you are resetting from it.'); return res.redirect(errorRedirectUrl);
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync(
            "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [newPasswordHash, student.id]
        );
        await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecord.id]);

        req.flash('success_msg', '✨ Update Successful! ✨ Password reset successfully. You can now login with your new password. 🎉');
        res.redirect('/student/login');

    } catch (err) {
        console.error("Error resetting student password:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred. Please try again. 😔');
        res.redirect(errorRedirectUrl);
    }
};

const listMyNotifications = async (req, res) => {
    const studentId = req.student.id;
    try {
        const enrolledCourses = await db.allAsync("SELECT course_id FROM enrollments WHERE student_id = ?", [studentId]);
        const enrolledCourseIds = enrolledCourses.map(ec => ec.course_id);
        let queryParams = [studentId, studentId];
        let coursePlaceholders = '';
        if (enrolledCourseIds.length > 0) {
            coursePlaceholders = `OR (n.target_audience_type = 'course_id' AND n.target_audience_identifier IN (${enrolledCourseIds.map(() => '?').join(',')}))`;
            queryParams.push(...enrolledCourseIds);
        }
        const notifications = await db.allAsync(
            `SELECT n.*, snr.read_at
             FROM notifications n
             LEFT JOIN student_notification_reads snr ON n.id = snr.notification_id AND snr.student_id = ?
             WHERE n.target_audience_type = 'all'
                OR (n.target_audience_type = 'student_id' AND n.target_audience_identifier = ?)
                ${coursePlaceholders}
             ORDER BY n.created_at DESC`,
            queryParams
        );

        const viewData = {
            title: 'My Notifications',
            notifications: notifications,
            student: req.student
        };
        res.render('layouts/student_layout', {
            title: 'My Notifications',
            bodyView: 'pages/student/notifications',
            student: req.student,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student notifications:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve the notifications. 😔');
        const errorViewData = { title: 'My Notifications - Error', notifications: [], student: req.student, errorLoading: true, errorMessage: err.message };
        res.status(500).render('layouts/student_layout', {
            title: 'Error Loading Notifications',
            bodyView: 'pages/student/notifications',
            student: req.student,
            viewData: errorViewData
        });
    }
};

const markNotificationAsRead = async (req, res) => {
    const studentId = req.student.id;
    const notificationId = req.params.notificationId;
    try {
        const existingRead = await db.getAsync( "SELECT id FROM student_notification_reads WHERE student_id = ? AND notification_id = ?", [studentId, notificationId] );
        if (!existingRead) {
            await db.runAsync( "INSERT INTO student_notification_reads (student_id, notification_id) VALUES (?, ?)", [studentId, notificationId] );
        }
        res.redirect('/student/notifications');
    } catch (err) {
        console.error("Error marking notification as read:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Could not mark notification as read. 😔');
        res.redirect('/student/notifications');
    }
};

const listMyStudyResources = async (req, res) => {
    const studentId = req.student.id;
    try {
        const enrolledCourses = await db.allAsync("SELECT course_id FROM enrollments WHERE student_id = ?", [studentId]);
        const enrolledCourseIds = enrolledCourses.map(ec => ec.course_id);
        let resources = [];
        let query = `SELECT sr.*, NULL as course_name FROM study_resources sr WHERE sr.course_id IS NULL`;
        let queryParams = [];
        if (enrolledCourseIds.length > 0) {
            const placeholders = enrolledCourseIds.map(() => '?').join(',');
            query += ` UNION ALL SELECT sr.*, c.name as course_name FROM study_resources sr JOIN courses c ON sr.course_id = c.id WHERE sr.course_id IN (${placeholders})`;
            queryParams.push(...enrolledCourseIds);
        }
        query += " ORDER BY course_name ASC, created_at DESC";
        resources = await db.allAsync(query, queryParams);
        const groupedResources = resources.reduce((acc, resource) => {
            const courseKey = resource.course_name || 'General Resources';
            if (!acc[courseKey]) acc[courseKey] = [];
            acc[courseKey].push(resource);
            return acc;
        }, {});

        const viewData = {
            title: 'My Study Resources',
            groupedResources: groupedResources,
            student: req.student
        };
        res.render('layouts/student_layout', {
            title: 'My Study Resources',
            bodyView: 'pages/student/study-resources',
            student: req.student,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student study resources:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve study resources. 😔');
        const errorViewData = { title: 'My Study Resources - Error', groupedResources: {}, student: req.student, errorLoading: true, errorMessage: err.message };
        res.status(500).render('layouts/student_layout', {
            title: 'Error Loading Resources',
            bodyView: 'pages/student/study-resources',
            student: req.student,
            viewData: errorViewData
        });
    }
};

const viewMyFees = async (req, res) => {
    const studentId = req.student.id;
    try {
        const fees = await db.allAsync(`SELECT description, total_amount, amount_paid, (total_amount - amount_paid) as balance, payment_date, payment_method, notes, created_at FROM fees WHERE student_id = ? ORDER BY payment_date DESC, created_at DESC`, [studentId]);
        let totalCharged = 0, totalPaid = 0;
        fees.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const overallBalance = totalCharged - totalPaid;

        const viewData = {
            title: 'My Fee Statement',
            fees: fees || [],
            overallBalance,
            student: req.student
        };
        res.render('layouts/student_layout', {
            title: 'My Fee Statement',
            bodyView: 'pages/student/fees',
            student: req.student,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student fee records:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve fee statement. 😔');
         const errorViewData = { title: 'My Fee Statement - Error', fees: [], overallBalance: 0, student: req.student, errorLoading: true, errorMessage: err.message };
        res.status(500).render('layouts/student_layout', {
            title: 'Error Loading Fees',
            bodyView: 'pages/student/fees',
            student: req.student,
            viewData: errorViewData
        });
    }
};

const viewMyAcademics = async (req, res) => {
    const studentId = req.student.id;
    try {
        const student = await db.getAsync("SELECT id, first_name, second_name, surname FROM students WHERE id = ?", [studentId]);
        if (!student) {
            req.flash('error_msg', '⚠️ Student record not found.');
            return res.redirect('/student/login');
        }

        const computerCourse = await db.getAsync("SELECT id, name FROM courses WHERE name = 'Computer Classes'");
        if (!computerCourse) {
            req.flash('error_msg', '⚠️ "Computer Classes" course not found in the system.');
            const errorViewData = {
                title: 'My Academic Records', studentDetails: student, courseName: 'N/A', unitsWithMarks: [],
                examMarks: { theory: null, practical: null }, finalGrade: 'N/A', completionStatus: 'N/A',
                errorMsg: 'Computer Classes details are unavailable.', student: req.student
            };
            return res.render('layouts/student_layout', {
                title: 'My Academic Records', bodyView: 'pages/student/academics', student: req.student, viewData: errorViewData
            });
        }

        const enrollment = await db.getAsync(
            "SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?",
            [studentId, computerCourse.id]
        );

        let unitsWithMarks = [];
        let examMarks = { theory: null, practical: null };
        let finalGradeDisplay = 'Pending';
        let completionStatusDisplay = 'Pending';

        if (enrollment) {
            const courseUnits = await db.allAsync(
                "SELECT id, unit_name, max_marks FROM course_units WHERE course_id = ? ORDER BY unit_order, unit_name",
                [computerCourse.id]
            );

            const studentUnitMarksRecords = await db.allAsync(
                "SELECT unit_id, marks_obtained FROM student_unit_marks WHERE enrollment_id = ?",
                [enrollment.id]
            );

            const studentMarksMap = new Map();
            studentUnitMarksRecords.forEach(mark => {
                studentMarksMap.set(mark.unit_id, mark.marks_obtained);
            });

            unitsWithMarks = courseUnits.map(unit => ({
                ...unit,
                marks_obtained: studentMarksMap.get(unit.id)
            }));

            examMarks = {
                theory: enrollment.theory_exam_marks,
                practical: enrollment.practical_exam_marks
            };
            finalGradeDisplay = enrollment.final_grade || 'Pending';
            completionStatusDisplay = enrollment.completion_status || 'Pending';
        } else {
             req.flash('info_msg', 'You are not currently enrolled in Computer Classes.');
        }

        const viewData = {
            title: 'My Academic Records',
            studentDetails: student,
            courseName: computerCourse.name,
            unitsWithMarks,
            examMarks,
            finalGrade: finalGradeDisplay,
            completionStatus: completionStatusDisplay,
            student: req.student
        };

        res.render('layouts/student_layout', {
            title: 'My Academic Records',
            bodyView: 'pages/student/academics',
            student: req.student,
            viewData: viewData
        });

    } catch (err) {
        console.error("Error fetching student academic records:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve academic records. 😔');
        res.redirect('/student/dashboard');
    }
};

const viewWifiCredentials = async (req, res) => {
    try {
        const settingKeys = ['wifi_ssid', 'wifi_password_plaintext', 'wifi_disclaimer'];
        const settingsData = await db.allAsync( `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?, ?)`, settingsKeys );
        const settings = {};
        settingsData.forEach(row => { settings[row.setting_key] = row.setting_value; });

        const viewData = {
            title: 'WiFi Credentials',
            wifi_ssid: settings.wifi_ssid || 'Not Set by Admin',
            wifi_password: settings.wifi_password_plaintext || 'Not Set by Admin',
            wifi_disclaimer: settings.wifi_disclaimer || '',
            student: req.student
        };
        res.render('layouts/student_layout', {
            title: 'WiFi Credentials',
            bodyView: 'pages/student/wifi-credentials',
            student: req.student,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching WiFi credentials for student:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve WiFi information at this time. 😔');
        const errorViewData = {
            title: 'WiFi Credentials - Error',
            student: req.student,
            errorLoading: true,
            errorMessage: err.message,
            wifi_ssid: 'Error', wifi_password: 'Error', wifi_disclaimer: ''
        };
        res.status(500).render('layouts/student_layout', {
            title: 'Error Loading WiFi Info',
            bodyView: 'pages/student/wifi-credentials',
            student: req.student,
            viewData: errorViewData
        });
    }
};

const renderMyCertificatesPage = async (req, res) => {
    const studentId = req.student.id;
    try {
        const feeRecords = await db.allAsync("SELECT total_amount, amount_paid FROM fees WHERE student_id = ?", [studentId]);
        let totalCharged = 0; let totalPaid = 0;
        feeRecords.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const feesCleared = (totalCharged - totalPaid) <= 0;
        const passedEnrollments = await db.allAsync(`SELECT e.id as enrollment_id, c.name as course_name, e.final_grade, e.certificate_issued_at FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.student_id = ? AND e.final_grade = 'Pass' ORDER BY c.name`, [studentId]); // Assuming 'Pass' is one of the positive final grades
        const eligibleCertificates = passedEnrollments.map(pe => ({ ...pe, is_eligible_for_download: feesCleared }));

        const viewData = {
            title: 'My Certificates',
            eligibleCertificates,
            feesCleared,
            student: req.student
        };
        res.render('layouts/student_layout', {
            title: 'My Certificates',
            bodyView: 'pages/student/certificates',
            student: req.student,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching certificate eligibility:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve certificate information. 😔');
        const errorViewData = { title: 'My Certificates - Error', eligibleCertificates: [], feesCleared: false, student: req.student, errorLoading: true, errorMessage: err.message };
        res.status(500).render('layouts/student_layout', {
            title: 'Error Loading Certificates',
            bodyView: 'pages/student/certificates',
            student: req.student,
            viewData: errorViewData
        });
    }
};

const downloadCertificate = async (req, res) => {
    const studentId = req.student.id;
    const enrollmentId = req.params.enrollmentId;
    try {
        const feeRecords = await db.allAsync("SELECT total_amount, amount_paid FROM fees WHERE student_id = ?", [studentId]);
        let totalCharged = 0; let totalPaid = 0;
        feeRecords.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const feesCleared = (totalCharged - totalPaid) <= 0;
        const enrollment = await db.getAsync(`SELECT e.id, s.first_name as student_name, s.registration_number, c.name as course_name, e.final_grade, e.updated_at as completion_date FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE e.id = ? AND e.student_id = ? AND e.final_grade = 'Pass'`, [enrollmentId, studentId]);
        if (!enrollment) { req.flash('error_msg', '⚠️ Course completion record not found or not passed.'); return res.redirect('/student/my-certificates'); }
        if (!feesCleared) { req.flash('error_msg', '⚠️ Cannot download certificate due to outstanding fees.'); return res.redirect('/student/my-certificates'); }
        res.render('pages/student/certificate-template', { layout: 'partials/certificate-layout', title: `Certificate - ${enrollment.course_name}`, student_name: enrollment.student_name, course_name: enrollment.course_name, registration_number: enrollment.registration_number, completion_date: new Date(enrollment.completion_date).toLocaleDateString() });
    } catch (err) {
        console.error("Error generating certificate:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Could not generate certificate. 😔');
        res.redirect('/student/my-certificates');
    }
};

const renderChangePasswordForm = (req, res) => {
    const viewData = {
        title: 'Change Password',
        student: req.student,
        passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8,
        errors: req.flash('validation_errors') ? JSON.parse(req.flash('validation_errors')[0] || '[]') : []
    };
    res.render('layouts/student_layout', {
        title: 'Change Password',
        bodyView: 'pages/student/profile/change-password',
        student: req.student,
        viewData: viewData
    });
};

const handleChangePassword = [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword').isLength({ min: parseInt(process.env.PASSWORD_MIN_LENGTH || 8, 10) }).withMessage(`New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters.`),
    body('confirmNewPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('New passwords do not match.');
        }
        return true;
    }),
    async (req, res) => {
        const errors = validationResult(req);
        const { currentPassword, newPassword } = req.body;
        const studentId = req.student.id;

        if (!errors.isEmpty()) {
            req.flash('validation_errors', JSON.stringify(errors.array()));
            return res.redirect('/student/profile/change-password');
        }
        try {
            const student = await db.getAsync("SELECT password_hash FROM students WHERE id = ?", [studentId]);
            if (!student) { req.flash('error_msg', '⚠️ Student not found.'); return res.redirect('/student/dashboard'); }
            const isMatch = await bcrypt.compare(currentPassword, student.password_hash);
            if (!isMatch) {
                req.flash('validation_errors', JSON.stringify([{param: 'currentPassword', msg: 'Incorrect current password.'}]));
                return res.redirect('/student/profile/change-password');
            }
            const isDefaultPassword = await bcrypt.compare(process.env.DEFAULT_STUDENT_PASSWORD, student.password_hash);
            if (!isDefaultPassword && newPassword === currentPassword) { // Only block if not default and same as current
                 req.flash('validation_errors', JSON.stringify([{param: 'newPassword', msg: 'New password cannot be the same as your current password.'}]));
                 return res.redirect('/student/profile/change-password');
            }
            if (isDefaultPassword && newPassword === process.env.DEFAULT_STUDENT_PASSWORD) {
                 req.flash('validation_errors', JSON.stringify([{param: 'newPassword', msg: 'New password cannot be the same as the default password.'}]));
                 return res.redirect('/student/profile/change-password');
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            await db.runAsync( "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newPasswordHash, studentId] );
            req.flash('success_msg', '✨ Update Successful! ✨ Your password has been changed successfully! 🎉');
            res.redirect('/student/dashboard');
        } catch (err) {
            console.error("Error changing student password:", err);
            req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while changing your password. 😔');
            res.redirect('/student/profile/change-password');
        }
    }
];


const renderEditNokForm = async (req, res) => {
    const studentId = req.student.id;
    try {
        const studentData = await db.getAsync("SELECT next_of_kin_details FROM students WHERE id = ?", [studentId]);
        let currentNokDetails = {};
        if (studentData && studentData.next_of_kin_details) {
            try {
                currentNokDetails = JSON.parse(studentData.next_of_kin_details);
            } catch (e) {
                console.error("Error parsing NOK details for student " + studentId, e);
            }
        }
        const viewData = {
            title: 'Update Next of Kin Details',
            student: req.student,
            currentNokDetails,
            oldInput: {
                nokName: req.flash('nokName')[0] || currentNokDetails.name || '',
                nokRelationship: req.flash('nokRelationship')[0] || currentNokDetails.relationship || '',
                nokPhone: req.flash('nokPhone')[0] || currentNokDetails.phone || '',
                nokEmail: req.flash('nokEmail')[0] || currentNokDetails.email || ''
            },
            errors: JSON.parse(req.flash('validation_errors_profile_nok')[0] || '[]')
        };
        res.render('layouts/student_layout', {
            title: 'Update Next of Kin',
            bodyView: 'pages/student/profile/edit-nok',
            student: req.student,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student NOK details for edit form:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t load your Next of Kin details. 😔');
        const errorViewData = { title: 'Update Next of Kin - Error', student: req.student, currentNokDetails: {}, oldInput: {}, errors: [{msg: err.message}], errorLoading: true };
         res.status(500).render('layouts/student_layout', {
            title: 'Error Editing NOK',
            bodyView: 'pages/student/profile/edit-nok',
            student: req.student,
            viewData: errorViewData
        });
    }
};

const handleUpdateNok = [
    body('nokName').trim().notEmpty().withMessage('Next of Kin Name is required.'),
    body('nokRelationship').trim().notEmpty().withMessage('Relationship to you is required.'),
    body('nokPhone').trim().notEmpty().withMessage('Next of Kin Phone is required.').matches(/^(0[17])\d{8}$/).withMessage('Invalid phone number format (must be 10 digits starting 01/07).'),
    body('nokEmail').optional({ checkFalsy: true }).isEmail().withMessage('Invalid Next of Kin email format.'),

    async (req, res) => {
        const errors = validationResult(req);
        const { nokName, nokRelationship, nokPhone, nokEmail } = req.body;
        const studentId = req.student.id;

        if (!errors.isEmpty()) {
            req.flash('validation_errors_profile_nok', JSON.stringify(errors.array()));
            req.flash('nokName', nokName);
            req.flash('nokRelationship', nokRelationship);
            req.flash('nokPhone', nokPhone);
            req.flash('nokEmail', nokEmail);
            return res.redirect('/student/profile/edit-nok');
        }

        const nokDetails = JSON.stringify({ name: nokName, relationship: nokRelationship, phone: nokPhone, email: nokEmail || '' });
        try {
            await db.runAsync( "UPDATE students SET next_of_kin_details = ?, is_profile_complete = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nokDetails, studentId] );
            req.flash('success_msg', '✨ Update Successful! ✨ Next of Kin details updated successfully! 🎉');
            res.redirect('/student/dashboard');
        } catch (err) {
            console.error("Error updating student NOK details:", err);
            req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while updating your Next of Kin details. 😔');
            req.flash('nokName', nokName);
            req.flash('nokRelationship', nokRelationship);
            req.flash('nokPhone', nokPhone);
            req.flash('nokEmail', nokEmail);
            res.redirect('/student/profile/edit-nok');
        }
    }
];

const retrieveStudentCredentials = async (req, res) => {
    const { email, anyName } = req.body;
    const baseRedirectUrl = '/student/login';
    const paramsForRedirect = new URLSearchParams();
    paramsForRedirect.append('activeTab', 'new-student-panel');

    if (!email || !anyName) {
        req.flash('error_msg', '⚠️ Email and a Name are required.');
        return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}#new-student-panel`);
    }

    try {
        const student = await db.getAsync(
            `SELECT id, registration_number, first_name, second_name, surname, email,
                    requires_password_change, credentials_retrieved_once
             FROM students
             WHERE lower(email) = lower(?)
               AND (lower(first_name) = lower(?) OR lower(second_name) = lower(?) OR lower(surname) = lower(?))`,
            [email.trim(), anyName.trim(), anyName.trim(), anyName.trim()]
        );

        if (!student) {
            req.flash('error_msg', '⚠️ No matching student record found with the provided Email and Name.');
            return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}#new-student-panel`);
        }

        if (!student.requires_password_change && student.credentials_retrieved_once) {
            req.flash('info_msg', 'ℹ️ Account setup appears complete and initial credentials previously retrieved. If you forgot your password, please use the "Forgot Password" link on the login page.');
            paramsForRedirect.delete('activeTab');
            return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}`);
        }

        if (student.credentials_retrieved_once) {
            req.flash('info_msg', 'ℹ️ Initial credentials for this account have already been retrieved. If you have forgotten your password, please use the "Forgot Password" link on the login page.');
            paramsForRedirect.delete('activeTab');
            return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}`);
        }

        await db.runAsync("UPDATE students SET credentials_retrieved_once = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [student.id]);

        const studentFullName = `${student.first_name} ${student.second_name || ''} ${student.surname || ''}`.replace(/\s+/g, ' ').trim();

        paramsForRedirect.append('retrievedStudentName', studentFullName);
        paramsForRedirect.append('retrievedRegNo', student.registration_number);
        paramsForRedirect.append('retrievedPassword', process.env.DEFAULT_STUDENT_PASSWORD);

        req.flash('info_msg', 'Please note down your credentials and change your password upon first login.');

        return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}#new-student-panel`);

    } catch (err) {
        console.error("Error retrieving student credentials:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while retrieving credentials. Please try again. 😔');
        return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}#new-student-panel`);
    }
};


module.exports = {
    loginStudent, logoutStudent,
    renderChangePasswordInitialForm, handleChangePasswordInitial,
    renderCompleteProfileInitialForm, handleCompleteProfileInitial,
    handleForgotPassword, renderResetPasswordForm, handleResetPassword,
    viewMyAcademics, viewMyFees,
    listMyNotifications, markNotificationAsRead,
    listMyStudyResources, viewWifiCredentials,
    renderMyCertificatesPage, downloadCertificate,
    renderChangePasswordForm, handleChangePassword,
    renderEditNokForm, handleUpdateNok,
    retrieveStudentCredentials
};
