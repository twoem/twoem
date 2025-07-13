const Student = require('../models/Student');
const Customer = require('../models/Customer');
// Admin model might be needed if we display info about other admins, but not for these stats.

// @desc    Get Admin Dashboard with Statistics
// @route   GET /admin/dashboard
// @access  Private (Admin)
exports.getAdminDashboard = async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments();
        const totalCustomers = await Customer.countDocuments();

        const activeStudents = await Student.countDocuments({ isStudiesComplete: false });
        // For "Total Disconnected Customers", assuming 'Disconnected' is a value in connectionStatus
        const disconnectedCustomers = await Customer.countDocuments({ connectionStatus: 'Disconnected' });

        // Placeholders for complex stats - these require activity logging or more complex queries
        // For now, we'll just pass placeholder text.
        const lastUpdatedFeesByAdmin = "N/A (Feature pending)";
        const lastUpdatedCustomerPaymentByAdmin = "N/A (Feature pending)";

        // req.user is populated by admin auth middleware, should contain firstName
        const adminFirstName = req.user && req.user.firstName ? req.user.firstName : 'Admin';

        res.render('admin/dashboard', { // Will rename placeholder to dashboard.ejs
            pageTitle: 'Twoem Admin | Dashboard',
            user: req.user, // Pass the admin user object for layout/header
            stats: {
                totalStudents,
                totalCustomers,
                activeStudents,
                disconnectedCustomers,
                lastUpdatedFeesByAdmin,
                lastUpdatedCustomerPaymentByAdmin
            },
            adminFirstName: adminFirstName
        });

    } catch (err) {
        console.error('Error fetching admin dashboard stats:', err);
        const adminNameForError = req.user && req.user.firstName ? req.user.firstName : 'Admin';
        res.status(500).render('admin/dashboard', {
            pageTitle: 'Twoem Admin | Dashboard',
            user: req.user,
            stats: { // Send empty/error stats
                totalStudents: 'Error',
                totalCustomers: 'Error',
                activeStudents: 'Error',
                disconnectedCustomers: 'Error',
                lastUpdatedFeesByAdmin: 'Error fetching data',
                lastUpdatedCustomerPaymentByAdmin: 'Error fetching data'
            },
            adminFirstName: adminNameForError,
            error: 'Server error loading dashboard statistics.',
            success: null
        });
    }
};

// @desc    Get customer details as JSON (for modal view)
// @route   GET /admin/customers/:customerId/details-json
// @access  Private (Admin)
exports.getCustomerDetailsJson = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.customerId)
            .select('-password -resetPasswordToken -resetPasswordExpires -resetPasswordOtp') // Exclude sensitive fields
            .lean();

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found.' });
        }
        res.json(customer);
    } catch (error) {
        console.error("Error fetching customer details for JSON:", error);
        res.status(500).json({ error: 'Server error fetching customer details.' });
    }
};

// @desc    Get student details as JSON (for modal view)
// @route   GET /admin/students/:studentId/details-json
// @access  Private (Admin)
exports.getStudentDetailsJson = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId)
            .select('-password -resetPasswordToken -resetPasswordExpires -resetPasswordOtp') // Exclude sensitive fields
            .lean();

        if (!student) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        res.json(student);
    } catch (error) {
        console.error("Error fetching student details for JSON:", error);
        res.status(500).json({ error: 'Server error fetching student details.' });
    }
};

// --- Bulk/Single Email Functions ---

// Send Bulk Email to Students
exports.sendBulkStudentEmail = async (req, res) => {
    const { subject, messageBody } = req.body;
    if (!subject || !messageBody) {
        req.flash('error_msg', 'Subject and Message Body are required for bulk student email.');
        return res.redirect('/admin/mailer');
    }
    try {
        const students = await Student.find({ email: { $ne: null } }).select('email firstName').lean(); // Get students with emails
        if (!students || students.length === 0) {
            req.flash('error_msg', 'No students found to send emails to.');
            return res.redirect('/admin/mailer');
        }

        let emailsSent = 0;
        let emailErrors = 0;

        for (const student of students) {
            const personalizedBody = `<p>Dear ${student.firstName},</p>${messageBody}`; // Simple personalization
            try {
                await sendEmail({
                    to: student.email,
                    subject: subject,
                    html: personalizedBody
                });
                emailsSent++;
            } catch (err) {
                console.error(`Failed to send email to student ${student.email}:`, err.message);
                emailErrors++;
            }
        }
        req.flash('success_msg', `Bulk email process complete. Sent: ${emailsSent}. Failed: ${emailErrors}.`);
        res.redirect('/admin/mailer');
    } catch (error) {
        console.error("Error sending bulk student email:", error);
        req.flash('error_msg', 'Failed to send bulk student emails: ' + error.message);
        res.redirect('/admin/mailer');
    }
};

// Send Bulk Email to Customers
exports.sendBulkCustomerEmail = async (req, res) => {
    const { subject, messageBody } = req.body;
    if (!subject || !messageBody) {
        req.flash('error_msg', 'Subject and Message Body are required for bulk customer email.');
        return res.redirect('/admin/mailer');
    }
    try {
        const customers = await Customer.find({ email: { $ne: null } }).select('email firstName').lean();
        if (!customers || customers.length === 0) {
            req.flash('error_msg', 'No customers found to send emails to.');
            return res.redirect('/admin/mailer');
        }

        let emailsSent = 0;
        let emailErrors = 0;

        for (const customer of customers) {
            const personalizedBody = `<p>Dear ${customer.firstName},</p>${messageBody}`;
            try {
                await sendEmail({
                    to: customer.email,
                    subject: subject,
                    html: personalizedBody
                });
                emailsSent++;
            } catch (err) {
                console.error(`Failed to send email to customer ${customer.email}:`, err.message);
                emailErrors++;
            }
        }
        req.flash('success_msg', `Bulk email process complete. Sent: ${emailsSent}. Failed: ${emailErrors}.`);
        res.redirect('/admin/mailer');
    } catch (error) {
        console.error("Error sending bulk customer email:", error);
        req.flash('error_msg', 'Failed to send bulk customer emails: ' + error.message);
        res.redirect('/admin/mailer');
    }
};

// Send Single (Random) Email
exports.sendSingleEmail = async (req, res) => {
    const { recipientEmail, subject, messageBody } = req.body;
    if (!recipientEmail || !subject || !messageBody) {
        req.flash('error_msg', 'Recipient Email, Subject, and Message Body are required.');
        return res.redirect('/admin/mailer');
    }
    if (!/\S+@\S+\.\S+/.test(recipientEmail)) { // Basic email validation
        req.flash('error_msg', 'Invalid recipient email format.');
        return res.redirect('/admin/mailer');
    }

    try {
        await sendEmail({
            to: recipientEmail,
            subject: subject,
            html: messageBody
        });
        req.flash('success_msg', `Email successfully sent to ${recipientEmail}.`);
        res.redirect('/admin/mailer');
    } catch (error) {
        console.error("Error sending single email:", error);
        req.flash('error_msg', 'Failed to send email: ' + error.message);
        res.redirect('/admin/mailer');
    }
};

// Mailer Section
const sendEmail = require('../utils/emailUtils'); // Assuming this path is correct from root
const crypto = require('crypto'); // For generating dummy tokens

// @desc    Render Mailer Page
// @route   GET /admin/mailer
// @access  Private (Admin)
exports.getMailerPage = async (req, res) => {
    res.render('admin/mailer', {
        pageTitle: 'Twoem Admin | Send Mail',
        user: req.user,
        activePage: 'mailer'
    });
};

// --- Test Email Functions ---
const getTestEmailRecipient = () => {
    return process.env.TEST_EMAIL_RECIPIENT || 'admin@example.com'; // Fallback if not set
};

// Test Customer Password Reset Email
exports.sendTestCustomerPasswordResetEmail = async (req, res) => {
    const testEmail = getTestEmailRecipient();
    try {
        const dummyToken = crypto.randomBytes(20).toString('hex');
        const dummyOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const resetUrl = `${req.protocol}://${req.get('host')}/customer/reset-password/${dummyToken}`;
        const messageBody = `
            <p>Hello [Test Customer Name],</p>
            <p>This is a test of the password reset email for Twoem Customers.</p>
            <p>Your One-Time Password (OTP) is: <strong>${dummyOtp}</strong></p>
            <p>Reset link: <a href="${resetUrl}">Reset Password</a></p>
            <p>If you did not request this, please ignore this email.</p>
        `;
        await sendEmail({
            to: testEmail,
            subject: '[TEST] Customer Password Reset',
            html: messageBody
        });
        req.flash('success_msg', 'Test Customer Password Reset Email Sent to ' + testEmail);
        res.redirect('/admin/mailer');
    } catch (error) {
        console.error("Error sending test customer password reset email:", error);
        req.flash('error_msg', 'Failed to send test email: ' + error.message);
        res.redirect('/admin/mailer');
    }
};

// Test Student Password Reset Email
exports.sendTestStudentPasswordResetEmail = async (req, res) => {
    const testEmail = getTestEmailRecipient();
     try {
        const dummyToken = crypto.randomBytes(20).toString('hex');
        const dummyOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const resetUrl = `${req.protocol}://${req.get('host')}/student/reset-password/${dummyToken}`;
        const messageBody = `
            <p>Hello [Test Student Name],</p>
            <p>This is a test of the password reset email for Twoem Students.</p>
            <p>Your One-Time Password (OTP) is: <strong>${dummyOtp}</strong></p>
            <p>Reset link: <a href="${resetUrl}">Reset Password</a></p>
        `;
        await sendEmail({
            to: testEmail,
            subject: '[TEST] Student Password Reset',
            html: messageBody
        });
        req.flash('success_msg', 'Test Student Password Reset Email Sent to ' + testEmail);
        res.redirect('/admin/mailer');
    } catch (error) {
        console.error("Error sending test student password reset email:", error);
        req.flash('error_msg', 'Failed to send test email: ' + error.message);
        res.redirect('/admin/mailer');
    }
};

// Test New Student Initial Details Email (Conceptual, as system doesn't send this automatically yet)
exports.sendTestNewStudentInitialDetailsEmail = async (req, res) => {
    const testEmail = getTestEmailRecipient();
    try {
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || "Stud@Twoem2025";
        const messageBody = `
            <p>Hello [Test Student Name],</p>
            <p>Welcome to Twoem Institute! This is a test of the initial details email.</p>
            <p>Your Registration Number: <strong>TWOEM-TEST</strong></p>
            <p>Your Default Password: <strong>${defaultPassword}</strong></p>
            <p>Please login and change your password immediately.</p>
        `;
        await sendEmail({
            to: testEmail,
            subject: '[TEST] New Student Initial Details',
            html: messageBody
        });
        req.flash('success_msg', 'Test New Student Initial Details Email Sent to ' + testEmail);
        res.redirect('/admin/mailer');
    } catch (error) {
        console.error("Error sending test new student details email:", error);
        req.flash('error_msg', 'Failed to send test email: ' + error.message);
        res.redirect('/admin/mailer');
    }
};

// @desc    Get Customer Management Page (List customers and show registration form)
// @route   GET /admin/customers
// @access  Private (Admin)
exports.getCustomerManagementPage = async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 }); // Newest first
        const pendingConfirmations = await PaymentConfirmation.find({ status: 'Pending Verification' })
            .populate('customer', 'firstName lastName accountNumber email') // Populate customer details
            .sort({ createdAt: 1 }); // Oldest pending first

        res.render('admin/customers', {
            pageTitle: 'Twoem Admin | Customers',
            user: req.user, // Admin user for layout
            customers: customers,
            pendingConfirmations: pendingConfirmations, // Pass to view
            activePage: 'customers' // For sidebar active state
        });
    } catch (err) {
        console.error("Error fetching customers/payment confirmations for management page:", err);
        res.status(500).render('admin/customers', {
            pageTitle: 'Twoem Admin | Customers',
            user: req.user,
            customers: [],
            error: "Server error loading customer data. Please try again.",
            success: null,
            activePage: 'customers'
        });
    }
};

// Helper function to generate next customer account number
async function getNextAccountNumber() {
    const lastCustomer = await Customer.findOne().sort({ accountNumber: -1 }); // Sort by accNo desc
    const prefix = "CUST-";
    if (lastCustomer && lastCustomer.accountNumber && lastCustomer.accountNumber.startsWith(prefix)) {
        const lastNumStr = lastCustomer.accountNumber.substring(prefix.length);
        if (!isNaN(lastNumStr)) {
            const lastNumber = parseInt(lastNumStr, 10);
            const nextNumber = lastNumber + 1;
            return `${prefix}${String(nextNumber).padStart(4, '0')}`; // CUST-0001, CUST-0010 etc.
        }
    }
    return `${prefix}0001`; // Default if no customers or format is unexpected
}

// @desc    Register a new customer
// @route   POST /admin/customers/register
// @access  Private (Admin)
exports.registerCustomer = async (req, res) => {
    const {
        firstName, lastName, phoneNumber, email, location,
        subscriptionPerMonth, balanceDue
    } = req.body;
    let { accountNumber } = req.body; // accountNumber can be optional

    // Basic validation
    const requiredFields = { firstName, lastName, phoneNumber, email, location, subscriptionPerMonth, balanceDue };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || String(value).trim() === '') {
            req.flash('error_msg', `${field.replace(/([A-Z])/g, ' $1').trim()} is required.`);
            return res.redirect('/admin/customers');
        }
    }
     if (!/\S+@\S+\.\S+/.test(email)) {
        req.flash('error_msg', 'Invalid email format.');
        return res.redirect('/admin/customers');
    }
    if (!/^(0[17][0-9]{8})$/.test(phoneNumber)) {
        req.flash('error_msg', 'Invalid phone number format.');
        return res.redirect('/admin/customers');
    }
    if (isNaN(parseFloat(subscriptionPerMonth)) || parseFloat(subscriptionPerMonth) < 0) {
        req.flash('error_msg', 'Invalid subscription amount.');
        return res.redirect('/admin/customers');
    }
    if (isNaN(parseFloat(balanceDue))) { // balanceDue can be 0
        req.flash('error_msg', 'Invalid initial balance due.');
        return res.redirect('/admin/customers');
    }


    try {
        // Check for existing customer by email or phone
        const existingByEmail = await Customer.findOne({ email: email.toLowerCase() });
        if (existingByEmail) {
            req.flash('error_msg', 'Email already registered to another customer.');
            return res.redirect('/admin/customers');
        }
        // const existingByPhone = await Customer.findOne({ phoneNumber });
        // if (existingByPhone) {
        //     req.flash('error_msg', 'Phone number already registered.');
        //     return res.redirect('/admin/customers');
        // }

        if (!accountNumber || accountNumber.trim() === '') {
            accountNumber = await getNextAccountNumber();
        } else {
            // Optional: Validate provided account number format or uniqueness if admin enters manually
            const existingByAccountNo = await Customer.findOne({ accountNumber: accountNumber.toUpperCase() });
            if (existingByAccountNo) {
                req.flash('error_msg', `Account number ${accountNumber} already exists.`);
                return res.redirect('/admin/customers');
            }
            accountNumber = accountNumber.toUpperCase();
        }

        const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || "Mynet@2025";

        const newCustomer = new Customer({
            firstName, lastName, phoneNumber,
            email: email.toLowerCase(),
            location,
            subscriptionPerMonth: parseFloat(subscriptionPerMonth),
            accountNumber,
            balanceDue: parseFloat(balanceDue),
            password: defaultPassword, // Will be hashed by pre-save hook
            isDefaultPassword: true,
            // connectionStatus defaults to 'Active' as per model
        });

        await newCustomer.save();

        const successMsg = `Customer ${firstName} ${lastName} registered! Account No: ${accountNumber}, Default Pass: ${defaultPassword}.`;
        req.flash('success_msg', successMsg);
        res.redirect('/admin/customers');

    } catch (err) {
        console.error("Error registering customer:", err);
        let errorMessage = "Server error during customer registration.";
         if (err.code === 11000) {
            errorMessage = "A customer with similar unique details (e.g., email, phone, or account number) might already exist.";
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(e => e.message).join(', ');
        }
        req.flash('error_msg', errorMessage);
        res.redirect('/admin/customers');
    }
};

// @desc    Reset a student's password to default
// @route   POST /admin/students/:studentId/reset-password
// @access  Private (Admin)
exports.resetStudentPasswordToDefault = async (req, res) => {
    const { studentId } = req.params;
    const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || "Stud@Twoem2025";

    try {
        const student = await Student.findById(studentId);
        if (!student) {
            req.flash('error_msg', 'Student not found.');
            return res.redirect('/admin/students');
        }

        student.password = defaultPassword; // Will be hashed by pre-save hook
        student.isDefaultPassword = true;   // Force password change on next student login
        student.initialDetailsViewed = true; // If they had viewed it, this doesn't change. If not, admin reset implies they might need to see it.
                                            // Or, admin should re-communicate the default pass. Let's assume admin communicates.

        // Invalidate existing sessions by changing a field that might be part of JWT salt or by tracking forced logouts
        // For simplicity, we are not implementing session invalidation here, but it's a good security practice.
        // student.passwordChangedAt = Date.now(); // Example if tracking password changes

        await student.save();

        const successMsg = `Password for ${student.firstName} ${student.lastName} (Reg No: ${student.registrationNumber}) has been reset to default: ${defaultPassword}.`;
        req.flash('success_msg', successMsg);
        res.redirect('/admin/students');

    } catch (err) {
        console.error("Error resetting student password:", err);
        req.flash('error_msg', `Server error resetting password for student ID ${studentId}.`);
        res.redirect('/admin/students');
    }
};

// @desc    Get Student Management Page (List students and show registration form)
// @route   GET /admin/students
// @access  Private (Admin)
exports.getStudentManagementPage = async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 }); // Fetch all students, newest first

        res.render('admin/students', {
            pageTitle: 'Twoem Admin | Students',
            user: req.user, // Admin user for layout
            students: students,
            activePage: 'students' // For sidebar active state
        });
    } catch (err) {
        console.error("Error fetching students for management page:", err);
        res.status(500).render('admin/students', {
            pageTitle: 'Twoem Admin | Students',
            user: req.user,
            students: [],
            error: "Server error loading student data. Please try again.",
            success: null,
            activePage: 'students'
        });
    }
};

// Helper function to generate next registration number
async function getNextRegistrationNumber() {
    const lastStudent = await Student.findOne().sort({ registrationNumber: -1 }); // Sort by regNo descending
    if (lastStudent && lastStudent.registrationNumber) {
        const lastRegNo = lastStudent.registrationNumber; // e.g., TWOEM-023
        const parts = lastRegNo.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
            const lastNumber = parseInt(parts[1], 10);
            const nextNumber = lastNumber + 1;
            return `TWOEM-${String(nextNumber).padStart(3, '0')}`; // Ensures TWOEM-001, TWOEM-024 etc.
        }
    }
    // Default if no students or format is unexpected
    return 'TWOEM-001';
}


// @desc    Register a new student
// @route   POST /admin/students/register
// @access  Private (Admin)
exports.registerStudent = async (req, res) => {
    const { firstName, lastName, phoneNumber, email, feesBalance, timeStudied } = req.body;

    // Basic validation (more can be added)
    if (!firstName || !lastName || !phoneNumber || !email || feesBalance === undefined) {
        // This error handling should ideally re-render the student management page
        // with an error message related to the modal.
        // For simplicity now, redirecting with query param.
        req.flash('error_msg', 'All fields (First Name, Last Name, Phone, Email, Fees Balance) are required for registration.');
        return res.redirect('/admin/students');
    }

    // Validate email format
    if (!/\S+@\S+\.\S+/.test(email)) {
        req.flash('error_msg', 'Invalid email format.');
        return res.redirect('/admin/students');
    }
    // Validate phone format
    if (!/^(0[17][0-9]{8})$/.test(phoneNumber)) {
        req.flash('error_msg', 'Invalid phone number format.');
        return res.redirect('/admin/students');
    }


    try {
        // Check if email or phone already exists for another student
        const existingStudentByEmail = await Student.findOne({ email: email.toLowerCase() });
        if (existingStudentByEmail) {
            req.flash('error_msg', 'Email address already registered to another student.');
            return res.redirect('/admin/students');
        }
        // const existingStudentByPhone = await Student.findOne({ phoneNumber });
        // if (existingStudentByPhone) {
        //     req.flash('error_msg', 'Phone number already registered to another student.');
        //     return res.redirect('/admin/students');
        // }

        const registrationNumber = await getNextRegistrationNumber();
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || "Stud@Twoem2025";

        const newStudent = new Student({
            firstName,
            lastName,
            phoneNumber,
            email: email.toLowerCase(),
            feesBalance: parseFloat(feesBalance),
            timeStudied: timeStudied || "Computer Packages Course",
            registrationNumber,
            password: defaultPassword, // Will be hashed by pre-save hook
            isDefaultPassword: true,
            profileRequiresUpdate: true // New students need to update Next of Kin
        });

        await newStudent.save();

        // Success message should ideally show the generated RegNo and Password
        const successMsg = `Student ${firstName} ${lastName} registered successfully! Reg No: ${registrationNumber}, Default Password: ${defaultPassword}.`;
        req.flash('success_msg', successMsg);
        res.redirect('/admin/students');

    } catch (err) {
        console.error("Error registering student:", err);
        let errorMessage = "Server error during student registration.";
        if (err.code === 11000) { // Duplicate key error (e.g. if reg no generation had a race condition, or email was unique)
            errorMessage = "A student with similar unique details (e.g., email or registration number) might already exist.";
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(e => e.message).join(', ');
        }
        req.flash('error_msg', errorMessage);
        res.redirect('/admin/students');
    }
};

// @desc    Placeholder for updating customer payment (Admin Action)
// @route   POST /admin/customers/:customerId/update-payment (Example route)
// @access  Private (Admin)
exports.updateCustomerPayment = async (req, res) => {
    const { customerId } = req.params;
    // const { amountPaid, paymentDate, mpesaCodeVerified } = req.body; // Example fields
    // Logic to find customer, update balanceDue, lastPaymentDate, verify PaymentConfirmation records etc.
    console.log(`Admin action: Update payment for customer ${customerId} - Placeholder`);
    res.redirect(`/admin/customers?info=Payment update for customer ${customerId} is a placeholder action.`);
};

// @desc    Placeholder for toggling customer connection status (Admin Action)
// @route   POST /admin/customers/:customerId/toggle-connection
// @access  Private (Admin)
exports.toggleCustomerConnectionStatus = async (req, res) => {
    const { customerId } = req.params;
    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            req.flash('error_msg', 'Customer not found.');
            return res.redirect('/admin/customers');
        }

        if (customer.connectionStatus === 'Active') {
            customer.connectionStatus = 'Disconnected';
            customer.disconnectionDate = new Date();
        } else { // If 'Disconnected' or any other status, set to 'Active'
            customer.connectionStatus = 'Active';
            customer.disconnectionDate = null; // Clear disconnection date when re-activating
        }

        await customer.save();
        req.flash('success_msg', `Connection status for ${customer.firstName} ${customer.lastName} updated to ${customer.connectionStatus}.`);
        res.redirect('/admin/customers');

    } catch (err) {
        console.error("Error toggling customer connection status:", err);
        req.flash('error_msg', 'Server error toggling connection status.');
        res.redirect('/admin/customers');
    }
};

// @desc    Reset a customer's password to default
// @route   POST /admin/customers/:customerId/reset-password
// @access  Private (Admin)
exports.resetCustomerPasswordToDefault = async (req, res) => {
    const { customerId } = req.params;
    const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || "Mynet@2025";

    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            req.flash('error_msg', 'Customer not found.');
            return res.redirect('/admin/customers');
        }

        customer.password = defaultPassword; // Will be hashed by pre-save hook
        customer.isDefaultPassword = true;   // Force password change on next customer login

        await customer.save();

        const successMsg = `Password for ${customer.firstName} ${customer.lastName} (Acc No: ${customer.accountNumber}) has been reset to default: ${defaultPassword}.`;
        req.flash('success_msg', successMsg);
        res.redirect('/admin/customers');

    } catch (err) {
        console.error("Error resetting customer password:", err);
        req.flash('error_msg', `Server error resetting password for customer ID ${customerId}.`);
        res.redirect('/admin/customers');
    }
};

// --- Backup and Restore Section ---
const archiver = require('archiver');
const fs = require('fs'); // For temporary file interactions if needed, though ideally stream directly
const path = require('path');
const PaymentConfirmation = require('../models/PaymentConfirmation'); // Ensure this is imported if not already

// @desc    Render Backup Page
// @route   GET /admin/backup
// @access  Private (Admin)
exports.getBackupPage = async (req, res) => {
    res.render('admin/backup', {
        pageTitle: 'Twoem Admin | Backups',
        user: req.user,
        activePage: 'backup'
    });
};

// @desc    Download Database Backup (JSON files in ZIP)
// @route   GET /admin/backup/download
// @access  Private (Admin)
exports.downloadBackup = async (req, res) => {
    try {
        const collectionsToBackup = [
            { model: Student, name: 'students' },
            { model: Customer, name: 'customers' },
            { model: Admin, name: 'admins' },
            { model: PaymentConfirmation, name: 'paymentconfirmations' }
        ];

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=twoem_backup_${new Date().toISOString().split('T')[0]}.zip`);

        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        archive.on('error', function(err) {
            throw err;
        });

        archive.pipe(res); // Pipe archive data to the response

        for (const item of collectionsToBackup) {
            const data = await item.model.find().lean();
            const jsonData = JSON.stringify(data, null, 2);
            archive.append(jsonData, { name: `${item.name}.json` });
        }

        await archive.finalize();

    } catch (err) {
        console.error("Error generating backup:", err);
        // If headers already sent, we can't send a redirect.
        // Best effort to inform user if possible, otherwise just log.
        if (!res.headersSent) {
            req.flash('error_msg', 'Failed to generate backup: ' + err.message);
            res.redirect('/admin/backup');
        } else {
            // Consider how to handle errors when streaming has started.
            // For simplicity, we're ending the response if it's still open.
            if (!res.writableEnded) {
                 res.status(500).end('Error generating backup stream.');
            }
        }
    }
};


// @desc    Upload Backup File (Placeholder for Restore)
// @route   POST /admin/backup/upload
// @access  Private (Admin)
// Multer middleware will handle file parsing before this controller.
exports.uploadBackup = async (req, res) => {
    if (!req.file) {
        req.flash('error_msg', 'No backup file uploaded.');
        return res.redirect('/admin/backup');
    }

    // req.file contains information about the uploaded file (path, name, etc.)
    // Example: req.file.path (if multer saves to disk) or req.file.buffer (if memory storage)

    const filePath = req.file.path; // Path where multer saved the file
    console.log(`Backup file uploaded: ${req.file.originalname} to ${filePath}`);

    // **Placeholder for actual restore logic**
    // 1. Unzip the file
    // 2. For each .json file:
    //    a. Clear the corresponding collection (optional, depends on restore strategy)
    //    b. Parse JSON data
    //    c. Insert data into the MongoDB collection (e.g., using Model.insertMany(jsonData))
    //    Handle potential errors, data validation, schema mismatches etc.
    // 3. Delete the temporary uploaded file (filePath)

    // For now, just acknowledge upload and delete temp file.
    // fs.unlink(filePath, (err) => { // Example of deleting temp file
    //     if (err) console.error("Error deleting temp backup file:", err);
    // });

    const successMsg = `Backup file '${req.file.originalname}' uploaded successfully. Actual data restoration from this file is a placeholder and requires manual database operations or further development. The uploaded file is temporarily stored at: ${filePath} (and should be processed/deleted).`;
    req.flash('success_msg', successMsg);
    res.redirect('/admin/backup');
};



// Other admin-specific controller functions will go here in later phases
// e.g., for student management, customer management, mailer, backup.
