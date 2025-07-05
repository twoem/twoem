// src/controllers/studentPortalController.js
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // For generating tokens if needed
const { sendEmailWithTemplate } = require('../config/mailer');


/**
 * Renders the main student portal page.
 * Placeholder directs to login.
 */
exports.renderStudentPortal = (req, res) => {
    // If user is logged in, render dashboard, else redirect to login
    // This will be replaced by actual dashboard rendering later.
    // res.render('pages/student/dashboard', { title: 'Student Dashboard' });
    res.redirect('/portals/student/login');
};

/**
 * Renders the student password reset form (after clicking link from email).
 */
exports.renderStudentResetPasswordForm = async (req, res) => {
    const { token } = req.query;

    if (!token) {
        req.flash('error_msg', 'Invalid or missing password reset token.');
        return res.redirect('/portals/student/login?tab=forgot-password-panel');
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const tokenRecord = await db.getAsync(
            "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = FALSE AND expires_at > datetime('now')",
            [hashedToken]
        );

        if (!tokenRecord) {
            req.flash('error_msg', 'Password reset link is invalid or has expired. Please request a new one.');
            return res.redirect('/portals/student/login?tab=forgot-password-panel');
        }

        // Token is valid, render the form
        res.render('pages/student/reset-password-token-form', {
            title: 'Reset Your Password',
            messages: req.flash(),
            urlToken: token, // Pass the original unhashed token to the form action/hidden field
            tokenValid: true, // Explicitly state token is valid for the view
            PASSWORD_MIN_LENGTH: process.env.PASSWORD_MIN_LENGTH || 8,
            layout: 'layouts/portal-minimal' // Use minimal layout
        });

    } catch (error) {
        console.error('Render student reset password form error:', error);
        req.flash('error_msg', 'An error occurred. Please try again.');
        res.redirect('/portals/student/login?tab=forgot-password-panel');
    }
};

/**
 * Renders the student resources page.
 */
exports.renderResourcesPage = async (req, res) => {
    if (!req.session.studentId || req.session.userType !== 'student') {
        req.flash('error_msg', 'Please login to view resources.');
        return res.redirect('/portals/student/login');
    }

    try {
        const student = await db.getAsync("SELECT id, first_name FROM students WHERE id = ?", [req.session.studentId]);
         if (!student) { // Should not happen if session is valid, but good check
            req.flash('error_msg', 'Student account not found.');
            return res.redirect('/portals/student/login');
        }

        const studyResources = await db.allAsync("SELECT * FROM study_resources ORDER BY created_at DESC");

        const wifiSsidRow = await db.getAsync("SELECT setting_value FROM site_settings WHERE setting_key = 'wifi_ssid'");
        const wifiPasswordRow = await db.getAsync("SELECT setting_value FROM site_settings WHERE setting_key = 'wifi_password'");
        const wifiDisclaimerRow = await db.getAsync("SELECT setting_value FROM site_settings WHERE setting_key = 'wifi_disclaimer'");

        const wifiDetails = {
            ssid: wifiSsidRow ? wifiSsidRow.setting_value : 'Not Set',
            password: wifiPasswordRow ? wifiPasswordRow.setting_value : 'Not Set',
            disclaimer: wifiDisclaimerRow ? wifiDisclaimerRow.setting_value : 'Use responsibly.'
        };

        res.render('pages/student/study-resources', { // Assuming student/study-resources.ejs is the target
            title: 'Study Resources',
            student: student, // For layout greeting
            studyResources: studyResources,
            wifiDetails: wifiDetails,
            layout: 'layouts/portal-student'
        });

    } catch (error) {
        console.error('Error rendering student resources page:', error);
        req.flash('error_msg', 'An error occurred while loading resources.');
        res.redirect('/portals/student/dashboard');
    }
};

/**
 * Renders the student's financial/fees page.
 */
exports.renderFinancialPage = async (req, res) => {
    if (!req.session.studentId || req.session.userType !== 'student') {
        req.flash('error_msg', 'Please login to view your financial details.');
        return res.redirect('/portals/student/login');
    }

    try {
        const studentId = req.session.studentId;
        const student = await db.getAsync("SELECT id, first_name, registration_number FROM students WHERE id = ?", [studentId]);
        if (!student) {
            req.flash('error_msg', 'Student account not found.');
            return res.redirect('/portals/student/login');
        }

        const feeLogs = await db.allAsync(
            "SELECT *, CAST(total_amount AS REAL) as total_amount_val, CAST(amount_paid AS REAL) as amount_paid_val FROM fees WHERE student_id = ? ORDER BY created_at DESC",
            [studentId]
        );

        let totalFeesDue = 0;
        let totalAmountPaid = 0;

        feeLogs.forEach(log => {
            // total_amount_val is the full amount for that specific fee item (e.g. course fee)
            // amount_paid_val is how much was paid towards that specific fee item or generally.
            // The schema seems to imply 'total_amount' is the full charge for an item, and 'amount_paid' is what's been paid for it.
            // For overall balance: sum all total_amounts (charges) and sum all amount_paids (payments).
            totalFeesDue += log.total_amount_val || 0; // This might double count if not structured carefully.
                                                  // Assuming each 'fees' entry is a distinct charge OR a payment.
                                                  // Let's refine: assume 'total_amount' is a charge, 'amount_paid' is a payment.
                                                  // This interpretation might be wrong if a single row is meant to be a bill with partial payment.
                                                  // The current schema seems like each row is a transaction (either a charge or a payment record).
                                                  // For simplicity, I will assume total_amount is the charge for that log entry, and amount_paid is payment FOR THAT LOG.
                                                  // A more robust system would have separate tables for charges and payments.
                                                  // Given the existing structure, let's sum distinct charges and all payments.
        });

        // Recalculate based on student dashboard logic for feesBalance for consistency
        const feeAggregates = await db.getAsync(
            "SELECT SUM(total_amount) as totalFeesSum, SUM(amount_paid) as totalPaidSum FROM fees WHERE student_id = ?",
            [studentId]
        );
        totalFeesDue = feeAggregates?.totalFeesSum || 0;
        totalAmountPaid = feeAggregates?.totalPaidSum || 0;
        const feesBalance = totalFeesDue - totalAmountPaid;


        res.render('pages/student/fees', { // Assuming student/fees.ejs is the target
            title: 'My Financials',
            student: student,
            feeLogs: feeLogs,
            totalFeesDue: totalFeesDue.toFixed(2),
            totalAmountPaid: totalAmountPaid.toFixed(2),
            feesBalance: feesBalance.toFixed(2),
            layout: 'layouts/portal-student'
        });

    } catch (error) {
        console.error('Error rendering student financial page:', error);
        req.flash('error_msg', 'An error occurred while loading your financial details.');
        res.redirect('/portals/student/dashboard');
    }
};

/**
 * Renders the student dashboard.
 */
exports.renderStudentDashboard = async (req, res) => {
    if (!req.session.studentId || req.session.userType !== 'student') {
        req.flash('error_msg', 'Please login to view the dashboard.');
        return res.redirect('/portals/student/login');
    }

    try {
        const student = await db.getAsync("SELECT * FROM students WHERE id = ?", [req.session.studentId]);

        if (!student) {
            req.flash('error_msg', 'Could not find your account. Please login again.');
            delete req.session.studentId;
            delete req.session.userType;
            return res.redirect('/portals/student/login');
        }

        // Calculate Fees Balance
        const feeAggregates = await db.getAsync(
            "SELECT SUM(total_amount) as totalFees, SUM(amount_paid) as totalPaid FROM fees WHERE student_id = ?",
            [student.id]
        );
        const feesBalance = (feeAggregates?.totalFees || 0) - (feeAggregates?.totalPaid || 0);

        // Calculate Time Studied (Duration since enrollment)
        let timeStudied = 'N/A';
        if (student.enrolled_date) {
            const enrolledDate = new Date(student.enrolled_date);
            const now = new Date();
            let years = now.getFullYear() - enrolledDate.getFullYear();
            let months = now.getMonth() - enrolledDate.getMonth();
            let days = now.getDate() - enrolledDate.getDate();

            if (days < 0) {
                months--;
                days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); // Days in previous month
            }
            if (months < 0) {
                years--;
                months += 12;
            }
            timeStudied = `${years > 0 ? years + (years > 1 ? ' years, ' : ' year, ') : ''}${months > 0 ? months + (months > 1 ? ' months, ' : ' month, ') : ''}${days + (days > 1 ? ' days' : ' day')}`;
            if (years === 0 && months === 0 && days === 0) timeStudied = "Enrolled today";
             else if (years === 0 && months === 0) timeStudied = `${days} ${days > 1 ? 'days' : 'day'}`;
             else if (years === 0) timeStudied = `${months} ${months > 1 ? 'months' : 'month'}, ${days} ${days > 1 ? 'days' : 'day'}`;

        }

        // Placeholder for notifications
        const notifications = [
            // { title: "Exam Schedule Update", message: "The final exam for MS Word is now on Dec 15th.", date: new Date() }
        ];

        // Check if Next of Kin details need update (simple check: is it empty or null?)
        // A more robust check might involve a dedicated flag like `is_nok_updated`
        const nokNeedsUpdate = !student.next_of_kin_details;


        res.render('pages/student-dashboard', {
            title: 'Student Dashboard',
            student: student,
            feesBalance: feesBalance,
            timeStudied: timeStudied,
            notifications: notifications,
            nokNeedsUpdate: nokNeedsUpdate,
            currentDate: new Date(), // For display
            layout: 'layouts/portal-student'
        });

    } catch (error) {
        console.error('Error rendering student dashboard:', error);
        req.flash('error_msg', 'An error occurred while loading your dashboard.');
        res.redirect('/portals/student/login');
    }
};

/**
 * Handles the student password reset submission (from link/token).
 */
exports.handleStudentResetPassword = async (req, res) => {
    const { token, newPassword, confirmNewPassword } = req.body; // Token from hidden field

    if (!token || !newPassword || !confirmNewPassword) {
        req.flash('error_msg', 'All fields are required.');
        return res.redirect(`/portals/student/reset-password?token=${token || ''}`);
    }
    if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New passwords do not match.');
        return res.redirect(`/portals/student/reset-password?token=${token}`);
    }
    const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;
    if (newPassword.length < minLength) {
        req.flash('error_msg', `Password must be at least ${minLength} characters long.`);
        return res.redirect(`/portals/student/reset-password?token=${token}`);
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const tokenRecord = await db.getAsync(
            "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used = FALSE AND expires_at > datetime('now')",
            [hashedToken]
        );

        if (!tokenRecord) {
            req.flash('error_msg', 'Password reset link is invalid or has expired. Please request a new one.');
            return res.redirect('/portals/student/login?tab=forgot-password-panel');
        }

        const student = await db.getAsync("SELECT * FROM students WHERE id = ?", [tokenRecord.student_id]);
        if (!student) {
            req.flash('error_msg', 'Associated student account not found.');
            return res.redirect('/portals/student/login?tab=forgot-password-panel');
        }

        // Check if new password is the same as default (if applicable for some edge cases, though less likely here)
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || 'Stud@Twoem2025';
        if (newPassword === defaultPassword && student.requires_password_change) { // Check requires_password_change as well
             req.flash('error_msg', 'New password cannot be the same as the default password.');
             return res.redirect(`/portals/student/reset-password?token=${token}`);
        }


        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync(
            "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = datetime('now') WHERE id = ?",
            [newPasswordHash, student.id]
        );
        await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenRecord.id]);

        // Log the student in
        req.session.studentId = student.id;
        req.session.userType = 'student';
        await db.runAsync("UPDATE students SET last_login_at = datetime('now') WHERE id = ?", [student.id]);


        req.flash('success_msg', 'Your password has been reset successfully. You are now logged in.');
        res.redirect('/portals/student/dashboard');

    } catch (error) {
        console.error('Handle student reset password error:', error);
        req.flash('error_msg', 'An error occurred while resetting your password.');
        res.redirect(`/portals/student/reset-password?token=${token || ''}`);
    }
};


/**
 * Renders the student login page.
 */
exports.renderLogin = (req, res) => {
    // The existing EJS file ('student-login.ejs') is a full HTML document.
    res.render('pages/student-login', { // Corrected file name
        title: 'Student Portal | Login',
        messages: req.flash(), // Pass flash messages
        activeTab: req.query.tab || 'login-panel', // For tab functionality
        formData: {} // For repopulating form on error if needed
    });
};

/**
 * Handles student login submission.
 */
exports.handleLogin = async (req, res) => {
    const { registrationNumber, password } = req.body;

    if (!registrationNumber || !password) {
        req.flash('error_msg', 'Please enter both registration number and password.');
        return res.redirect('/portals/student/login?tab=login-panel');
    }

    try {
        const student = await db.getAsync("SELECT * FROM students WHERE registration_number = ?", [registrationNumber]);

        if (!student) {
            req.flash('error_msg', 'Invalid registration number or password.');
            return res.redirect('/portals/student/login?tab=login-panel');
        }

        if (!student.is_active) {
            req.flash('error_msg', 'Your account is inactive. Please contact administration.');
            return res.redirect('/portals/student/login?tab=login-panel');
        }

        const isMatch = await bcrypt.compare(password, student.password_hash);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid registration number or password.');
            return res.redirect('/portals/student/login?tab=login-panel');
        }

        // Update last login time
        await db.runAsync("UPDATE students SET last_login_at = datetime('now') WHERE id = ?", [student.id]);

        if (student.requires_password_change) {
            req.session.tempStudentId = student.id; // Temporary session for password change
            req.flash('info_msg', 'Welcome! Please change your default password to continue.');
            return res.redirect('/portals/student/change-password');
        }

        // --- Successful Login ---
        req.session.studentId = student.id;
        req.session.userType = 'student';

        req.flash('success_msg', 'You are now logged in.');
        res.redirect('/portals/student/dashboard'); // To be created

    } catch (error) {
        console.error('Student login error:', error);
        req.flash('error_msg', 'An error occurred during login. Please try again.');
        res.redirect('/portals/student/login?tab=login-panel');
    }
};

/**
 * Handles student forgot password submission.
 * Handles student forgot password submission.
 */
exports.handleForgotPassword = async (req, res) => {
    const { email, anyName } = req.body;
    const activeTab = 'forgot-password-panel';

    if (!email || !anyName) {
        req.flash('error_msg', 'Please provide both your email and a name.');
        return res.redirect(`/portals/student/login?tab=${activeTab}`);
    }

    try {
        const student = await db.getAsync("SELECT * FROM students WHERE email = ?", [email.toLowerCase()]);

        if (!student) {
            req.flash('error_msg', 'No account found with that email address.');
            return res.redirect(`/portals/student/login?tab=${activeTab}`);
        }
        if (!student.is_active) {
            req.flash('error_msg', 'This account is inactive. Please contact administration.');
            return res.redirect(`/portals/student/login?tab=${activeTab}`);
        }

        const nameLower = anyName.toLowerCase();
        const isNameMatch = (student.first_name && student.first_name.toLowerCase() === nameLower) ||
                            (student.second_name && student.second_name.toLowerCase() === nameLower) ||
                            (student.surname && student.surname.toLowerCase() === nameLower);

        if (!isNameMatch) {
            req.flash('error_msg', 'The provided name does not match our records for this email.');
            return res.redirect(`/portals/student/login?tab=${activeTab}`);
        }

        // Generate OTP (6-digit number)
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = await bcrypt.hash(otp, 10); // Hash the OTP before storing
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Generate a more secure token for the link
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex'); // Hash the link token
        const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for link

        // Store both OTP hash and link token hash
        // For simplicity, we can use the same table if structure allows, or just use one method.
        // The spec mentions "OTP and reset password OTP" and "link". Let's use the link token for the URL
        // and the numeric OTP for direct input on the reset page.

        // Invalidate previous tokens for this student
        await db.runAsync("UPDATE password_reset_tokens SET used = TRUE WHERE student_id = ? AND used = FALSE", [student.id]);

        // Store the new link token (hashed)
        await db.runAsync(
            "INSERT INTO password_reset_tokens (student_id, token_hash, expires_at) VALUES (?, ?, ?)",
            [student.id, tokenHash, tokenExpiresAt.toISOString()]
        );
        // The numeric OTP (otp) will be emailed. The user can either click the link (with resetToken) or enter the OTP.
        // The reset page will need to handle both.

        const emailData = {
            studentName: student.first_name,
            otp: otp, // Send the plain OTP
            resetLink: `${process.env.FRONTEND_URL}/portals/student/reset-password?token=${resetToken}`, // Link with unhashed token
            otpExpiryMinutes: 10,
            siteUrl: process.env.FRONTEND_URL || '',
            logoUrl: process.env.EMAIL_LOGO_URL
        };

        await sendEmailWithTemplate({
            to: student.email,
            subject: 'Your Student Portal Password Reset Instructions',
            templateName: 'studentPasswordResetInstructions', // New EJS template needed
            data: emailData
        });

        req.flash('success_msg', 'Password reset instructions and an OTP have been sent to your email address.');
        res.redirect(`/portals/student/login?tab=${activeTab}`);

    } catch (error) {
        console.error('Student forgot password error:', error);
        req.flash('error_msg', 'An error occurred. Please try again.');
        res.redirect(`/portals/student/login?tab=${activeTab}`);
    }
};

/**
 * Handles student retrieve credentials submission.
 */
exports.handleRetrieveCredentials = async (req, res) => {
    const { email, anyName } = req.body;
    const activeTab = 'new-student-panel';

    if (!email || !anyName) {
        req.flash('error_msg', 'Please provide both your email and a name.');
        return res.redirect(`/portals/student/login?tab=${activeTab}`);
    }

    try {
        const student = await db.getAsync("SELECT * FROM students WHERE email = ?", [email.toLowerCase()]);

        if (!student) {
            req.flash('error_msg', 'No student account found with that email address.');
            return res.render('pages/student-login', {
                title: 'Student Portal | Login',
                messages: req.flash(),
                activeTab: activeTab,
                formData: req.body, // Repopulate form
                layout: false // Assuming student-login is full page
            });
        }

        const nameLower = anyName.toLowerCase();
        const isNameMatch = (student.first_name && student.first_name.toLowerCase() === nameLower) ||
                            (student.second_name && student.second_name.toLowerCase() === nameLower) ||
                            (student.surname && student.surname.toLowerCase() === nameLower);

        if (!isNameMatch) {
            req.flash('error_msg', 'The provided name does not match our records for this email.');
            return res.render('pages/student-login', { title: 'Student Portal | Login', messages: req.flash(), activeTab: activeTab, formData: req.body, layout: false });
        }

        if (!student.is_active) {
            req.flash('error_msg', 'This account is inactive. Please contact administration.');
            return res.render('pages/student-login', { title: 'Student Portal | Login', messages: req.flash(), activeTab: activeTab, formData: req.body, layout: false });
        }

        if (student.credentials_retrieved_once) {
            req.flash('info_msg', 'Your login details have already been retrieved. If you forgot your password, please use the "Reset Password" option.');
            return res.render('pages/student-login', { title: 'Student Portal | Login', messages: req.flash(), activeTab: activeTab, formData: req.body, layout: false });
        }

        // Credentials can be retrieved
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || 'Stud@Twoem2025';
        const retrievedStudentDetails = {
            registrationNumber: student.registration_number,
            email: student.email,
            fullName: `${student.first_name} ${student.second_name ? student.second_name + ' ' : ''}${student.surname}`,
            phoneNumber: student.phone_number,
            defaultPassword: defaultPassword // Show the default password
        };

        // Mark as retrieved
        await db.runAsync("UPDATE students SET credentials_retrieved_once = TRUE, updated_at = datetime('now') WHERE id = ?", [student.id]);

        req.flash('success_msg', 'Your login details have been successfully retrieved. Please note them down securely and change your password upon first login.');
        res.render('pages/student-login', {
            title: 'Student Portal | Login',
            messages: req.flash(),
            activeTab: activeTab,
            retrievedStudentDetails: retrievedStudentDetails, // Pass details to the view
            formData: {}, // Clear form data on success
            layout: false // Assuming student-login is full page
        });

    } catch (error) {
        console.error('Retrieve student credentials error:', error);
        req.flash('error_msg', 'An error occurred while retrieving credentials. Please try again.');
        res.redirect(`/portals/student/login?tab=${activeTab}`);
    }
};


/**
 * Renders the student's initial change password form.
 */
exports.renderStudentChangePasswordForm = async (req, res) => {
    if (!req.session.tempStudentId) {
        req.flash('error_msg', 'Invalid session for password change. Please login again.');
        return res.redirect('/portals/student/login');
    }
    // Optionally, fetch student details if needed in the form, though not strictly necessary for just changing password
    // const student = await db.getAsync("SELECT registration_number FROM students WHERE id = ?", [req.session.tempStudentId]);

    res.render('pages/student/change-password-initial', { // Assuming this EJS file exists
        title: 'Change Your Password',
        messages: req.flash(),
        PASSWORD_MIN_LENGTH: process.env.PASSWORD_MIN_LENGTH || 8, // From .env
        // student: student // if fetched and needed
        layout: 'layouts/portal-minimal' // Assuming a minimal layout for this specific flow
    });
};

/**
 * Handles the student's initial password change.
 */
exports.handleStudentChangePassword = async (req, res) => {
    if (!req.session.tempStudentId) {
        req.flash('error_msg', 'Session expired. Please login again to change your password.');
        return res.redirect('/portals/student/login');
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const studentId = req.session.tempStudentId;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
        req.flash('error_msg', 'Please fill in all password fields.');
        return res.redirect('/portals/student/change-password');
    }

    if (newPassword !== confirmNewPassword) {
        req.flash('error_msg', 'New passwords do not match.');
        return res.redirect('/portals/student/change-password');
    }

    const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;
    if (newPassword.length < minLength) {
        req.flash('error_msg', `Password must be at least ${minLength} characters long.`);
        return res.redirect('/portals/student/change-password');
    }

    const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || 'Stud@Twoem2025';
    if (currentPassword !== defaultPassword) {
        req.flash('error_msg', 'Incorrect current password. Please enter the default password provided.');
        return res.redirect('/portals/student/change-password');
    }

    if (newPassword === defaultPassword) {
        req.flash('error_msg', 'New password cannot be the same as the default password.');
        return res.redirect('/portals/student/change-password');
    }

    try {
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.runAsync(
            "UPDATE students SET password_hash = ?, requires_password_change = FALSE, updated_at = datetime('now') WHERE id = ?",
            [newPasswordHash, studentId]
        );

        delete req.session.tempStudentId; // Clear temporary session ID

        // Establish permanent session
        req.session.studentId = studentId;
        req.session.userType = 'student';

        // Update last login time as this completes the login process
        await db.runAsync("UPDATE students SET last_login_at = datetime('now') WHERE id = ?", [studentId]);

        req.flash('success_msg', 'Password changed successfully. You are now logged in.');
        res.redirect('/portals/student/dashboard'); // To be created

    } catch (error) {
        console.error('Student change password error:', error);
        req.flash('error_msg', 'An error occurred while changing your password.');
        res.redirect('/portals/student/change-password');
    }
};

/**
 * Renders the student's academic progress page.
 */
exports.renderAcademicsPage = async (req, res) => {
    if (!req.session.studentId || req.session.userType !== 'student') {
        req.flash('error_msg', 'Please login to view your academics.');
        return res.redirect('/portals/student/login');
    }

    try {
        const studentId = req.session.studentId;
        const student = await db.getAsync("SELECT * FROM students WHERE id = ?", [studentId]);
        if (!student) {
            req.flash('error_msg', 'Student account not found.');
            return res.redirect('/portals/student/login');
        }

        // Assuming student is enrolled in one primary course (e.g., Computer Packages) for these topics
        // Fetch the student's current/latest enrollment.
        const enrollment = await db.getAsync(
            "SELECT * FROM enrollments WHERE student_id = ? ORDER BY enrollment_date DESC LIMIT 1",
            [studentId]
        );

        if (!enrollment) {
            // Render page with message that they are not enrolled or no academic data yet
            return res.render('pages/student/academics', {
                title: 'Academics',
                student: student,
                topics: [],
                mainExamTheory: null,
                mainExamPractical: null,
                overallGrade: null,
                overallPercentage: 0,
                examScheduleDate: null,
                enrollmentStatus: 'not_enrolled',
                academicMessage: "You are not currently enrolled in a course, or academic records are not yet available.",
                layout: 'layouts/portal-student'
            });
        }

        const topicMarks = await db.allAsync(
            "SELECT * FROM student_topic_marks WHERE student_id = ? AND enrollment_id = ?",
            [studentId, enrollment.id]
        );

        const topicsList = [
            "Introduction to Computers", "Keyboard Management", "Ms Word", "Ms Excel",
            "Ms Publisher", "Ms Powerpoint", "Ms Access", "Internet and Email"
        ];

        let academicsData = {
            topics: [],
            mainExamTheory: null,
            mainExamPractical: null,
            totalTopicMarksObtained: 0,
            totalTopicMaxMarks: 0,
        };

        topicsList.forEach(topicName => {
            const record = topicMarks.find(t => t.topic_name === topicName);
            academicsData.topics.push({
                name: topicName,
                marksObtained: record ? record.marks_obtained : null, // null if not tested
                maxMarks: record ? record.max_marks : 100, // Default to 100 if not set
                isExempt: record ? record.is_exempt : false,
            });
            if (record && record.marks_obtained !== null && !record.is_exempt) {
                academicsData.totalTopicMarksObtained += record.marks_obtained;
                academicsData.totalTopicMaxMarks += record.max_marks;
            } else if (!record || record.marks_obtained === null && !record.is_exempt) {
                 // If a topic is not tested and not exempt, it counts towards max marks for percentage calc
                 // but 0 for obtained. Or handle as "incomplete"
            }
        });

        const theoryRecord = topicMarks.find(t => t.topic_name === 'MainExamTheory');
        if (theoryRecord) {
            academicsData.mainExamTheory = {
                marksObtained: theoryRecord.marks_obtained,
                maxMarks: theoryRecord.max_marks || 100,
                isExempt: theoryRecord.is_exempt
            };
        }
        const practicalRecord = topicMarks.find(t => t.topic_name === 'MainExamPractical');
        if (practicalRecord) {
            academicsData.mainExamPractical = {
                marksObtained: practicalRecord.marks_obtained,
                maxMarks: practicalRecord.max_marks || 100,
                isExempt: practicalRecord.is_exempt
            };
        }

        // Calculate percentages (as per spec: topics 30%, theory 35%, practical 35%)
        let topicPercentageContribution = 0;
        if (academicsData.totalTopicMaxMarks > 0) { // Avoid division by zero
            const rawTopicPercentage = (academicsData.totalTopicMarksObtained / (topicsList.length * 100)) * 100; // Assuming each of 8 topics is 100
            topicPercentageContribution = (rawTopicPercentage / 100) * 30;
        }

        let theoryPercentageContribution = 0;
        if (academicsData.mainExamTheory && academicsData.mainExamTheory.marksObtained !== null) {
            theoryPercentageContribution = (academicsData.mainExamTheory.marksObtained / (academicsData.mainExamTheory.maxMarks || 100)) * 35;
        }

        let practicalPercentageContribution = 0;
        if (academicsData.mainExamPractical && academicsData.mainExamPractical.marksObtained !== null) {
            practicalPercentageContribution = (academicsData.mainExamPractical.marksObtained / (academicsData.mainExamPractical.maxMarks || 100)) * 35;
        }

        const overallPercentage = topicPercentageContribution + theoryPercentageContribution + practicalPercentageContribution;

        // Determine overall grade (simple example, can be more complex)
        let overallGrade = 'Pending';
        if (overallPercentage >= 70) overallGrade = 'Distinction';
        else if (overallPercentage >= 60) overallGrade = 'Credit';
        else if (overallPercentage >= 50) overallGrade = 'Pass';
        else if (enrollment.enrollment_status === 'completed' || (academicsData.mainExamTheory && academicsData.mainExamPractical)) { // If completed or exams taken
             overallGrade = 'Fail';
        }


        // Check for "Failed, incomplete"
        let academicMessage = "Keep up the great work! Your progress is looking good.";
        let allPartsFilled = true;
        academicsData.topics.forEach(t => { if (t.marksObtained === null && !t.isExempt) allPartsFilled = false; });
        if ((academicsData.mainExamTheory === null || academicsData.mainExamTheory.marksObtained === null) && (!academicsData.mainExamTheory || !academicsData.mainExamTheory.isExempt)) allPartsFilled = false;
        if ((academicsData.mainExamPractical === null || academicsData.mainExamPractical.marksObtained === null) && (!academicsData.mainExamPractical || !academicsData.mainExamPractical.isExempt)) allPartsFilled = false;

        if (enrollment.enrollment_status === 'completed' && !allPartsFilled) {
            overallGrade = 'Incomplete'; // Override grade
            academicMessage = "Your studies are marked as completed, but some grades are missing. This is currently marked as Incomplete. Please contact administration.";
        } else if (enrollment.enrollment_status === 'failed' && !allPartsFilled) {
            academicMessage = "Some marks are not recorded, and the course is marked as failed. Please contact administration for clarification.";
        } else if (!allPartsFilled && enrollment.enrollment_status !== 'ongoing') {
             academicMessage = "Some marks are not yet recorded. Final grade calculation might be affected.";
        }

        const motivationalMessages = [
            "Believe you can and you're halfway there!",
            "The secret of getting ahead is getting started.",
            "Don't watch the clock; do what it does. Keep going.",
            "The expert in anything was once a beginner.",
            "Success is not final, failure is not fatal: It is the courage to continue that counts."
        ];
        const motivationalMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

        // Structure for my-academics.ejs
        const units = academicsData.topics.map(t => ({
            name: t.name,
            marks: t.marksObtained,
            maxMarks: t.maxMarks,
            status: t.isExempt ? "Exempt" : (t.marksObtained === null ? "Not Tested" : `${t.marksObtained}/${t.maxMarks}`)
        }));

        const exams = [];
        if (academicsData.mainExamTheory) {
            exams.push({
                name: "Main Exam (Theory)",
                marks: academicsData.mainExamTheory.marksObtained,
                maxMarks: academicsData.mainExamTheory.maxMarks,
                status: academicsData.mainExamTheory.isExempt ? "Exempt" : (academicsData.mainExamTheory.marksObtained === null ? "Not Tested" : `${academicsData.mainExamTheory.marksObtained}/${academicsData.mainExamTheory.maxMarks}`)
            });
        } else {
             exams.push({ name: "Main Exam (Theory)", status: "Not Tested" });
        }
        if (academicsData.mainExamPractical) {
            exams.push({
                name: "Main Exam (Practical)",
                marks: academicsData.mainExamPractical.marksObtained,
                maxMarks: academicsData.mainExamPractical.maxMarks,
                status: academicsData.mainExamPractical.isExempt ? "Exempt" : (academicsData.mainExamPractical.marksObtained === null ? "Not Tested" : `${academicsData.mainExamPractical.marksObtained}/${academicsData.mainExamPractical.maxMarks}`)
            });
        } else {
            exams.push({ name: "Main Exam (Practical)", status: "Not Tested" });
        }

        // Passing raw contributions for the view to display, and the final percentage
        const unitsRawTotal = academicsData.totalTopicMarksObtained;


        res.render('pages/student/my-academics', {
            title: 'My Academics',
            student: student,
            courseName: "Computer Packages", // Assuming this for now
            units: units,
            exams: exams,
            unitsRawTotal: unitsRawTotal, // Raw total for display if needed
            unitsContribution: topicPercentageContribution,
            theoryContribution: theoryPercentageContribution,
            practicalContribution: practicalPercentageContribution,
            finalGradePercent: overallPercentage,
            overallGrade: overallGrade, // Pass the calculated grade string
            PASSING_GRADE: parseInt(process.env.PASSING_GRADE) || 60,
            examScheduleDate: enrollment.main_exam_schedule_date,
            courseStatus: enrollment.enrollment_status, // Use enrollment_status for course status
            academicMessage: academicMessage,
            motivationalMessage: motivationalMessage,
            layout: 'layouts/portal-student'
        });

    } catch (error) {
        console.error('Error rendering student academics page:', error);
        req.flash('error_msg', 'An error occurred while loading your academic details.');
        res.redirect('/portals/student/dashboard');
    }
};
