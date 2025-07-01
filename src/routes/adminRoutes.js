const express = require('express');
const router = express.Router();
const authAdminController = require('../controllers/authAdminController');
const { authAdmin } = require('../middleware/authMiddleware');
const mainController = require('../controllers/mainController'); // To render the login page initially

// GET Admin login page
router.get('/login', (req, res) => {
    // If admin is already logged in (e.g., valid token exists), redirect to dashboard
    // This requires a bit more logic to check token without full authAdmin middleware if it redirects
    // For now, simply render the login page. The authAdmin middleware will protect dashboard.
    if (req.cookies.token) {
        // A token exists, it might be an admin token.
        // A light check could be done here, or just let them see login.
        // If they submit login again, it will re-auth.
        // Or, redirect to dashboard and let authAdmin sort it out.
        // Let's try redirecting to dashboard and let authAdmin handle if it's not valid.
        // This is slightly presumptive but can improve UX.
        // A better check would be to quickly verify the token here if possible without full middleware stack.
        // For simplicity now, we'll just render the login page.
        // The `mainController.renderAdminLoginPage` will be removed later.
    }
    // res.render('pages/admin-login', { title: 'Admin Login', error: req.query.error, message: req.query.message });
    // Using mainController's method for now, will consolidate later if needed or make a specific admin one.
    mainController.renderAdminLoginPage(req, res);
});

// POST Admin login
router.post('/login', authAdminController.loginAdmin);

// GET Admin dashboard (protected)
router.get('/dashboard', authAdmin, async (req, res) => {
    try {
        // Quick stats for dashboard cards - ideally move this to a controller function
        const db = require('../config/database'); // Direct DB access for now
        const totalStudents = await db.getAsync("SELECT COUNT(*) as count FROM students");
        const totalCourses = await db.getAsync("SELECT COUNT(*) as count FROM courses");
        const totalCustomers = await db.getAsync("SELECT COUNT(*) as count FROM customers");

        const viewData = {
            title: 'Admin Dashboard',
            admin: req.admin, // req.admin is populated by authAdmin middleware
            studentStats: { totalStudents: totalStudents.count },
            courseStats: { totalCourses: totalCourses.count },
            customerStats: { totalCustomers: totalCustomers.count },
            // Add any other data admin-dashboard.ejs might need
        };

        res.render('layouts/admin_layout', {
            title: 'Admin Dashboard', // Title for the layout itself
            bodyView: 'pages/admin-dashboard', // Path to the actual page content
            admin: req.admin, // Pass admin to layout for header/sidebar if needed
            viewData: viewData // Data specific to the bodyView
        });
    } catch (error) {
        console.error("Error rendering admin dashboard:", error);
        req.flash('error_msg', "❌ Error loading dashboard data.");
        // Fallback render or redirect
        res.render('layouts/admin_layout', {
            title: 'Admin Dashboard Error',
            bodyView: 'pages/admin-dashboard', // still render the structure
            admin: req.admin,
            viewData: {
                title: 'Admin Dashboard',
                admin: req.admin,
                studentStats: { totalStudents: 'N/A' },
                courseStats: { totalCourses: 'N/A' },
                customerStats: { totalCustomers: 'N/A' },
                errorLoadingData: true
            }
        });
    }
});

// POST Admin logout
router.post('/logout', authAdminController.logoutAdmin);

const adminController = require('../controllers/adminController'); // Import the new admin controller

// Student Management Routes (within Admin)
router.get('/register-student', authAdmin, adminController.renderRegisterStudentForm);
router.post('/register-student', authAdmin, adminController.registerStudent);

// Email Management Routes
router.get('/emails/send', authAdmin, adminController.renderSendEmailForm);
router.post('/emails/send', authAdmin, adminController.sendBulkEmail);
router.get('/emails/test', authAdmin, adminController.renderEmailTestPage);
router.post('/emails/test', authAdmin, adminController.testEmailTemplate);
router.get('/emails/logs', authAdmin, adminController.viewEmailLogs);

// Student Management Routes
router.get('/students', authAdmin, adminController.listStudents);
router.get('/students/:id', authAdmin, adminController.viewStudentDetails);
router.get('/students/:id/edit', authAdmin, adminController.renderEditStudentForm);
router.post('/students/:id/edit', authAdmin, adminController.updateStudent);
router.post('/students/:id/toggle-status', authAdmin, adminController.toggleStudentStatus);
router.get('/students/:id/enrollments', authAdmin, adminController.renderManageStudentEnrollments);
router.post('/students/:id/enroll', authAdmin, adminController.enrollStudentInCourse);
router.post('/students/:id/unenroll', authAdmin, adminController.removeStudentFromCourse);

// Course Management Routes
router.get('/courses', authAdmin, adminController.listCourses);
router.get('/courses/add', authAdmin, adminController.renderAddCourseForm);
router.post('/courses/add', authAdmin, adminController.addCourse);
router.get('/courses/:id/edit', authAdmin, adminController.renderEditCourseForm);
router.post('/courses/:id/edit', authAdmin, adminController.updateCourse);
router.post('/courses/:id/delete', authAdmin, adminController.deleteCourse);

// Academic Management Routes
router.get('/academics/marks', authAdmin, adminController.renderEnterMarksForm);
router.post('/academics/marks', authAdmin, adminController.saveMarks);

// Fee Management Routes
router.get('/fees/log', authAdmin, adminController.renderLogFeeForm);
router.post('/fees/log', authAdmin, adminController.saveFeeEntry);

// Notifications Management Routes
router.get('/notifications', authAdmin, adminController.listNotifications);
router.get('/notifications/create', authAdmin, adminController.renderCreateNotificationForm);
router.post('/notifications/create', authAdmin, adminController.createNotification);
router.post('/notifications/delete/:id', authAdmin, adminController.deleteNotification);

// Study Resources Management Routes
router.get('/study-resources', authAdmin, adminController.listResources);
router.get('/study-resources/create', authAdmin, adminController.renderCreateResourceForm);
router.post('/study-resources/create', authAdmin, adminController.createResource);
router.get('/study-resources/:id/edit', authAdmin, adminController.renderEditResourceForm);
router.post('/study-resources/:id/edit', authAdmin, adminController.updateResource);
router.post('/study-resources/:id/delete', authAdmin, adminController.deleteResource);

// Settings Routes
router.get('/settings/wifi', authAdmin, adminController.renderWifiSettingsForm);
router.post('/settings/wifi', authAdmin, adminController.updateWifiSettings);

// Documents Management Routes
router.get('/documents', authAdmin, adminController.listDownloadableDocuments);
router.get('/documents/create', authAdmin, adminController.renderCreateDocumentForm);
router.post('/documents/create', authAdmin, adminController.createDocument);
router.get('/documents/:id/edit', authAdmin, adminController.renderEditDocumentForm);
router.post('/documents/:id/edit', authAdmin, adminController.updateDocument);
router.post('/documents/:id/delete', authAdmin, adminController.deleteDocument);

// Action Logs Route
router.get('/action-logs', authAdmin, adminController.viewActionLogs);

// Student Password Reset Route
router.post('/students/:id/reset-password', authAdmin, adminController.adminResetStudentPassword);
// router.get('/students/edit/:id', authAdmin, adminController.renderEditStudentForm);
// router.post('/students/edit/:id', authAdmin, adminController.updateStudent);


// Course Management Routes
router.get('/courses', authAdmin, adminController.listCourses);
router.get('/courses/add', authAdmin, adminController.renderAddCourseForm);
router.post('/courses/add', authAdmin, adminController.addCourse); // addCourse includes validation
router.get('/courses/edit/:id', authAdmin, adminController.renderEditCourseForm);
router.post('/courses/edit/:id', authAdmin, adminController.updateCourse); // updateCourse includes validation
router.post('/courses/delete/:id', authAdmin, adminController.deleteCourse);

// Admin - Student Viewing Routes
router.get('/students', authAdmin, adminController.listStudents);
router.get('/students/view/:id', authAdmin, adminController.viewStudentDetails);

// Admin - Student Editing & Status Routes
router.get('/students/edit/:id', authAdmin, adminController.renderEditStudentForm);
router.post('/students/edit/:id', authAdmin, adminController.updateStudent); // updateStudent includes validation
router.post('/students/toggle-status/:id', authAdmin, adminController.toggleStudentStatus);

// Admin - Student Enrollment Management Routes
router.get('/students/:studentId/enrollments', authAdmin, adminController.renderManageStudentEnrollments);
router.post('/students/:studentId/enrollments/add', authAdmin, adminController.enrollStudentInCourse);
router.post('/students/enrollments/remove/:enrollmentId', authAdmin, adminController.removeStudentFromCourse);

// Admin - Student Password Reset by Admin
router.post('/students/reset-password/:studentId', authAdmin, adminController.adminResetStudentPassword);

// Admin - Academic Records (Marks) Management Routes
router.get('/enrollments/:enrollmentId/marks', authAdmin, adminController.renderEnterMarksForm);
router.post('/enrollments/:enrollmentId/marks', authAdmin, adminController.saveMarks); // saveMarks includes validation

// Admin - Fee Management Routes
router.get('/students/:studentId/fees/log', authAdmin, adminController.renderLogFeeForm);
router.post('/students/:studentId/fees/log', authAdmin, adminController.saveFeeEntry); // saveFeeEntry includes validation
// TODO: Route to view all fees for a student: GET /admin/students/:studentId/fees

// Admin - Notification Management Routes
router.get('/notifications', authAdmin, adminController.listNotifications);
router.get('/notifications/create', authAdmin, adminController.renderCreateNotificationForm);
router.post('/notifications/create', authAdmin, adminController.createNotification); // createNotification includes validation
router.post('/notifications/delete/:id', authAdmin, adminController.deleteNotification);

// Admin - Study Resource Management Routes
router.get('/study-resources', authAdmin, adminController.listResources);
router.get('/study-resources/add', authAdmin, adminController.renderCreateResourceForm); // Changed from 'upload' to 'add' for consistency
router.post('/study-resources/add', authAdmin, adminController.createResource); // Changed from 'upload' to 'add'
router.get('/study-resources/edit/:id', authAdmin, adminController.renderEditResourceForm);
router.post('/study-resources/edit/:id', authAdmin, adminController.updateResource);
router.post('/study-resources/delete/:id', authAdmin, adminController.deleteResource);

// Admin - Site Settings (WiFi) Management Routes
router.get('/settings/wifi', authAdmin, adminController.renderWifiSettingsForm);
router.post('/settings/wifi', authAdmin, adminController.updateWifiSettings); // updateWifiSettings includes validation

// Admin - Database Management Routes
router.get('/settings/database/backup', authAdmin, adminController.downloadDatabaseBackup);
router.get('/settings/database/restore-page', authAdmin, adminController.renderRestoreDatabasePage);
const multer = require('multer');
const path = require('path');
// Configure multer for temporary storage of uploaded DB file
const upload = multer({
    dest: path.join(__dirname, '../../../uploads/'), // Temp directory for uploads
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.sqlite', '.db'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only .sqlite or .db files are allowed.'), false);
        }
    },
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});
router.post('/settings/database/restore', authAdmin, upload.single('dbfile'), adminController.handleRestoreDatabase);

// Admin - Downloadable Documents Management Routes
router.get('/documents', authAdmin, adminController.listDownloadableDocuments);
router.get('/documents/add', authAdmin, adminController.renderCreateDocumentForm);
router.post('/documents/add', authAdmin, adminController.createDocument); // createDocument includes validation
router.get('/documents/edit/:id', authAdmin, adminController.renderEditDocumentForm);
router.post('/documents/edit/:id', authAdmin, adminController.updateDocument); // updateDocument includes validation
router.post('/documents/delete/:id', authAdmin, adminController.deleteDocument);

// Admin - View Action Logs Route
router.get('/action-logs', authAdmin, adminController.viewActionLogs);

// Admin - Grading System Routes for "Computer Classes"
router.get('/courses/:courseId/enrolled-students', authAdmin, adminController.renderCourseEnrolledStudentsPage);
router.get('/enrollments/:enrollmentId/manage-marks', authAdmin, adminController.renderManageMarksPage);
router.post('/enrollments/:enrollmentId/manage-marks', authAdmin, adminController.saveStudentMarks); // Will include validation
router.post('/enrollments/:enrollmentId/finish-study', authAdmin, adminController.finishStudentCourseStudy);


// --- Internet Customer Management Routes (Admin Side) ---
const customerAdminController = require('../controllers/customerAdminController');
const customerAdminValidators = require('../middleware/validators/customerAdminValidators');

// Render form to add a new internet customer
router.get('/customers/register', authAdmin, customerAdminController.renderRegisterCustomerForm);

// Handle submission of new internet customer form
router.post(
    '/customers/register',
    authAdmin,
    customerAdminValidators.validateRegisterCustomer,
    customerAdminController.registerCustomer
);

// List all internet customers
router.get('/customers', authAdmin, customerAdminController.listCustomers);
// View a specific internet customer's details (already added in previous step, ensuring it's correct)
router.get('/customers/view/:id', authAdmin, customerAdminController.viewCustomerDetails);
// Render form to edit a customer
router.get('/customers/edit/:id', authAdmin, customerAdminController.renderEditCustomerForm);
// Handle submission of customer edit form
router.post(
    '/customers/edit/:id',
    authAdmin,
    customerAdminValidators.validateUpdateCustomer,
    customerAdminController.updateCustomerDetails
);
// Render page to manage payments for a specific customer
router.get('/customers/:customerId/payments', authAdmin, customerAdminController.renderManageCustomerPaymentsPage);
// Log a new manual payment for a customer
router.post('/customers/:customerId/payments/log-manual', authAdmin, customerAdminController.logManualPayment); // Add validation later
// Verify a pending customer-submitted payment
router.post('/customers/:customerId/payments/verify/:paymentLogId', authAdmin, customerAdminController.verifyCustomerPayment);
// Toggle customer active status
router.post('/customers/:id/toggle-status', authAdmin, customerAdminController.toggleCustomerActiveStatus);


// Placeholder for future routes related to customer management


module.exports = router;
