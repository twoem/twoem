const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { body, validationResult } = require('express-validator');
const { getJwtSecret } = require('../utils/jwtHelper'); // Import getJwtSecret
const crypto = require('crypto'); // Ensure crypto is imported at the top for token hashing
const validator = require('validator'); // For email validation

// Student Login
const loginStudent = async (req, res) => {
    const { registrationNumber, password } = req.body;
    if (!registrationNumber || !password) {
        req.flash('error', 'Registration number and password are required.');
        return res.status(400).render('pages/student-login', { title: 'Student Portal Login', activeTab: 'login-panel'});
    }
    try {
        const student = await db.getAsync("SELECT * FROM students WHERE registration_number = ?", [registrationNumber]);
        if (!student) {
            req.flash('error', 'Invalid registration number or password.');
            return res.status(401).render('pages/student-login', { title: 'Student Portal Login', activeTab: 'login-panel'});
        }
        const isMatch = await bcrypt.compare(password, student.password_hash);
        if (!isMatch) {
            req.flash('error', 'Invalid registration number or password.');
            return res.status(401).render('pages/student-login', { title: 'Student Portal Login', activeTab: 'login-panel'});
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

        if (student.requires_password_change) return res.redirect('/student/change-password-initial');
        if (!student.is_profile_complete) return res.redirect('/student/complete-profile-initial');
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error("Student login error:", err);
        req.flash('error', 'An error occurred during login. Please try again.');
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
    req.flash('success_msg', 'You have been logged out successfully.');
    res.redirect('/student/login');
};

const renderChangePasswordInitialForm = (req, res) => {
    res.render('pages/student/change-password-initial', { title: 'Change Your Password', student: req.student, defaultStudentPassword: process.env.DEFAULT_STUDENT_PASSWORD, passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8 });
};

const handleChangePasswordInitial = async (req, res) => {
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
        if (!updatedStudent.is_profile_complete) {
            req.flash('success_msg', 'Password changed successfully. Please complete your profile.');
            res.redirect('/student/complete-profile-initial');
        } else {
            req.flash('success_msg', 'Password changed successfully.');
            res.redirect('/student/dashboard');
        }
    } catch (err) { console.error("Error changing initial password:", err); req.flash('error_msg', 'An error occurred while changing password.'); res.redirect(redirectUrl);}
};

const renderCompleteProfileInitialForm = (req, res) => {
    res.render('pages/student/complete-profile-initial', { title: 'Complete Your Profile', student: req.student, nokName: '', nokRelationship: '', nokPhone: '', nokEmail: '' });
};

const handleCompleteProfileInitial = async (req, res) => {
    const { nokName, nokRelationship, nokPhone, nokEmail } = req.body;
    const studentId = req.student.id;
    if (!nokName || !nokRelationship || !nokPhone) {
        req.flash('error_msg', 'Please fill in all required Next of Kin details (Name, Relationship, Phone).');
        return res.status(400).render('pages/student/complete-profile-initial', { title: 'Complete Your Profile', student: req.student, error: req.flash('error_msg'), nokName, nokRelationship, nokPhone, nokEmail });
    }
    const nokDetails = JSON.stringify({ name: nokName, relationship: nokRelationship, phone: nokPhone, email: nokEmail });
    try {
        await db.runAsync("UPDATE students SET next_of_kin_details = ?, is_profile_complete = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nokDetails, studentId]);
        req.flash('success_msg', 'Profile completed successfully. Welcome to your dashboard!');
        res.redirect('/student/dashboard');
    } catch (err) {
        console.error("Error completing initial profile:", err);
        req.flash('error_msg', 'An error occurred while saving your profile.');
         res.status(500).render('pages/student/complete-profile-initial', { title: 'Complete Your Profile', student: req.student, nokName, nokRelationship, nokPhone, nokEmail });
    }
};

function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

const handleForgotPassword = async (req, res) => {
    const { registrationNumber, email } = req.body;
    const activeTabOnError = 'forgot-password-panel';
    const loginRedirectUrl = `/student/login?activeTab=${activeTabOnError}#${activeTabOnError}`;

    if (!registrationNumber || !email) {
        req.flash('error', 'Registration number and email are required.');
        return res.redirect(loginRedirectUrl);
    }
    try {
        const student = await db.getAsync("SELECT id, email, first_name FROM students WHERE registration_number = ? AND lower(email) = lower(?)", [registrationNumber, email.trim()]);
        if (!student) {
            req.flash('error', 'No student found with that registration number and email address.');
            return res.redirect(loginRedirectUrl);
        }
        const otp = generateOtp();
        const otpHash = await bcrypt.hash(otp, 10);
        const urlToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        await db.runAsync(
            "INSERT INTO password_reset_tokens (student_id, token_hash, url_token, expires_at) VALUES (?, ?, ?, ?)",
            [student.id, otpHash, urlToken, expiresAt.toISOString()]
        );

        const { sendEmailWithTemplate } = require('../config/mailer');
        const emailSubject = "Password Reset Instructions - Twoem Online Productions";
        const resetLink = `${req.protocol}://${req.get('host')}/student/reset-password-with-token/${urlToken}`;
        const emailData = {
            studentName: student.first_name,
            otp: otp,
            resetLink: resetLink,
            siteUrl: process.env.FRONTEND_URL || 'https://twoemcyberkagwe.onrender.com' // Added siteUrl
        };
        await sendEmailWithTemplate({ to: student.email, subject: emailSubject, templateName: 'otp-email', data: emailData });

        req.flash('success_msg', 'Password reset instructions (OTP and link) sent to your email. Please check your inbox.');
        res.redirect(`/student/reset-password-form?regNo=${encodeURIComponent(registrationNumber)}`);
    } catch (err) {
        console.error("Forgot password error:", err);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect(loginRedirectUrl);
    }
};

const renderResetPasswordForm = (req, res) => {
    const { regNo } = req.query;
    if (!regNo) {
        req.flash('error_msg', 'Invalid password reset link or session.');
        return res.redirect('/student/login');
    }
    res.render('pages/student/reset-password-form', { title: 'Reset Your Password', registrationNumber: regNo, passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8 });
};

const handleResetPassword = async (req, res) => {
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
        req.flash('success_msg', 'Password reset successfully. You can now login.');
        res.redirect('/student/login');
    } catch (err) { console.error("Error resetting password:", err); req.flash('error_msg', 'An error occurred. Please try again.'); res.redirect(errorRedirectUrl);}
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
        const notifications = await db.allAsync( `SELECT n.*, snr.read_at FROM notifications n LEFT JOIN student_notification_reads snr ON n.id = snr.notification_id AND snr.student_id = ? WHERE n.target_audience_type = 'all' OR (n.target_audience_type = 'student_id' AND n.target_audience_identifier = ?) ${coursePlaceholders} ORDER BY n.created_at DESC`, queryParams );
        res.render('pages/student/notifications', { title: 'My Notifications', student: req.student, notifications });
    } catch (err) { console.error("Error fetching student notifications:", err); req.flash('error_msg', 'Could not retrieve notifications.'); res.redirect('/student/dashboard'); }
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
        req.flash('error_msg', 'Could not mark notification as read.');
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
        res.render('pages/student/study-resources', { title: 'My Study Resources', student: req.student, groupedResources });
    } catch (err) { console.error("Error fetching student study resources:", err); req.flash('error_msg', 'Could not retrieve study resources.'); res.redirect('/student/dashboard'); }
};

const viewMyFees = async (req, res) => {
    const studentId = req.student.id;
    try {
        const fees = await db.allAsync(`SELECT description, total_amount, amount_paid, (total_amount - amount_paid) as balance, payment_date, payment_method, notes, created_at FROM fees WHERE student_id = ? ORDER BY payment_date DESC, created_at DESC`, [studentId]);
        let totalCharged = 0, totalPaid = 0;
        fees.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const overallBalance = totalCharged - totalPaid;
        res.render('pages/student/fees', { title: 'My Fee Statement', student: req.student, fees: fees || [], overallBalance });
    } catch (err) { console.error("Error fetching student fee records:", err); req.flash('error_msg', 'Could not retrieve fee statement.'); res.redirect('/student/dashboard'); }
};

const computerClassUnits = [
    { dbCol: 'unit_intro_to_computer_marks', name: 'Introduction to Computer' }, { dbCol: 'unit_keyboard_mouse_marks', name: 'Keyboard and Mouse Management' },
    { dbCol: 'unit_ms_word_marks', name: 'Ms Word' }, { dbCol: 'unit_ms_excel_marks', name: 'Ms Excel' },
    { dbCol: 'unit_ms_publisher_marks', name: 'Ms Publisher' }, { dbCol: 'unit_ms_powerpoint_marks', name: 'Ms PowerPoint' },
    { dbCol: 'unit_ms_access_marks', name: 'Ms Access' }, { dbCol: 'unit_internet_email_marks', name: 'Internet and Email' }
];
const examColumns = [ { dbCol: 'exam_theory_marks', name: 'Theory Exam' }, { dbCol: 'exam_practical_marks', name: 'Practical Exam' } ];

const viewMyAcademics = async (req, res) => {
    try {
        const studentId = req.student.id;
        const courseNameToView = "Computer Classes";
        const course = await db.getAsync("SELECT id FROM courses WHERE name = ?", [courseNameToView]);
        if (!course) { req.flash('error_msg', `Course "${courseNameToView}" not found.`); return res.redirect('/student/dashboard'); }
        const enrollment = await db.getAsync( `SELECT *, unit_intro_to_computer_marks, unit_keyboard_mouse_marks, unit_ms_word_marks, unit_ms_excel_marks, unit_ms_publisher_marks, unit_ms_powerpoint_marks, unit_ms_access_marks, unit_internet_email_marks, exam_theory_marks, exam_practical_marks FROM enrollments WHERE student_id = ? AND course_id = ?`, [studentId, course.id] );
        if (!enrollment) {
            req.flash('info_msg', `You are not currently enrolled in "${courseNameToView}".`);
            return res.render('pages/student/my-academics', { title: 'My Academics', student: req.student, courseName: courseNameToView, enrollmentData: null, units: [], exams: [], unitsRawTotal: null, finalGradePercent: null, courseStatus: 'Not Enrolled', messages: { error: req.flash('error_msg'), success: req.flash('success_msg'), info: req.flash('info_msg') }, PASSING_GRADE: parseInt(process.env.PASSING_GRADE) || 60 });
        }
        let unitsData = [], allUnitMarksProvided = true, unitsRawTotal = 0;
        computerClassUnits.forEach(unit => { const marks = enrollment[unit.dbCol]; unitsData.push({ name: unit.name, marks: marks, status: marks === null || marks === undefined ? 'Pending' : marks }); if (marks === null || marks === undefined) allUnitMarksProvided = false; else unitsRawTotal += marks; });
        let examsData = [], allExamMarksProvided = true;
        examColumns.forEach(exam => { const marks = enrollment[exam.dbCol]; examsData.push({ name: exam.name, marks: marks, status: marks === null || marks === undefined ? 'Pending' : marks }); if (marks === null || marks === undefined) allExamMarksProvided = false; });
        let unitsContribution = null, examsContribution = null, finalGradePercent = null, courseStatus = "Ongoing";
        if (allUnitMarksProvided) unitsContribution = (unitsRawTotal / (computerClassUnits.length * 100)) * 30;
        if (allExamMarksProvided) { const theoryMarks = enrollment.exam_theory_marks || 0; const practicalMarks = enrollment.exam_practical_marks || 0; examsContribution = ((theoryMarks + practicalMarks) / (examColumns.length * 100)) * 70; }
        if (allUnitMarksProvided && allExamMarksProvided) { finalGradePercent = (unitsContribution !== null ? unitsContribution : 0) + (examsContribution !== null ? examsContribution : 0) ; courseStatus = enrollment.final_grade ? `Completed (${enrollment.final_grade})` : (finalGradePercent < (parseInt(process.env.PASSING_GRADE) || 60) ? "Completed (Fail)" : "Completed (Pass)"); }
        else if (unitsData.some(u => u.marks !== null) || examsData.some(e => e.marks !== null)) courseStatus = "Ongoing (Marks Pending)";
        else courseStatus = "Ongoing (Awaiting Marks)";
        res.render('pages/student/my-academics', { title: 'My Academics', student: req.student, courseName: courseNameToView, enrollmentData: enrollment, units: unitsData, exams: examsData, unitsRawTotal: allUnitMarksProvided ? unitsRawTotal : null, unitsContribution, examsContribution, finalGradePercent, courseStatus, PASSING_GRADE: parseInt(process.env.PASSING_GRADE) || 60, messages: { error: req.flash('error_msg'), success: req.flash('success_msg'), info: req.flash('info_msg') } });
    } catch (err) { console.error("Error fetching student academic data:", err); req.flash('error_msg', 'Failed to load academic details.'); res.redirect('/student/dashboard'); }
};

const viewWifiCredentials = async (req, res) => {
    try {
        const settingKeys = ['wifi_ssid', 'wifi_password_plaintext', 'wifi_disclaimer'];
        const settingsData = await db.allAsync( `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?, ?)`, settingsKeys );
        const settings = {}; settingsData.forEach(row => { settings[row.setting_key] = row.setting_value; });
        res.render('pages/student/wifi-credentials', { title: 'WiFi Credentials', student: req.student, wifi_ssid: settings.wifi_ssid || 'Not Set by Admin', wifi_password: settings.wifi_password_plaintext || 'Not Set by Admin', wifi_disclaimer: settings.wifi_disclaimer || '' });
    } catch (err) { console.error("Error fetching WiFi credentials for student:", err); req.flash('error_msg', 'Could not retrieve WiFi information.'); res.redirect('/student/dashboard'); }
};

const renderMyCertificatesPage = async (req, res) => {
    const studentId = req.student.id;
    try {
        const feeRecords = await db.allAsync("SELECT total_amount, amount_paid FROM fees WHERE student_id = ?", [studentId]);
        let totalCharged = 0, totalPaid = 0; feeRecords.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const feesCleared = (totalCharged - totalPaid) <= 0;
        const passedEnrollments = await db.allAsync(`SELECT e.id as enrollment_id, c.name as course_name, e.final_grade, e.certificate_issued_at FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.student_id = ? AND e.final_grade = 'Pass' ORDER BY c.name`, [studentId]);
        const eligibleCertificates = passedEnrollments.map(pe => ({ ...pe, is_eligible_for_download: feesCleared }));
        res.render('pages/student/certificates', { title: 'My Certificates', student: req.student, eligibleCertificates, feesCleared });
    } catch (err) { console.error("Error fetching certificate eligibility:", err); req.flash('error_msg', 'Could not retrieve certificate information.'); res.redirect('/student/dashboard'); }
};

const downloadCertificate = async (req, res) => {
    const studentId = req.student.id; const enrollmentId = req.params.enrollmentId;
    try {
        const feeRecords = await db.allAsync("SELECT total_amount, amount_paid FROM fees WHERE student_id = ?", [studentId]);
        let totalCharged = 0, totalPaid = 0; feeRecords.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const feesCleared = (totalCharged - totalPaid) <= 0;
        const enrollment = await db.getAsync(`SELECT e.id, s.first_name as student_name, s.registration_number, c.name as course_name, e.final_grade, e.updated_at as completion_date FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE e.id = ? AND e.student_id = ? AND e.final_grade = 'Pass'`, [enrollmentId, studentId]);
        if (!enrollment) { req.flash('error_msg', 'Course completion record not found or not passed.'); return res.redirect('/student/my-certificates'); }
        if (!feesCleared) { req.flash('error_msg', 'Cannot download certificate due to outstanding fees.'); return res.redirect('/student/my-certificates'); }
        res.render('pages/student/certificate-template', { layout: 'partials/certificate-layout', title: `Certificate - ${enrollment.course_name}`, student_name: enrollment.student_name, course_name: enrollment.course_name, registration_number: enrollment.registration_number, completion_date: new Date(enrollment.completion_date).toLocaleDateString() });
    } catch (err) { console.error("Error generating certificate:", err); req.flash('error_msg', 'Could not generate certificate.'); res.redirect('/student/my-certificates'); }
};

const renderChangePasswordForm = (req, res) => {
    res.render('pages/student/profile/change-password', { title: 'Change Password', student: req.student, passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8 });
};

const handleChangePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body; const studentId = req.student.id;
    if (!currentPassword || !newPassword || !confirmNewPassword) { req.flash('error_msg', 'All password fields are required.'); return res.redirect('/student/profile/change-password'); }
    if (newPassword.length < (parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8)) { req.flash('error_msg', `New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters long.`); return res.redirect('/student/profile/change-password'); }
    if (newPassword !== confirmNewPassword) { req.flash('error_msg', 'New passwords do not match.'); return res.redirect('/student/profile/change-password'); }
    try {
        const student = await db.getAsync("SELECT password_hash FROM students WHERE id = ?", [studentId]);
        if (!student) { req.flash('error_msg', 'Student not found.'); return res.redirect('/student/dashboard'); }
        const isMatch = await bcrypt.compare(currentPassword, student.password_hash);
        if (!isMatch) { req.flash('error_msg', 'Incorrect current password.'); return res.redirect('/student/profile/change-password'); }
        const isDefaultPassword = await bcrypt.compare(process.env.DEFAULT_STUDENT_PASSWORD, student.password_hash);
        if (!isDefaultPassword && newPassword === currentPassword) { req.flash('error_msg', 'New password cannot be the same as your current password.'); return res.redirect('/student/profile/change-password');}
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync( "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newPasswordHash, studentId] );
        req.flash('success_msg', 'Your password has been changed successfully.'); res.redirect('/student/dashboard');
    } catch (err) { console.error("Error changing student password:", err); req.flash('error_msg', 'An error occurred while changing your password.'); res.redirect('/student/profile/change-password'); }
};

const renderEditNokForm = async (req, res) => {
    const studentId = req.student.id;
    try {
        const student = await db.getAsync("SELECT next_of_kin_details FROM students WHERE id = ?", [studentId]);
        let currentNokDetails = {}; if (student && student.next_of_kin_details) { try { currentNokDetails = JSON.parse(student.next_of_kin_details); } catch (e) { console.error("Error parsing NOK details for student " + studentId, e); }}
        res.render('pages/student/profile/edit-nok', { title: 'Update Next of Kin Details', student: req.student, currentNokDetails });
    } catch (err) { console.error("Error fetching student NOK details for edit form:", err); req.flash('error_msg', 'Could not load Next of Kin details.'); res.redirect('/student/dashboard'); }
};

const handleUpdateNok = async (req, res) => {
    const { nokName, nokRelationship, nokPhone, nokEmail } = req.body; const studentId = req.student.id;
    if (!nokName || !nokRelationship || !nokPhone) { req.flash('error_msg', 'Please fill in all required Next of Kin fields (Name, Relationship, Phone).'); return res.redirect('/student/profile/edit-nok'); }
    const nokDetails = JSON.stringify({ name: nokName, relationship: nokRelationship, phone: nokPhone, email: nokEmail || '' });
    try {
        await db.runAsync( "UPDATE students SET next_of_kin_details = ?, is_profile_complete = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nokDetails, studentId] );
        req.flash('success_msg', 'Next of Kin details updated successfully.'); res.redirect('/student/dashboard');
    } catch (err) { console.error("Error updating student NOK details:", err); req.flash('error_msg', 'An error occurred while updating Next of Kin details.'); res.redirect('/student/profile/edit-nok'); }
};

const retrieveStudentCredentials = async (req, res) => {
    const { email, anyName } = req.body;
    const activeTab = 'new-student-panel';
    const errorRedirectUrl = `/student/login?activeTab=${activeTab}#${activeTab}`;
    const successRedirectUrl = `/student/login?activeTab=${activeTab}#${activeTab}`;
    req.flash('formData', { email, anyName });
    if (!email || !anyName) { req.flash('error', 'Email and a Name (First, Second, or Surname) are required.'); return res.redirect(errorRedirectUrl); }
    if (!validator.isEmail(email)) { req.flash('error', 'Invalid email format.'); return res.redirect(errorRedirectUrl); }
    try {
        const student = await db.getAsync( `SELECT id, registration_number, first_name, surname, requires_password_change, IFNULL(credentials_retrieved_once, 0) as credentials_retrieved_once FROM students WHERE lower(email) = lower(?) AND (lower(first_name) = lower(?) OR lower(second_name) = lower(?) OR lower(surname) = lower(?))`, [email.trim(), anyName.trim().toLowerCase(), anyName.trim().toLowerCase(), anyName.trim().toLowerCase()] );
        if (!student) { req.flash('error', 'No matching student record found with the provided email and name, or criteria for retrieval not met.'); return res.redirect(errorRedirectUrl); }
        const requiresChange = student.requires_password_change === 1 || student.requires_password_change === true;
        const alreadyRetrieved = student.credentials_retrieved_once === 1 || student.credentials_retrieved_once === true;
        if (!requiresChange) { req.flash('error', 'Account setup has already been completed. Please use the regular login or "Reset Password" if you forgot your password.'); return res.redirect(errorRedirectUrl); }
        if (alreadyRetrieved) { req.flash('error', 'Initial credentials have already been retrieved for this account. Please use the regular login or "Reset Password".'); return res.redirect(errorRedirectUrl); }
        await db.runAsync("UPDATE students SET credentials_retrieved_once = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [student.id]);
        const successMessage = `Dear <strong>${student.first_name} ${student.surname}</strong>, your initial login details are: <br>Registration Number: <strong style="color:green;">${student.registration_number}</strong> <br>Default Password: <strong style="color:green;">${process.env.DEFAULT_STUDENT_PASSWORD}</strong> <br><strong class='text-danger'>Please login immediately using the 'Login' tab and change your password.</strong>`;
        req.flash('success_msg', successMessage); req.flash('formData', {});
        return res.redirect(successRedirectUrl);
    } catch (err) { console.error("Error retrieving student credentials:", err); req.flash('error', 'An error occurred while retrieving credentials.'); return res.redirect(errorRedirectUrl); }
};

// --- Implementation for Token-Based Password Reset ---
const renderResetPasswordWithTokenForm = async (req, res) => {
    const { urlToken } = req.params;
    try {
        const tokenRecord = await db.getAsync( "SELECT * FROM password_reset_tokens WHERE url_token = ? AND used = FALSE AND expires_at > datetime('now')", [urlToken] );
        if (!tokenRecord) { req.flash('error_msg', 'This password reset link is invalid or has expired.'); return res.redirect('/student/login?activeTab=forgot-password-panel#forgot-password-panel'); }
        res.render('pages/student/reset-password-token-form', { title: 'Set New Password', urlToken: urlToken, passwordMinLength: process.env.PASSWORD_MIN_LENGTH || 8 });
    } catch (err) { console.error("Error rendering reset password form (with token):", err); req.flash('error_msg', 'An error occurred.'); res.redirect('/student/login'); }
};

const handleResetPasswordWithToken = async (req, res) => {
    const { urlToken } = req.params;
    const submittedToken = req.body.urlToken || urlToken;
    const { newPassword, confirmNewPassword } = req.body;
    const errorRedirectUrl = `/student/reset-password-with-token/${submittedToken}`;
    if (!newPassword || !confirmNewPassword) { req.flash('error_msg', 'Both password fields are required.'); return res.redirect(errorRedirectUrl); }
    if (newPassword.length < (parseInt(process.env.PASSWORD_MIN_LENGTH) || 8)) { req.flash('error_msg', `New password must be at least ${process.env.PASSWORD_MIN_LENGTH || 8} characters long.`); return res.redirect(errorRedirectUrl); }
    if (newPassword !== confirmNewPassword) { req.flash('error_msg', 'New passwords do not match.'); return res.redirect(errorRedirectUrl); }
    try {
        const tokenRecord = await db.getAsync( "SELECT * FROM password_reset_tokens WHERE url_token = ? AND used = FALSE AND expires_at > datetime('now')", [submittedToken] );
        if (!tokenRecord) { req.flash('error_msg', 'Invalid or expired password reset session.'); return res.redirect('/student/login?activeTab=forgot-password-panel#forgot-password-panel'); }
        const studentForCheck = await db.getAsync("SELECT password_hash, requires_password_change FROM students WHERE id = ?", [tokenRecord.student_id]);
        if (studentForCheck && studentForCheck.requires_password_change) {
             const isStillOnDefault = await bcrypt.compare(process.env.DEFAULT_STUDENT_PASSWORD, studentForCheck.password_hash);
             if (isStillOnDefault && newPassword === process.env.DEFAULT_STUDENT_PASSWORD) { req.flash('error_msg', 'New password cannot be the same as the default password.'); return res.redirect(errorRedirectUrl); }
        }
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync( "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newPasswordHash, tokenRecord.student_id] );
        await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecord.id]);
        req.flash('success_msg', 'Your password has been successfully reset! Please login with your new password.'); res.redirect('/student/login');
    } catch (err) { console.error("Error handling reset password with token:", err); req.flash('error_msg', 'An error occurred. Please try again.'); res.redirect(errorRedirectUrl); }
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
    retrieveStudentCredentials,
    renderResetPasswordWithTokenForm,
    handleResetPasswordWithToken
};
