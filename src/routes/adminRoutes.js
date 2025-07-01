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

const db = require('../config/database'); // Ensure db is required

// GET Admin dashboard (protected)
router.get('/dashboard', authAdmin, async (req, res) => {
    try {
        let lastFeeUpdateAdminName = null;
        let lastFeeUpdateDate = null;

        // Get the last fee entry
        const lastFeeEntry = await db.getAsync(
            `SELECT f.created_at, f.logged_by_admin_id, a.name as admin_name
             FROM fees f
             LEFT JOIN admins a ON f.logged_by_admin_id = a.id
             ORDER BY f.created_at DESC
             LIMIT 1`
        );

        if (lastFeeEntry) {
            lastFeeUpdateAdminName = lastFeeEntry.admin_name || `Admin ID: ${lastFeeEntry.logged_by_admin_id}`; // Fallback if name not found
            lastFeeUpdateDate = lastFeeEntry.created_at;
        }

        res.render('pages/admin-dashboard', {
            title: 'Admin Dashboard',
            admin: req.admin, // req.admin is populated by authAdmin middleware
            lastFeeUpdateAdminName,
            lastFeeUpdateDate
        });
    } catch (err) {
        console.error("Error fetching data for admin dashboard:", err);
        // Render dashboard with error or default values for stats
        res.render('pages/admin-dashboard', {
            title: 'Admin Dashboard',
            admin: req.admin,
            lastFeeUpdateAdminName: 'Error',
            lastFeeUpdateDate: 'Error loading data',
            error_msg: 'Could not load some dashboard statistics.' // Optional: pass error to view
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

// Admin Compose Custom Email
router.get('/compose-email', authAdmin, adminController.renderComposeEmailForm);
router.post('/compose-email', authAdmin, adminController.handleSendComposedEmail);

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
// router.get('/enrollments/:enrollmentId/marks', authAdmin, adminController.renderEnterMarksForm); // Old generic marks form
// router.post('/enrollments/:enrollmentId/marks', authAdmin, adminController.saveMarks); // Old generic save marks

// New Specific Marks Management for "Computer Classes"
router.get('/enrollments/:enrollmentId/computer-class-marks', authAdmin, adminController.renderComputerClassMarksForm);
router.post('/enrollments/:enrollmentId/computer-class-marks', authAdmin, adminController.saveComputerClassMarks);
router.post('/enrollments/:enrollmentId/finish-course', authAdmin, adminController.finishCourseForStudent);


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

// Admin - Downloadable Documents Management Routes
router.get('/documents', authAdmin, adminController.listDownloadableDocuments);
router.get('/documents/add', authAdmin, adminController.renderCreateDocumentForm);
router.post('/documents/add', authAdmin, adminController.createDocument); // createDocument includes validation
router.get('/documents/edit/:id', authAdmin, adminController.renderEditDocumentForm);
router.post('/documents/edit/:id', authAdmin, adminController.updateDocument); // updateDocument includes validation
router.post('/documents/delete/:id', authAdmin, adminController.deleteDocument);

// Admin - View Action Logs Route
router.get('/action-logs', authAdmin, adminController.viewActionLogs);

// Admin - Internet Customer Management Routes
router.get('/customers/add', authAdmin, adminController.renderAddCustomerForm);
router.post('/customers/add', authAdmin, adminController.registerCustomer);
router.get('/customers', authAdmin, adminController.listCustomers); // Page to list all customers

// Routes for managing a single customer
router.get('/customers/:id/view', authAdmin, adminController.renderViewCustomerDetailsPage); // View/Edit form
router.post('/customers/:id/edit', authAdmin, adminController.updateCustomerDetails);
router.post('/customers/:id/payments', authAdmin, adminController.logCustomerPayment);
router.post('/customers/:id/toggle-status', authAdmin, adminController.toggleCustomerStatus);

module.exports = router;
