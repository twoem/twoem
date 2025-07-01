const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { getJwtSecret } = require('../utils/jwtHelper'); // Import getJwtSecret

// Student Login
const loginStudent = async (req, res) => {
    const { registrationNumber, password } = req.body;
    const loginPageParams = { title: 'Student Portal Login', activeTab: 'login-panel' };

    if (!registrationNumber || !password) {
        req.flash('error_msg', '⚠️ Registration number and password are required.'); // Using error_msg for consistency
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
            // isAdmin: false, // Can explicitly set if needed, or rely on absence of isAdmin:true
            isStudent: true // Explicitly mark as student token
        };
        const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRE || '1h' });

        res.cookie('student_auth_token', token, { // Changed cookie name
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: parseInt(process.env.JWT_EXPIRE_MS || (1 * 60 * 60 * 1000).toString(), 10),
            path: '/',
            sameSite: 'Lax' // Explicitly set SameSite
        });

        req.flash('success_msg', '🎉 Welcome Back! 🎉 You’ve successfully logged in🌟');

        if (student.requires_password_change) {
            req.flash('info_msg', 'Please change your default password to continue.'); // info_msg for neutral notifications
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
    res.cookie('student_auth_token', '', { // Changed cookie name
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(0),
        path: '/',
        sameSite: 'Lax' // Explicitly set SameSite
    });
    req.flash('success_msg', '✨ Success! ✨ You have been logged out successfully! 🎉');
    res.redirect('/student/login');
};

// ... (rest of the functions: renderChangePasswordInitialForm, handleChangePasswordInitial, etc. remain the same as per previous full file content)
// Ensure all other functions that might have used req.student (from a generic 'token' cookie) are still fine
// or if they need to be aware of the specific 'student_auth_token' (though middleware handles populating req.student).
// The current functions mostly rely on req.student.id from the decoded token, which should be fine.

const renderChangePasswordInitialForm = (req, res) => { /* ... जस का तस ... */
    res.render('pages/student/change-password-initial', { title: 'Change Your Password', student: req.student, defaultStudentPassword: process.env.DEFAULT_STUDENT_PASSWORD, passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8 });
};
const handleChangePasswordInitial = async (req, res) => { /* ... जस का तस ... */
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const studentId = req.student.id;
    const redirectUrl = '/student/change-password-initial';
    if (currentPassword !== process.env.DEFAULT_STUDENT_PASSWORD) { req.flash('error_msg', 'Incorrect current default password.'); return res.redirect(redirectUrl); }
    if (newPassword.length < (parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8)) { req.flash('error_msg', `New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters long.`); return res.redirect(redirectUrl); }
    if (newPassword !== confirmNewPassword) { req.flash('error_msg', 'New passwords do not match.'); return res.redirect(redirectUrl); }
    if (newPassword === process.env.DEFAULT_STUDENT_PASSWORD) { req.flash('error_msg', 'New password cannot be the same as the default password.'); return res.redirect(redirectUrl); }
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
};
const renderCompleteProfileInitialForm = (req, res) => { /* ... जस का तस ... */
    res.render('pages/student/complete-profile-initial', { title: 'Complete Your Profile', student: req.student, nokName: '', nokRelationship: '', nokPhone: '', nokEmail: '' });
};
const handleCompleteProfileInitial = async (req, res) => { /* ... जस का तस ... */
    const { nokName, nokRelationship, nokPhone, nokEmail } = req.body;
    const studentId = req.student.id;
    if (!nokName || !nokRelationship || !nokPhone) {
        req.flash('error_msg', 'Please fill in all required Next of Kin details (Name, Relationship, Phone).');
        return res.status(400).render('pages/student/complete-profile-initial', { title: 'Complete Your Profile', student: req.student, error: req.flash('error_msg'), nokName, nokRelationship, nokPhone, nokEmail });
    }
    const nokDetails = JSON.stringify({ name: nokName, relationship: nokRelationship, phone: nokPhone, email: nokEmail });
    try {
        await db.runAsync("UPDATE students SET next_of_kin_details = ?, is_profile_complete = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nokDetails, studentId]);
        req.flash('success_msg', '✨ Update Successful! ✨ Profile completed successfully! Welcome to your dashboard! 🎉');
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error("Error completing initial profile:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while saving your profile. 😔');
         res.status(500).render('pages/student/complete-profile-initial', { title: 'Complete Your Profile', student: req.student, nokName, nokRelationship, nokPhone, nokEmail }); // Render might be an issue with flash
    }
};
function generateOtp() { /* ... जस का तस ... */
    const crypto = require('crypto');
    return crypto.randomInt(100000, 999999).toString();
}
const handleForgotPassword = async (req, res) => { /* ... जस का तस ... */
    const { registrationNumber, email } = req.body;
    const activeTabOnError = 'forgot-password-panel';
    const loginRedirectUrl = `/student/login?activeTab=${activeTabOnError}#${activeTabOnError}`;

    if (!registrationNumber || !email) {
        req.flash('error_msg', '⚠️ Registration number and email are required.');
        return res.redirect(loginRedirectUrl);
    }
    try {
        const student = await db.getAsync("SELECT id, email, first_name FROM students WHERE registration_number = ? AND lower(email) = lower(?)", [registrationNumber, email.trim()]);
        if (!student) {
            req.flash('error_msg', '⚠️ No student found with that registration number and email address.');
            return res.redirect(loginRedirectUrl);
        }
        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await db.runAsync("INSERT INTO password_reset_tokens (student_id, token_hash, expires_at) VALUES (?, ?, ?)", [student.id, otpHash, expiresAt.toISOString()]);

        const { sendEmailWithTemplate } = require('../config/mailer');
        const emailSubject = "Your Password Reset OTP - Twoem Online Productions";
        const emailData = { studentName: student.first_name, otp: otp };
        try {
            await sendEmailWithTemplate({ to: student.email, subject: emailSubject, templateName: 'otp-email', data: emailData });
            req.flash('success_msg', '✅ Email Sent Successfully! 📩 Your message is on its way! The email was delivered successfully. 🎉');
        } catch (emailError) {
            console.error("Forgot password - email send error:", emailError);
            req.flash('error_msg', '❌ Failed to Send Email ⚠️ Oops! Something went wrong. Try again Later');
            // Still redirect to OTP form as token is generated, user might get it via other means or admin can help
        }
        res.redirect(`/student/reset-password-form?regNo=${encodeURIComponent(registrationNumber)}`);
    } catch (err) {
        console.error("Forgot password error (overall):", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Something went wrong. Please try again. 😔');
        res.redirect(loginRedirectUrl);
    }
};
const renderResetPasswordForm = (req, res) => { /* ... जस का तस ... */
    const { regNo } = req.query;
    if (!regNo) {
        req.flash('error_msg', 'Invalid password reset link or session.');
        return res.redirect('/student/login');
    }
    res.render('pages/student/reset-password-form', { title: 'Reset Your Password', registrationNumber: regNo, passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8 });
};
const handleResetPassword = async (req, res) => { /* ... जस का तस ... */
    const { registrationNumber, otp, newPassword, confirmNewPassword } = req.body;
    const errorRedirectUrl = `/student/reset-password-form?regNo=${encodeURIComponent(registrationNumber)}`;

    if (!registrationNumber || !otp || !newPassword || !confirmNewPassword) { req.flash('error_msg', 'All fields are required.'); return res.redirect(errorRedirectUrl); }
    if (newPassword.length < (parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8)) { req.flash('error_msg', `New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters.`); return res.redirect(errorRedirectUrl); }
    if (newPassword !== confirmNewPassword) { req.flash('error_msg', 'New passwords do not match.'); return res.redirect(errorRedirectUrl); }
    try {
        const student = await db.getAsync("SELECT id FROM students WHERE registration_number = ?", [registrationNumber]);
        if (!student) { req.flash('error_msg', 'Invalid registration number.'); return res.redirect(errorRedirectUrl); }
        const tokenRecord = await db.getAsync("SELECT * FROM password_reset_tokens WHERE student_id = ? AND used = FALSE ORDER BY created_at DESC LIMIT 1", [student.id]);
        if (!tokenRecord) { req.flash('error_msg', 'No pending OTP found or already used.'); return res.redirect(errorRedirectUrl); }
        const isOtpMatch = await bcrypt.compare(otp, tokenRecord.token_hash);
        if (!isOtpMatch) { req.flash('error_msg', 'Invalid OTP.'); return res.redirect(errorRedirectUrl); }
        if (new Date() > new Date(tokenRecord.expires_at)) { await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecord.id]); req.flash('error_msg', 'OTP has expired.'); return res.redirect(errorRedirectUrl); }

        const studentDetails = await db.getAsync("SELECT password_hash, requires_password_change FROM students WHERE id = ?", [student.id]);
        const isStillOnDefault = await bcrypt.compare(process.env.DEFAULT_STUDENT_PASSWORD, studentDetails.password_hash);
        if (isStillOnDefault && newPassword === process.env.DEFAULT_STUDENT_PASSWORD) {
             req.flash('error_msg', 'New password cannot be the default password if you are resetting from it.'); return res.redirect(errorRedirectUrl);
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync("UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newPasswordHash, student.id]);
        await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecord.id]);
        req.flash('success_msg', '✨ Update Successful! ✨ Password reset successfully. You can now login. 🎉');
        res.redirect('/student/login');
    } catch (err) {
        console.error("Error resetting password:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred. Please try again. 😔');
        res.redirect(errorRedirectUrl);
    }
};
const listMyNotifications = async (req, res) => { /* ... जस का तस ... */
    const studentId = req.student.id;
    try {
        const enrolledCourses = await db.allAsync("SELECT course_id FROM enrollments WHERE student_id = ?", [studentId]);
        const enrolledCourseIds = enrolledCourses.map(ec => ec.course_id);
        let queryParams = [studentId, studentId]; // studentId for join, studentId for target_audience_identifier
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
            student: req.student // For potential use in view if needed beyond layout
        };
        res.render('layouts/student_layout', {
            title: 'My Notifications', // For browser <title>
            bodyView: 'pages/student/notifications',
            student: req.student, // For layout/sidebar
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
const markNotificationAsRead = async (req, res) => { /* ... जस का तस ... */
    const studentId = req.student.id;
    const notificationId = req.params.notificationId;
    try {
        const existingRead = await db.getAsync( "SELECT id FROM student_notification_reads WHERE student_id = ? AND notification_id = ?", [studentId, notificationId] );
        if (!existingRead) {
            await db.runAsync( "INSERT INTO student_notification_reads (student_id, notification_id) VALUES (?, ?)", [studentId, notificationId] );
        }
        res.redirect('/student/notifications'); // No specific success message needed for this action usually
    } catch (err) {
        console.error("Error marking notification as read:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ Could not mark notification as read. 😔');
        res.redirect('/student/notifications');
    }
};
const listMyStudyResources = async (req, res) => { /* ... जस का तस ... */
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
            student: req.student // For potential use in view
        };
        res.render('layouts/student_layout', {
            title: 'My Study Resources', // For browser <title>
            bodyView: 'pages/student/study-resources',
            student: req.student, // For layout/sidebar
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
const viewMyFees = async (req, res) => { /* ... जस का तस ... */
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
            student: req.student // Student object might be needed for display name on page
        };
        res.render('layouts/student_layout', {
            title: 'My Fee Statement', // For browser <title>
            bodyView: 'pages/student/fees',
            student: req.student, // For layout/sidebar
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student fee records:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t retrieve fee statement. 😔');
        // Optionally render error within layout
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

        // Assuming "Computer Classes" is the target course for detailed marks
        const computerCourse = await db.getAsync("SELECT id, name FROM courses WHERE name = 'Computer Classes'");
        if (!computerCourse) {
            req.flash('error_msg', '⚠️ "Computer Classes" course not found in the system.');
            // Render the page with an empty state or a message
            return res.render('pages/student/academics', {
                title: 'My Academic Records',
                student: req.student,
                courseName: 'N/A',
                unitsWithMarks: [],
                examMarks: { theory: null, practical: null },
                finalGrade: 'N/A',
                completionStatus: 'N/A',
                errorMsg: 'Computer Classes details are unavailable.'
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
                marks_obtained: studentMarksMap.get(unit.id) // Will be undefined if no mark
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
            title: 'My Academic Records', // For page heading
            studentDetails: student, // For displaying name on page
            courseName: computerCourse.name,
            unitsWithMarks,
            examMarks,
            finalGrade: finalGradeDisplay,
            completionStatus: completionStatusDisplay
        };

        res.render('layouts/student_layout', {
            title: 'My Academic Records', // For browser <title>
            bodyView: 'pages/student/academics',
            student: req.student, // For layout/sidebar
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
        const settingsData = await db.allAsync( `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?, ?)`, settingKeys );
        const settings = {};
        settingsData.forEach(row => { settings[row.setting_key] = row.setting_value; });

        const viewData = {
            title: 'WiFi Credentials',
            wifi_ssid: settings.wifi_ssid || 'Not Set by Admin',
            wifi_password: settings.wifi_password_plaintext || 'Not Set by Admin',
            wifi_disclaimer: settings.wifi_disclaimer || '',
            student: req.student // For potential use in view if needed
        };
        res.render('layouts/student_layout', {
            title: 'WiFi Credentials', // For browser <title>
            bodyView: 'pages/student/wifi-credentials',
            student: req.student, // For layout/sidebar
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
const viewWifiCredentials = async (req, res) => {
    try {
        const settingKeys = ['wifi_ssid', 'wifi_password_plaintext', 'wifi_disclaimer'];
        const settingsData = await db.allAsync( `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?, ?)`, settingKeys );
        const settings = {};
        settingsData.forEach(row => { settings[row.setting_key] = row.setting_value; });

        const viewData = {
            title: 'WiFi Credentials',
            wifi_ssid: settings.wifi_ssid || 'Not Set by Admin',
            wifi_password: settings.wifi_password_plaintext || 'Not Set by Admin',
            wifi_disclaimer: settings.wifi_disclaimer || '',
            student: req.student // For potential use in view if needed
        };
        res.render('layouts/student_layout', {
            title: 'WiFi Credentials', // For browser <title>
            bodyView: 'pages/student/wifi-credentials',
            student: req.student, // For layout/sidebar
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
            title: 'My Certificates', // For browser <title>
            bodyView: 'pages/student/certificates',
            student: req.student, // For layout/sidebar
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
const downloadCertificate = async (req, res) => { /* ... जस का तस ... */
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
        student: req.student, // req.student is already available from auth middleware
        passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8
    };
    res.render('layouts/student_layout', {
        title: 'Change Password', // For browser <title>
        bodyView: 'pages/student/profile/change-password',
        student: req.student, // For layout/sidebar
        viewData: viewData
    });
};
const handleChangePassword = async (req, res) => { /* ... जस का तस ... */
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const studentId = req.student.id;
    if (!currentPassword || !newPassword || !confirmNewPassword) { req.flash('error_msg', '⚠️ All password fields are required.'); return res.redirect('/student/profile/change-password'); }
    if (newPassword.length < (parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8)) { req.flash('error_msg', `⚠️ New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters long.`); return res.redirect('/student/profile/change-password'); }
    if (newPassword !== confirmNewPassword) { req.flash('error_msg', '⚠️ New passwords do not match.'); return res.redirect('/student/profile/change-password'); }
    try {
        const student = await db.getAsync("SELECT password_hash FROM students WHERE id = ?", [studentId]);
        if (!student) { req.flash('error_msg', '⚠️ Student not found.'); return res.redirect('/student/dashboard'); } // Should not happen if middleware is correct
        const isMatch = await bcrypt.compare(currentPassword, student.password_hash);
        if (!isMatch) { req.flash('error_msg', '⚠️ Incorrect current password.'); return res.redirect('/student/profile/change-password'); }
        const isDefaultPassword = await bcrypt.compare(process.env.DEFAULT_STUDENT_PASSWORD, student.password_hash);
        if (!isDefaultPassword && newPassword === currentPassword) { req.flash('error_msg', '⚠️ New password cannot be the same as your current password.'); return res.redirect('/student/profile/change-password');}

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync( "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newPasswordHash, studentId] );
        req.flash('success_msg', '✨ Update Successful! ✨ Your password has been changed successfully! 🎉');
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error("Error changing student password:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while changing your password. 😔');
        res.redirect('/student/profile/change-password');
    }
};
const renderEditNokForm = async (req, res) => { /* ... जस का तस ... */
    const studentId = req.student.id;
    try {
        const studentData = await db.getAsync("SELECT next_of_kin_details FROM students WHERE id = ?", [studentId]);
        let currentNokDetails = {};
        if (studentData && studentData.next_of_kin_details) {
            try {
                currentNokDetails = JSON.parse(studentData.next_of_kin_details);
            } catch (e) {
                console.error("Error parsing NOK details for student " + studentId, e);
                // Keep currentNokDetails as {}
            }
        }
        const viewData = {
            title: 'Update Next of Kin Details',
            student: req.student, // For display if needed, like name
            currentNokDetails,
            // For pre-filling form, use flashed old input if available, else currentNokDetails
            oldInput: {
                nokName: req.flash('nokName')[0] || currentNokDetails.name || '',
                nokRelationship: req.flash('nokRelationship')[0] || currentNokDetails.relationship || '',
                nokPhone: req.flash('nokPhone')[0] || currentNokDetails.phone || '',
                nokEmail: req.flash('nokEmail')[0] || currentNokDetails.email || ''
            },
            errors: JSON.parse(req.flash('validation_errors')[0] || '[]')
        };
        res.render('layouts/student_layout', {
            title: 'Update Next of Kin', // For browser <title>
            bodyView: 'pages/student/profile/edit-nok',
            student: req.student, // For layout/sidebar
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student NOK details for edit form:", err);
        req.flash('error_msg', '⚠️ Failed to Load Data! We couldn’t load your Next of Kin details. 😔');
        // Fallback rendering for critical error
        const errorViewData = { title: 'Update Next of Kin - Error', student: req.student, currentNokDetails: {}, oldInput: {}, errors: [{msg: err.message}], errorLoading: true };
         res.status(500).render('layouts/student_layout', {
            title: 'Error Editing NOK',
            bodyView: 'pages/student/profile/edit-nok',
            student: req.student,
            viewData: errorViewData
        });
    }
};
const handleUpdateNok = async (req, res) => { /* ... जस का तस ... */
    const { nokName, nokRelationship, nokPhone, nokEmail } = req.body;
    const studentId = req.student.id;
    if (!nokName || !nokRelationship || !nokPhone) { req.flash('error_msg', 'Please fill in all required Next of Kin fields (Name, Relationship, Phone).'); return res.redirect('/student/profile/edit-nok'); }
    const nokDetails = JSON.stringify({ name: nokName, relationship: nokRelationship, phone: nokPhone, email: nokEmail || '' });
    try {
        await db.runAsync( "UPDATE students SET next_of_kin_details = ?, is_profile_complete = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nokDetails, studentId] );
        req.flash('success_msg', '✨ Update Successful! ✨ Next of Kin details updated successfully! 🎉');
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error("Error updating student NOK details:", err);
        req.flash('error_msg', '❌ Operation Failed! ❌ An error occurred while updating your Next of Kin details. 😔');
        res.redirect('/student/profile/edit-nok');
    }
};
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
            paramsForRedirect.delete('activeTab'); // Default to login tab for this message
            return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}`);
        }

        if (student.credentials_retrieved_once) {
            req.flash('info_msg', 'ℹ️ Initial credentials for this account have already been retrieved. If you have forgotten your password, please use the "Forgot Password" link on the login page.');
            paramsForRedirect.delete('activeTab'); // Default to login tab for this message
            return res.redirect(`${baseRedirectUrl}?${paramsForRedirect.toString()}`);
        }

        await db.runAsync("UPDATE students SET credentials_retrieved_once = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [student.id]);

        const studentFullName = `${student.first_name} ${student.second_name || ''} ${student.surname || ''}`.replace(/\s+/g, ' ').trim();

        // Add retrieved credentials to redirect query params instead of flashing them
        paramsForRedirect.append('retrievedStudentName', studentFullName);
        paramsForRedirect.append('retrievedRegNo', student.registration_number);
        paramsForRedirect.append('retrievedPassword', process.env.DEFAULT_STUDENT_PASSWORD);

        req.flash('info_msg', 'Please note down your credentials and change your password upon first login.'); // A general info message

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
