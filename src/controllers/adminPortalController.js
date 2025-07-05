// src/controllers/adminPortalController.js
const bcrypt = require('bcryptjs');
const db = require('../config/database'); // SQLite
const Customer = require('../models/customerModel'); // Mongoose

// Load admin users from .env
const admins = [];
for (let i = 1; i <= 3; i++) {
    if (process.env[`ADMIN${i}_EMAIL`] && process.env[`ADMIN${i}_PASSWORD_HASH`]) {
        admins.push({
            id: `admin${i}`,
            email: process.env[`ADMIN${i}_EMAIL`],
            name: process.env[`ADMIN${i}_NAME`] || `Admin ${i}`,
            passwordHash: process.env[`ADMIN${i}_PASSWORD_HASH`]
        });
    }
}
if (admins.length === 0) {
    console.warn("WARN: No admin accounts configured in .env file. Admin login will not work.");
}


/**
 * Renders the main admin portal page.
 * Placeholder directs to login.
 */
exports.renderAdminPortal = (req, res) => {
    // If user is logged in, render dashboard, else redirect to login
    // This will be replaced by actual dashboard rendering later.
    // res.render('pages/admin/dashboard', { title: 'Admin Dashboard' });
    res.redirect('/portals/admin/login');
};

/**
 * Renders the admin login page.
 */
exports.renderLogin = (req, res) => {
    // The existing EJS file ('admin-login.ejs') is a full HTML document.
    res.render('pages/admin-login', { // Corrected file name
        title: 'Admin Portal | Login',
        messages: req.flash(), // Pass flash messages
        email: '' // For repopulating email on error if needed
    });
};

/**
 * Handles admin login submission.
 */
exports.handleLogin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error_msg', 'Please enter both email and password.');
        return res.redirect('/portals/admin/login');
    }

    if (admins.length === 0) {
        req.flash('error_msg', 'Admin accounts are not configured. Please contact support.');
        return res.redirect('/portals/admin/login');
    }

    const adminUser = admins.find(admin => admin.email.toLowerCase() === email.toLowerCase());

    if (!adminUser) {
        req.flash('error_msg', 'Invalid email or password.');
        return res.redirect('/portals/admin/login');
    }

    try {
        const isMatch = await bcrypt.compare(password, adminUser.passwordHash);
        if (!isMatch) {
            req.flash('error_msg', 'Invalid email or password.');
            return res.redirect('/portals/admin/login');
        }

        // --- Successful Login ---
        req.session.adminId = adminUser.id; // Use the constructed ID like 'admin1'
        req.session.adminEmail = adminUser.email;
        req.session.adminName = adminUser.name;
        req.session.userType = 'admin';

        // Optionally, add last login update if storing admin activity in a DB later
        // For now, admin activity isn't stored persistently beyond session.

        req.flash('success_msg', 'You are now logged in as admin.');
        res.redirect('/portals/admin/dashboard');

    } catch (error) {
        console.error('Admin login error:', error);
        req.flash('error_msg', 'An error occurred during login. Please try again.');
        res.redirect('/portals/admin/login');
    }
};

/**
 * Renders the admin dashboard.
 */
exports.renderAdminDashboard = async (req, res) => {
    if (!req.session.adminId || req.session.userType !== 'admin') {
        req.flash('error_msg', 'Please login to view the admin dashboard.');
        return res.redirect('/portals/admin/login');
    }

    try {
        // Student Stats (SQLite)
        const totalStudentsResult = await db.getAsync("SELECT COUNT(*) as count FROM students");
        const totalStudents = totalStudentsResult ? totalStudentsResult.count : 0;

        const activeStudentsResult = await db.getAsync("SELECT COUNT(*) as count FROM students WHERE is_active = TRUE");
        const activeStudents = activeStudentsResult ? activeStudentsResult.count : 0;

        // Customer Stats (MongoDB)
        const totalCustomers = await Customer.countDocuments();
        const disconnectedCustomers = await Customer.countDocuments({ isActive: false });

        // Last Fee Update
        let lastFeeUpdateInfo = "N/A";
        const lastFeeLog = await db.getAsync("SELECT logged_by_admin_id, MAX(updated_at) as last_update_date FROM fees WHERE logged_by_admin_id IS NOT NULL GROUP BY logged_by_admin_id ORDER BY last_update_date DESC LIMIT 1");
        if (lastFeeLog && lastFeeLog.logged_by_admin_id) {
            const admin = admins.find(a => a.id === lastFeeLog.logged_by_admin_id || a.email === lastFeeLog.logged_by_admin_id);
            const adminName = admin ? admin.name : lastFeeLog.logged_by_admin_id;
            lastFeeUpdateInfo = `By: ${adminName} on ${new Date(lastFeeLog.last_update_date).toLocaleDateString()}`;
        }

        // Last Customer Payment Update (Approval)
        let lastCustomerPaymentInfo = "N/A";
        const lastApprovedPayment = await Customer.aggregate([
            { $unwind: '$paymentLogs' },
            { $match: { 'paymentLogs.approvalDate': { $exists: true, $ne: null } } },
            { $sort: { 'paymentLogs.approvalDate': -1 } },
            { $limit: 1 },
            { $project: {
                'paymentLogs.approvalDate': 1,
                'paymentLogs.approvedBy': 1, // This is an ObjectId referencing Admin (if populated) or string ID
                _id: 0
            }}
        ]);

        if (lastApprovedPayment.length > 0 && lastApprovedPayment[0].paymentLogs) {
            const log = lastApprovedPayment[0].paymentLogs;
            let adminName = 'Unknown Admin';
             // The 'approvedBy' in customerModel's paymentLogSchema is 'mongoose.Schema.Types.ObjectId, ref: 'Admin''
             // However, we don't have an Admin Mongoose model, and admins are from .env.
             // So, 'approvedBy' will likely store an admin identifier string (e.g., 'admin1', or admin email)
             // that was manually set when an admin approved a payment.
            if (log.approvedBy) {
                const foundAdmin = admins.find(a => a.id === log.approvedBy.toString() || a.email === log.approvedBy.toString());
                if (foundAdmin) adminName = foundAdmin.name;
                else adminName = log.approvedBy.toString(); // Fallback to the stored ID/email
            }
            lastCustomerPaymentInfo = `By: ${adminName} on ${new Date(log.approvalDate).toLocaleDateString()}`;
        }


        res.render('pages/admin/dashboard', {
            title: 'Admin Dashboard',
            adminName: req.session.adminName,
            stats: {
                totalStudents,
                activeStudents,
                totalCustomers,
                disconnectedCustomers,
                lastFeeUpdateInfo,
                lastCustomerPaymentInfo
            },
            layout: 'layouts/portal-admin'
        });

    } catch (error) {
        console.error("Error fetching admin dashboard stats:", error);
        req.flash('error_msg', 'Failed to load dashboard statistics.');
        res.render('pages/admin/dashboard', {
            title: 'Admin Dashboard',
            adminName: req.session.adminName,
            stats: {
                totalStudents: 'N/A',
                activeStudents: 'N/A',
                totalCustomers: 'N/A',
                disconnectedCustomers: 'N/A',
                lastFeeUpdateInfo: 'Error',
                lastCustomerPaymentInfo: 'Error'
            },
            layout: 'layouts/portal-admin'
        });
    }
};

// Update renderAdminPortal to call renderAdminDashboard
// The route /portals/admin is already pointing to renderAdminPortal
exports.renderAdminPortal = (req, res) => {
    if (req.session.adminId && req.session.userType === 'admin') {
        return res.redirect('/portals/admin/dashboard');
    }
    return res.redirect('/portals/admin/login');
};


// --- Student Management ---

/**
 * Renders the list of all students for admin.
 */
exports.renderStudentListPage = async (req, res) => {
    if (!req.session.adminId || req.session.userType !== 'admin') {
        req.flash('error_msg', 'Unauthorized access.');
        return res.redirect('/portals/admin/login');
    }
    try {
        const students = await db.allAsync("SELECT id, registration_number, first_name, second_name, surname, email, phone_number, is_active FROM students ORDER BY created_at DESC");
        res.render('pages/admin/students/index', { // Path based on ls output
            title: 'Students Management',
            adminName: req.session.adminName,
            students: students,
            layout: 'layouts/portal-admin'
        });
    } catch (error) {
        console.error("Error fetching students list for admin:", error);
        req.flash('error_msg', 'Failed to load student list.');
        res.redirect('/portals/admin/dashboard');
    }
};

/**
 * Renders the form to register a new student.
 */
exports.renderRegisterStudentForm = async (req, res) => {
    if (!req.session.adminId || req.session.userType !== 'admin') {
        req.flash('error_msg', 'Unauthorized access.');
        return res.redirect('/portals/admin/login');
    }
    // Fetch courses to select for enrollment (though spec implies a default "Computer Packages")
    // const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name ASC");
    res.render('pages/admin/register-student', { // Path based on ls output (register-student.ejs)
        title: 'Register New Student',
        adminName: req.session.adminName,
        // courses: courses,
        formData: {}, // For repopulating form on error
        errors: [],   // For displaying validation errors
        layout: 'layouts/portal-admin'
    });
};

/**
 * Handles submission of the new student registration form.
 */
exports.handleRegisterStudent = async (req, res) => {
    if (!req.session.adminId || req.session.userType !== 'admin') {
        req.flash('error_msg', 'Unauthorized action.');
        return res.redirect('/portals/admin/login');
    }

    const { firstName, secondName, surname, phoneNumber, email, courseFee, enrolledDate } = req.body;
    // Basic Validation (more can be added)
    if (!firstName || !surname || !phoneNumber || !email || !courseFee || !enrolledDate) {
        req.flash('error_msg', 'Please fill in all required fields: First Name, Surname, Phone, Email, Course Fee, and Enrolled Date.');
        // It's better to re-render the form with errors and formData
        return res.render('pages/admin/register-student', {
            title: 'Register New Student',
            adminName: req.session.adminName,
            formData: req.body,
            errors: [{ msg: 'Please fill in all required fields.' }], // Example error structure
            layout: 'layouts/portal-admin'
        });
    }

    // Validate phone number format (01... or 07..., 10 digits)
    if (!/^(0[17])\d{8}$/.test(phoneNumber)) {
         req.flash('error_msg', 'Invalid phone number format. Must be 10 digits starting with 01 or 07.');
         return res.render('pages/admin/register-student', {title: 'Register New Student', adminName: req.session.adminName, formData: req.body, errors: [{msg: 'Invalid phone number.'}], layout: 'layouts/portal-admin'});
    }
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        req.flash('error_msg', 'Invalid email format.');
        return res.render('pages/admin/register-student', {title: 'Register New Student', adminName: req.session.adminName, formData: req.body, errors: [{msg: 'Invalid email.'}], layout: 'layouts/portal-admin'});
    }


    try {
        // Check for existing email or phone
        const existingStudent = await db.getAsync("SELECT id FROM students WHERE email = ? OR phone_number = ?", [email.toLowerCase(), phoneNumber]);
        if (existingStudent) {
            req.flash('error_msg', 'A student with this email or phone number already exists.');
            return res.render('pages/admin/register-student', {title: 'Register New Student', adminName: req.session.adminName, formData: req.body, errors: [{msg: 'Email or phone already in use.'}], layout: 'layouts/portal-admin'});
        }

        // Generate Registration Number (TWOEM-XXX)
        const lastStudent = await db.getAsync("SELECT registration_number FROM students ORDER BY id DESC LIMIT 1");
        let nextRegNumInt = 1;
        if (lastStudent && lastStudent.registration_number) {
            const parts = lastStudent.registration_number.split('-');
            if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                nextRegNumInt = parseInt(parts[1]) + 1;
            }
        }
        const registrationNumber = `TWOEM-${String(nextRegNumInt).padStart(3, '0')}`;

        // Hash default password
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || "Stud@Twoem2025";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        // Insert into students table
        const result = await db.runAsync(
            `INSERT INTO students (registration_number, email, first_name, second_name, surname, phone_number, password_hash, enrolled_date, course_fee, requires_password_change, is_active, credentials_retrieved_once, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, FALSE, datetime('now'), datetime('now'))`,
            [registrationNumber, email.toLowerCase(), firstName, secondName || null, surname, phoneNumber, passwordHash, enrolledDate, parseFloat(courseFee)]
        );
        const studentId = result.lastID;

        // Create initial fee record
        await db.runAsync(
            `INSERT INTO fees (student_id, description, total_amount, amount_paid, payment_date, logged_by_admin_id, created_at, updated_at)
             VALUES (?, 'Initial Course Fee', ?, 0, datetime('now'), ?, datetime('now'), datetime('now'))`,
            [studentId, parseFloat(courseFee), req.session.adminId] // Logged by current admin
        );

        // TODO: Log admin action (e.g., STUDENT_REGISTERED)

        req.flash('success_msg', `Student ${firstName} ${surname} (${registrationNumber}) registered successfully. Default password is "${defaultPassword}".`);
        res.redirect('/portals/admin/students');

    } catch (error) {
        console.error("Error registering student:", error);
        req.flash('error_msg', 'Failed to register student. Please check details and try again.');
        res.render('pages/admin/register-student', {title: 'Register New Student', adminName: req.session.adminName, formData: req.body, errors: [{msg: 'Database error.'}], layout: 'layouts/portal-admin'});
    }
};


// Add other admin portal specific actions here later
// e.g., renderStudentManagement, etc.
