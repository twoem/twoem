const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { randomBytes } = require('crypto');
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

async function logAdminAction(admin_id, action_type, description, target_entity_type, target_entity_id, ip_address) {
    try {
        await db.runAsync(
            `INSERT INTO action_logs (admin_id, action_type, description, target_entity_type, target_entity_id, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [admin_id, action_type, description, target_entity_type, target_entity_id, ip_address]
        );
    } catch (logErr) {
        console.error("Failed to log admin action:", logErr);
    }
}

const renderRegisterStudentForm = (req, res) => {
    const viewData = {
        title: 'Register New Student', // This title is for the content page
        admin: req.admin,
        errors: JSON.parse(req.flash('validation_errors')[0] || '[]'), // Parse flashed errors
        firstName: req.flash('firstName')[0] || '',
        secondName: req.flash('secondName')[0] || '',
        surname: req.flash('surname')[0] || '',
        email: req.flash('email')[0] || '',
        enrolledDate: req.flash('enrolledDate')[0] || new Date().toISOString().split('T')[0], // Default to today
        courseFee: req.flash('courseFee')[0] || ''
    };
    res.render('layouts/admin_layout', {
        title: 'Register New Student', // This is for the <title> tag in the layout
        bodyView: 'pages/admin/register-student',
        admin: req.admin, // For the layout's own needs (e.g. sidebar)
        viewData: viewData
    });
};

const registerStudent = [
    // Validation middleware
    body('firstName').trim().notEmpty().withMessage('First Name is required.'),
    body('email').trim().isEmail().withMessage('A valid Email is required.'),
    body('secondName').trim().optional({ checkFalsy: true }),
    body('surname').trim().optional({ checkFalsy: true }),
    body('enrolledDate').isISO8601().toDate().withMessage('A valid Enrolled Date is required.'),
    body('courseFee').optional({ checkFalsy: true }).isFloat({ gt: 0 }).withMessage('Course Fee must be a positive number if provided.'),

    async (req, res) => {
        const errors = validationResult(req);
        const { firstName, secondName, surname, email, enrolledDate, courseFee } = req.body;
        const admin = req.admin;

        if (!errors.isEmpty()) {
            req.flash('validation_errors', JSON.stringify(errors.array()));
            req.flash('firstName', firstName);
            req.flash('secondName', secondName);
            req.flash('surname', surname);
            req.flash('email', email);
            req.flash('enrolledDate', enrolledDate);
            req.flash('courseFee', courseFee);
            return res.redirect('/admin/register-student');
        }

        try {
            const existingStudent = await db.getAsync("SELECT * FROM students WHERE email = ?", [email.toLowerCase()]);
            if (existingStudent) {
                req.flash('validation_errors', JSON.stringify([{ param: 'email', msg: 'A student with this email address already exists.' }]));
                req.flash('firstName', firstName);
                req.flash('secondName', secondName);
                req.flash('surname', surname);
                req.flash('email', email);
                req.flash('enrolledDate', enrolledDate);
                req.flash('courseFee', courseFee);
                return res.redirect('/admin/register-student');
            }

            // Sequential Registration Number
            await db.runAsync("UPDATE app_sequences SET last_value = last_value + 1 WHERE sequence_name = 'student_registration'");
            const seq = await db.getAsync("SELECT last_value FROM app_sequences WHERE sequence_name = 'student_registration'");
            const newRegNum = `TWOEM-${seq.last_value.toString().padStart(4, '0')}`;

            const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD;
            if (!defaultPassword) {
                console.error("DEFAULT_STUDENT_PASSWORD is not set in .env");
                req.flash('error_msg', '❌ Operation Failed! ❌ Server configuration error: Default password not set. 😔');
                return res.redirect('/admin/register-student');
            }
            const passwordHash = await bcrypt.hash(defaultPassword, 10);

            const sql = `INSERT INTO students (
                            registration_number, email, first_name, second_name, surname,
                            enrolled_date, course_fee, password_hash,
                            requires_password_change, is_profile_complete, is_active, updated_at
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, TRUE, CURRENT_TIMESTAMP)`;
            const params = [
                newRegNum, email.toLowerCase(), firstName, secondName || null, surname || null,
                enrolledDate, courseFee ? parseFloat(courseFee) : null, passwordHash
            ];
            const result = await db.runAsync(sql, params);

            const studentFullName = `${firstName} ${secondName || ''} ${surname || ''}`.replace(/\s+/g, ' ').trim();
            if (result && typeof result.lastID !== 'undefined') {
                logAdminAction(req.admin.id, 'STUDENT_REGISTERED', `Admin ${admin.name} registered student: ${studentFullName} (${email}), RegNo: ${newRegNum}`, 'student', result.lastID, req.ip);
            } else {
                logAdminAction(req.admin.id, 'STUDENT_REGISTERED', `Admin ${admin.name} registered student: ${studentFullName} (${email}), RegNo: ${newRegNum} (lastID not retrieved)`, 'student', null, req.ip);
                console.warn("[Register Student] Could not retrieve lastID for logging for student:", newRegNum);
            }

            req.flash('success_msg', `✨ Success! ✨ Student ${studentFullName} (${email}) registered successfully with Registration Number: ${newRegNum}. 🎉`);
            res.redirect('/admin/register-student');
        } catch (err) {
            console.error("Error registering student:", err);
            // Flash all inputs back in case of a general error too
            req.flash('firstName', firstName);
            req.flash('secondName', secondName);
            req.flash('surname', surname);
            req.flash('email', email);
            req.flash('enrolledDate', enrolledDate);
            req.flash('courseFee', courseFee);
            req.flash('error_msg', `❌ Operation Failed! ❌ An error occurred while registering the student. ${err.message} 😔`);
            res.redirect('/admin/register-student');
        }
    }
];

const listCourses = async (req, res) => {
    try {
        const courses = await db.allAsync("SELECT * FROM courses ORDER BY created_at DESC");
        const viewData = {
            title: 'Manage Courses', // For the content page heading
            admin: req.admin,
            courses: courses
        };
        res.render('layouts/admin_layout', {
            title: 'Manage Courses', // For the <title> tag in layout
            bodyView: 'pages/admin/courses/index',
            admin: req.admin,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching courses:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t retrieve courses. ${err.message} 😔`);
        // Attempt to render the page with an error state within the layout
        const errorViewData = {
            title: 'Manage Courses - Error',
            admin: req.admin,
            courses: [],
            errorLoading: true,
            errorMessage: err.message
        };
        res.status(500).render('layouts/admin_layout', {
            title: 'Error Loading Courses',
            bodyView: 'pages/admin/courses/index', // Render the same page structure
            admin: req.admin,
            viewData: errorViewData
        });
    }
};
const renderAddCourseForm = (req, res) => {
    const viewData = {
        title: 'Add New Course',
        admin: req.admin,
        errors: [], // Or req.flash('validation_errors')
        name: '', // Or req.flash('name')
        description: '' // Or req.flash('description')
    };
    res.render('layouts/admin_layout', {
        title: 'Add New Course',
        bodyView: 'pages/admin/courses/add',
        admin: req.admin,
        viewData: viewData
    });
};
const addCourse = [
    body('name').trim().notEmpty().withMessage('Course name is required.').isLength({ min: 3 }).withMessage('Course name must be at least 3 characters long.'),
    body('description').trim().optional({ checkFalsy: true }),
    async (req, res) => {
        const errors = validationResult(req);
        const { name, description } = req.body;
        if (!errors.isEmpty()) {
            req.flash('validation_errors', JSON.stringify(errors.array()));
            req.flash('name', name);
            req.flash('description', description);
            return res.redirect('/admin/courses/add'); // Redirect to GET which handles layout
        }
        try {
            const result = await db.runAsync("INSERT INTO courses (name, description, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [name, description]);
            logAdminAction(req.admin.id, 'COURSE_CREATED', `Admin ${req.admin.name} created course: ${name} (ID: ${result.lastID})`, 'course', result.lastID, req.ip);
            req.flash('success_msg', `✨ Success! ✨ Course "${name}" added successfully! 🎉`);
            res.redirect('/admin/courses');
        } catch (err) {
            console.error("Error adding course:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to add course. ${err.message} 😔`);
            res.redirect('/admin/courses/add');
        }
    }
];
const renderEditCourseForm = async (req, res) => {
    try {
        const course = await db.getAsync("SELECT * FROM courses WHERE id = ?", [req.params.id]);
        if (!course) {
            req.flash('error_msg', '⚠️ Course not found.');
            return res.redirect('/admin/courses');
        }
        res.render('pages/admin/courses/edit', { title: 'Edit Course', admin: req.admin, course, errors: [] });
    } catch (err) {
        console.error("Error fetching course for edit:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load course details. ${err.message} 😔`);
        res.redirect('/admin/courses');
    }
};
const updateCourse = [
    body('name').trim().notEmpty().withMessage('Course name is required.').isLength({ min: 3 }).withMessage('Course name must be at least 3 characters long.'),
    body('description').trim().optional({ checkFalsy: true }),
    async (req, res) => {
        const courseId = req.params.id;
        const errors = validationResult(req);
        const { name, description } = req.body;
        if (!errors.isEmpty()) {
            const course = await db.getAsync("SELECT * FROM courses WHERE id = ?", [courseId]);
            return res.status(400).render('pages/admin/courses/edit', { title: 'Edit Course', admin: req.admin, errors: errors.array(), course: { ...course, name, description } });
        }
        try {
            const result = await db.runAsync("UPDATE courses SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [name, description, courseId]);
            if (result.changes === 0) {
                req.flash('error_msg', '⚠️ Course not found or no changes made.');
            } else {
                logAdminAction(req.admin.id, 'COURSE_UPDATED', `Admin ${req.admin.name} updated course: ${name} (ID: ${courseId})`, 'course', courseId, req.ip);
                req.flash('success_msg', `✨ Update Successful! ✨ Course "${name}" updated successfully! 🎉`);
            }
            res.redirect('/admin/courses');
        } catch (err) {
            console.error("Error updating course:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to update course. ${err.message} 😔`);
            res.redirect(`/admin/courses/edit/${courseId}`);
        }
    }
];
const deleteCourse = async (req, res) => {
    try {
        const courseId = req.params.id;
        const enrollment = await db.getAsync("SELECT COUNT(id) as count FROM enrollments WHERE course_id = ?", [courseId]);
        if (enrollment && enrollment.count > 0) {
            req.flash('error_msg', `⚠️ Cannot delete course. It has ${enrollment.count} active student enrollment(s). Please remove enrollments first.`);
            return res.redirect('/admin/courses');
        }
        const result = await db.runAsync("DELETE FROM courses WHERE id = ?", [courseId]);
        if (result.changes === 0) {
            req.flash('error_msg', '⚠️ Course not found.');
        } else {
            logAdminAction(req.admin.id, 'COURSE_DELETED', `Admin ${req.admin.name} deleted course ID: ${courseId}`, 'course', courseId, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Course deleted successfully! 🎉');
        }
        res.redirect('/admin/courses');
    } catch (err) {
        console.error("Error deleting course:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to delete course. ${err.message} 😔`);
        res.redirect('/admin/courses');
    }
};

// ... (Student Management, Academic Management, Fee Management, etc. with updated flash messages) ...

const listStudents = async (req, res) => {
    try {
        // Added second_name, surname, enrolled_date to the SELECT query
        const students = await db.allAsync("SELECT id, registration_number, first_name, second_name, surname, email, enrolled_date, created_at, last_login_at, is_active FROM students ORDER BY created_at DESC");
        const viewData = {
            title: 'Manage Students',
            admin: req.admin,
            students: students
        };
        res.render('layouts/admin_layout', {
            title: 'Manage Students', // For <title> tag
            bodyView: 'pages/admin/students/index',
            admin: req.admin,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching students:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t retrieve student list. ${err.message} 😔`);
        // Render with error state within layout
        const errorViewData = {
            title: 'Manage Students - Error',
            admin: req.admin,
            students: [],
            errorLoading: true,
            errorMessage: err.message
        };
        res.status(500).render('layouts/admin_layout', {
            title: 'Error Loading Students',
            bodyView: 'pages/admin/students/index',
            admin: req.admin,
            viewData: errorViewData
        });
    }
};

const viewStudentDetails = async (req, res) => {
    const studentId = req.params.id;
    try {
        const student = await db.getAsync("SELECT * FROM students WHERE id = ?", [studentId]);
        if (!student) {
            req.flash('error_msg', '⚠️ Student not found.');
            return res.redirect('/admin/students');
        }
        const enrollments = await db.allAsync(`SELECT e.id as enrollment_id, c.name as course_name, e.enrollment_date, e.coursework_marks, e.main_exam_marks, e.final_grade FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.student_id = ? ORDER BY c.name`, [studentId]);
        const fees = await db.allAsync(`SELECT id, description, total_amount, amount_paid, (total_amount - amount_paid) as balance, payment_date, payment_method, notes, logged_by_admin_id, created_at FROM fees WHERE student_id = ? ORDER BY payment_date DESC, created_at DESC`, [studentId]);
        let totalCharged = 0; let totalPaid = 0;
        fees.forEach(fee => { totalCharged += fee.total_amount || 0; totalPaid += fee.amount_paid || 0; });
        const overallBalance = totalCharged - totalPaid;

        const studentFullName = `${student.first_name || ''} ${student.second_name || ''} ${student.surname || ''}`.replace(/\s+/g, ' ').trim();
        const pageTitle = `Details for ${studentFullName}`;

        const viewData = {
            title: pageTitle,
            admin: req.admin,
            student,
            enrollments: enrollments || [],
            fees: fees || [],
            overallBalance
        };
        res.render('layouts/admin_layout', {
            title: pageTitle, // For <title> tag
            bodyView: 'pages/admin/students/view',
            admin: req.admin,
            viewData: viewData
        });

    } catch (err) {
        console.error("Error fetching student details:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load student details. ${err.message} 😔`);
        // Attempt to render the page with an error state within the layout
        const errorViewData = {
            title: 'View Student Details - Error',
            admin: req.admin,
            student: null, // Or a placeholder student object
            enrollments: [],
            fees: [],
            overallBalance: 0,
            errorLoading: true,
            errorMessage: err.message
        };
        res.status(500).render('layouts/admin_layout', {
            title: 'Error Loading Student Details',
            bodyView: 'pages/admin/students/view',
            admin: req.admin,
            viewData: errorViewData
        });
    }
};
const renderEditStudentForm = async (req, res) => {
    try {
        const student = await db.getAsync("SELECT * FROM students WHERE id = ?", [req.params.id]);
        if (!student) {
            req.flash('error_msg', '⚠️ Student not found.');
            return res.redirect('/admin/students');
        }
        // Ensure enrolled_date is formatted for the date input field
        const formattedEnrolledDate = student.enrolled_date ? new Date(student.enrolled_date).toISOString().split('T')[0] : '';

        const viewData = {
            title: `Edit Student: ${student.first_name} ${student.surname || ''}`,
            admin: req.admin,
            student: { // Pass all student fields, including new ones
                ...student,
                enrolled_date_formatted: formattedEnrolledDate
            },
            errors: JSON.parse(req.flash('validation_errors')[0] || '[]'),
            // Pre-fill with flashed old input if available, otherwise use student data
            oldInput: {
                firstName: req.flash('firstName')[0] || student.first_name,
                secondName: req.flash('secondName')[0] || student.second_name,
                surname: req.flash('surname')[0] || student.surname,
                email: req.flash('email')[0] || student.email,
                enrolledDate: req.flash('enrolledDate')[0] || formattedEnrolledDate,
                courseFee: req.flash('courseFee')[0] || (student.course_fee !== null ? student.course_fee.toString() : '')
            }
        };
        res.render('layouts/admin_layout', {
            title: `Edit Student: ${student.first_name}`, // For <title> tag
            bodyView: 'pages/admin/students/edit',
            admin: req.admin,
            viewData: viewData
        });
    } catch (err) {
        console.error("Error fetching student for edit:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load student details for editing. ${err.message} 😔`);
        // Attempt to render with error state
        const errorViewData = {
            title: 'Edit Student - Error',
            admin: req.admin,
            student: null,
            errors: [{msg: `Error loading student data: ${err.message}`}],
            oldInput: {}
        };
         res.status(500).render('layouts/admin_layout', {
            title: 'Error Editing Student',
            bodyView: 'pages/admin/students/edit',
            admin: req.admin,
            viewData: errorViewData
        });
    }
};
const updateStudent = [
    body('firstName').trim().notEmpty().withMessage('First Name is required.'),
    body('email').trim().isEmail().withMessage('A valid Email is required.'),
    body('secondName').trim().optional({ checkFalsy: true }),
    body('surname').trim().optional({ checkFalsy: true }),
    body('enrolledDate').isISO8601().toDate().withMessage('A valid Enrolled Date is required.'),
    body('courseFee').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Course Fee must be a non-negative number.'),

    async (req, res) => {
        const studentId = req.params.id;
        const errors = validationResult(req);
        const { firstName, secondName, surname, email, enrolledDate, courseFee } = req.body;

        if (!errors.isEmpty()) {
            req.flash('validation_errors', JSON.stringify(errors.array()));
            req.flash('firstName', firstName);
            req.flash('secondName', secondName);
            req.flash('surname', surname);
            req.flash('email', email);
            req.flash('enrolledDate', enrolledDate);
            req.flash('courseFee', courseFee);
            return res.redirect(`/admin/students/edit/${studentId}`);
        }

        try {
            const studentForForm = await db.getAsync("SELECT * FROM students WHERE id = ?", [studentId]);
            if (!studentForForm) {
                req.flash('error_msg', '⚠️ Student not found.');
                return res.redirect('/admin/students');
            }

            if (email.toLowerCase() !== studentForForm.email.toLowerCase()) {
                const existingEmailStudent = await db.getAsync("SELECT id FROM students WHERE email = ? AND id != ?", [email.toLowerCase(), studentId]);
                if (existingEmailStudent) {
                    req.flash('validation_errors', JSON.stringify([{ param: 'email', msg: 'This email address is already in use by another student.' }]));
                    req.flash('firstName', firstName);
                    req.flash('secondName', secondName);
                    req.flash('surname', surname);
                    req.flash('email', email); // Keep attempted email
                    req.flash('enrolledDate', enrolledDate);
                    req.flash('courseFee', courseFee);
                    return res.redirect(`/admin/students/edit/${studentId}`);
                }
            }

            const sql = `UPDATE students SET
                            first_name = ?, second_name = ?, surname = ?, email = ?,
                            enrolled_date = ?, course_fee = ?, updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`;
            const params = [
                firstName, secondName || null, surname || null, email.toLowerCase(),
                enrolledDate, courseFee ? parseFloat(courseFee) : null,
                studentId
            ];
            await db.runAsync(sql, params);

            const studentFullName = `${firstName} ${secondName || ''} ${surname || ''}`.replace(/\s+/g, ' ').trim();
            logAdminAction(req.admin.id, 'STUDENT_UPDATED', `Admin ${req.admin.name} updated details for student: ${studentFullName} (ID: ${studentId})`, 'student', studentId, req.ip);
            req.flash('success_msg', '✨ Update Successful! ✨ Student details updated successfully! 🎉');
            res.redirect(`/admin/students/view/${studentId}`);
        } catch (err) {
            console.error("Error updating student:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to update student details. ${err.message} 😔`);
            res.redirect(`/admin/students/edit/${studentId}`);
        }
    }
];
const toggleStudentStatus = async (req, res) => {
    try {
        const student = await db.getAsync("SELECT id, first_name, is_active FROM students WHERE id = ?", [req.params.id]);
        if (!student) {
            req.flash('error_msg', '⚠️ Student not found.');
            return res.redirect('/admin/students');
        }
        const newStatus = !student.is_active;
        await db.runAsync("UPDATE students SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, req.params.id]);
        const action = newStatus ? 'ACTIVATED' : 'DEACTIVATED';
        logAdminAction(req.admin.id, `STUDENT_${action}`, `Admin ${req.admin.name} ${action.toLowerCase()} student: ${student.first_name} (ID: ${req.params.id})`, 'student', req.params.id, req.ip);
        req.flash('success_msg', `✨ Update Successful! ✨ Student account ${student.first_name} has been ${action.toLowerCase()}. 🎉`);
        res.redirect(`/admin/students/view/${req.params.id}`);
    } catch (err) {
        console.error("Error toggling student status:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to update student status. ${err.message} 😔`);
        res.redirect('/admin/students');
    }
};
const renderManageStudentEnrollments = async (req, res) => {
    try {
        const student = await db.getAsync("SELECT id, first_name, registration_number FROM students WHERE id = ?", [req.params.studentId]);
        if (!student) { req.flash('error_msg', '⚠️ Student not found.'); return res.redirect('/admin/students'); }
        const currentEnrollments = await db.allAsync(`SELECT e.id, e.enrollment_date, e.final_grade, c.name as course_name FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE e.student_id = ? ORDER BY c.name`, [req.params.studentId]);
        const availableCourses = await db.allAsync(`SELECT id, name FROM courses WHERE id NOT IN (SELECT course_id FROM enrollments WHERE student_id = ?) ORDER BY name`, [req.params.studentId]);
        res.render('pages/admin/students/enrollments', { title: `Manage Enrollments for ${student.first_name}`, admin: req.admin, student, currentEnrollments, availableCourses });
    } catch (err) {
        console.error("Error fetching data for student enrollments page:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load enrollment management page. ${err.message} 😔`);
        res.redirect(`/admin/students/view/${req.params.studentId}`);
    }
};
const enrollStudentInCourse = async (req, res) => {
    const { studentId } = req.params;
    const { courseId } = req.body;
    if (!courseId) { req.flash('error_msg', '⚠️ Please select a course to enroll.'); return res.redirect(`/admin/students/${studentId}/enrollments`);}
    try {
        const student = await db.getAsync("SELECT id, first_name FROM students WHERE id = ?", [studentId]);
        const course = await db.getAsync("SELECT id, name FROM courses WHERE id = ?", [courseId]);
        if (!student || !course) { req.flash('error_msg', '⚠️ Student or Course not found.'); return res.redirect(student ? `/admin/students/${studentId}/enrollments` : '/admin/students'); }
        const existingEnrollment = await db.getAsync("SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?", [studentId, courseId]);
        if (existingEnrollment) { req.flash('error_msg', `⚠️ Student ${student.first_name} is already enrolled in ${course.name}.`); return res.redirect(`/admin/students/${studentId}/enrollments`); }

        await db.runAsync("INSERT INTO enrollments (student_id, course_id, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [studentId, courseId]);
        logAdminAction(req.admin.id, 'STUDENT_ENROLLED', `Admin ${req.admin.name} enrolled student ${student.first_name} (ID: ${studentId}) in course ${course.name} (ID: ${courseId})`, 'enrollment', null, req.ip);
        req.flash('success_msg', `✨ Success! ✨ Student ${student.first_name} successfully enrolled in ${course.name}. 🎉`);
        res.redirect(`/admin/students/${studentId}/enrollments`);
    } catch (err) {
        console.error("Error enrolling student in course:", err);
        if (err.message.includes("UNIQUE constraint failed")) {
            req.flash('error_msg', `⚠️ Student is already enrolled in this course.`);
        } else {
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to enroll student in course. ${err.message} 😔`);
        }
        res.redirect(`/admin/students/${studentId}/enrollments`);
    }
};
const removeStudentFromCourse = async (req, res) => {
    const { enrollmentId } = req.params;
    const { studentId } = req.body;
    if (!studentId) { req.flash('error_msg', '⚠️ Student identifier missing.'); return res.redirect('/admin/students'); }
    try {
        const enrollment = await db.getAsync("SELECT e.id, s.first_name as student_name, c.name as course_name FROM enrollments e JOIN students s ON e.student_id = s.id JOIN courses c ON e.course_id = c.id WHERE e.id = ?", [enrollmentId]);
        if (!enrollment) { req.flash('error_msg', '⚠️ Enrollment record not found.'); return res.redirect(`/admin/students/${studentId}/enrollments`); }

        await db.runAsync("DELETE FROM enrollments WHERE id = ?", [enrollmentId]);
        logAdminAction(req.admin.id, 'STUDENT_UNENROLLED', `Admin ${req.admin.name} unenrolled student ${enrollment.student_name} from course ${enrollment.course_name} (Enrollment ID: ${enrollmentId})`, 'enrollment', enrollmentId, req.ip);
        req.flash('success_msg', `✨ Success! ✨ Student ${enrollment.student_name} successfully unenrolled from ${enrollment.course_name}. 🎉`);
        res.redirect(`/admin/students/${studentId}/enrollments`);
    } catch (err) {
        console.error("Error removing student from course:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to unenroll student. ${err.message} 😔`);
        res.redirect(`/admin/students/${studentId}/enrollments`);
    }
};
const renderEnterMarksForm = async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const enrollment = await db.getAsync("SELECT * FROM enrollments WHERE id = ?", [enrollmentId]);
        if (!enrollment) { req.flash('error_msg', '⚠️ Enrollment record not found.'); return res.redirect('/admin/students'); }
        const student = await db.getAsync("SELECT id, first_name, registration_number FROM students WHERE id = ?", [enrollment.student_id]);
        const course = await db.getAsync("SELECT id, name FROM courses WHERE id = ?", [enrollment.course_id]);
        if (!student || !course) { req.flash('error_msg', '⚠️ Student or Course for enrollment not found.'); return res.redirect('/admin/students'); }
        res.render('pages/admin/academics/marks', { title: `Marks for ${student.first_name} - ${course.name}`, admin: req.admin, enrollment, student, course, coursework_marks: enrollment.coursework_marks, main_exam_marks: enrollment.main_exam_marks, PASSING_GRADE: parseInt(process.env.PASSING_GRADE) || 60 });
    } catch (err) {
        console.error("Error fetching data for marks entry form:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load marks entry page. ${err.message} 😔`);
        const tempEnrollment = await db.getAsync("SELECT student_id FROM enrollments WHERE id = ?", [req.params.enrollmentId]).catch(() => null);
        if (tempEnrollment && tempEnrollment.student_id) return res.redirect(`/admin/students/${tempEnrollment.student_id}/enrollments`);
        res.redirect('/admin/students');
    }
};
const saveMarks = [
    body('coursework_marks').optional({ checkFalsy: true }).isInt({ min: 0, max: 100 }).withMessage('Coursework marks must be between 0 and 100.'),
    body('main_exam_marks').optional({ checkFalsy: true }).isInt({ min: 0, max: 100 }).withMessage('Main exam marks must be between 0 and 100.'),
    async (req, res) => {
        const { enrollmentId } = req.params;
        const errors = validationResult(req);
        let enrollmentForForm, studentForForm, courseForForm;
        try { // Encapsulate pre-fetch in try-catch
            enrollmentForForm = await db.getAsync("SELECT * FROM enrollments WHERE id = ?", [enrollmentId]);
            if (enrollmentForForm) {
                studentForForm = await db.getAsync("SELECT id, first_name FROM students WHERE id = ?", [enrollmentForForm.student_id]);
                courseForForm = await db.getAsync("SELECT id, name FROM courses WHERE id = ?", [enrollmentForForm.course_id]);
            }
            if (!enrollmentForForm || !studentForForm || !courseForForm) { // Check all are found
                req.flash('error_msg', '⚠️ Enrollment, Student, or Course details not found.');
                return res.redirect('/admin/students');
            }
        } catch (fetchErr) {
            console.error("Error fetching details for saveMarks error rendering:", fetchErr);
            req.flash('error_msg', `⚠️ Failed to Load Data! An error occurred fetching enrollment details. ${fetchErr.message} 😔`);
            return res.redirect('/admin/students');
        }
        if (!errors.isEmpty()) {
            return res.status(400).render('pages/admin/academics/marks', { title: `Marks for ${studentForForm.first_name} - ${courseForForm.name}`, admin: req.admin, enrollment: enrollmentForForm, student: studentForForm, course: courseForForm, errors: errors.array(), coursework_marks: req.body.coursework_marks, main_exam_marks: req.body.main_exam_marks, PASSING_GRADE: parseInt(process.env.PASSING_GRADE) || 60 });
        }
        const coursework_marks = req.body.coursework_marks ? parseInt(req.body.coursework_marks, 10) : null;
        const main_exam_marks = req.body.main_exam_marks ? parseInt(req.body.main_exam_marks, 10) : null;
        let final_grade = null;
        if (coursework_marks !== null && main_exam_marks !== null) {
            const totalScore = (coursework_marks * 0.3) + (main_exam_marks * 0.7);
            const passingGrade = parseInt(process.env.PASSING_GRADE) || 60;
            final_grade = totalScore >= passingGrade ? 'Pass' : 'Fail';
        }
        try {
            await db.runAsync(`UPDATE enrollments SET coursework_marks = ?, main_exam_marks = ?, final_grade = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [coursework_marks, main_exam_marks, final_grade, enrollmentId]);
            logAdminAction(req.admin.id, 'MARKS_UPDATED', `Admin ${req.admin.name} updated marks for enrollment ID: ${enrollmentId}. CW: ${coursework_marks}, Exam: ${main_exam_marks}, Grade: ${final_grade}`, 'enrollment', enrollmentId, req.ip);
            req.flash('success_msg', '✨ Update Successful! ✨ Marks and final grade updated successfully! 🎉');
            res.redirect(`/admin/enrollments/${enrollmentId}/marks`);
        } catch (err) {
            console.error("Error saving marks:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to save marks. ${err.message} 😔`);
            res.redirect(`/admin/enrollments/${enrollmentId}/marks`);
        }
    }
];
const renderLogFeeForm = async (req, res) => {
    try {
        const student = await db.getAsync("SELECT id, first_name, registration_number FROM students WHERE id = ?", [req.params.studentId]);
        if (!student) { req.flash('error_msg', '⚠️ Student not found.'); return res.redirect('/admin/students'); }
        res.render('pages/admin/fees/log', { title: `Log Fee for ${student.first_name}`, admin: req.admin, student, description: '', total_amount: '0.00', amount_paid: '0.00', payment_date: new Date().toISOString().split('T')[0], payment_method: '', notes: '' });
    } catch (err) {
        console.error("Error fetching student for fee log form:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load fee logging page. ${err.message} 😔`);
        res.redirect('/admin/students');
    }
};
const saveFeeEntry = [
    body('description').trim().notEmpty().withMessage('Description is required.'),
    body('total_amount').isFloat({ min: 0 }).withMessage('Charge amount must be a valid number (0 or more).'),
    body('amount_paid').isFloat({ min: 0 }).withMessage('Payment amount must be a valid number (0 or more).'),
    body('payment_date').isISO8601().toDate().withMessage('Valid payment date is required.'),
    body('payment_method').trim().optional({ checkFalsy: true }),
    body('notes').trim().optional({ checkFalsy: true }),
    async (req, res) => {
        const { studentId } = req.params;
        const errors = validationResult(req);
        const { description, total_amount, amount_paid, payment_date, payment_method, notes } = req.body;
        const student = await db.getAsync("SELECT id, first_name FROM students WHERE id = ?", [studentId]);
        if (!student) { req.flash('error_msg', '⚠️ Student not found.'); return res.redirect('/admin/students'); }
        if (!errors.isEmpty()) {
            return res.status(400).render('pages/admin/fees/log', { title: `Log Fee for ${student.first_name}`, admin: req.admin, student, errors: errors.array(), description, total_amount, amount_paid, payment_date, payment_method, notes });
        }
        const chargeAmount = parseFloat(total_amount); const paidAmount = parseFloat(amount_paid);
        if (chargeAmount === 0 && paidAmount === 0) {
             req.flash('error_msg', '⚠️ Either Charge Amount or Payment Amount must be greater than 0.');
             return res.status(400).render('pages/admin/fees/log', { title: `Log Fee for ${student.first_name}`, admin: req.admin, student, description, total_amount, amount_paid, payment_date, payment_method, notes, errors: [{msg: 'Either Charge Amount or Payment Amount must be greater than 0.'}] });
        }
        try {
            await db.runAsync(`INSERT INTO fees (student_id, description, total_amount, amount_paid, payment_date, payment_method, notes, logged_by_admin_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [studentId, description, chargeAmount, paidAmount, payment_date, payment_method || null, notes || null, req.admin.id]);
            logAdminAction(req.admin.id, 'FEE_LOGGED', `Admin ${req.admin.name} logged fee entry for ${student.first_name} (ID: ${studentId}). Desc: ${description}, Charge: ${chargeAmount}, Paid: ${paidAmount}`, 'fee', null, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Fee entry logged successfully! 🎉');
            res.redirect(`/admin/students/${studentId}/fees/log`);
        } catch (err) {
            console.error("Error logging fee entry:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to log fee entry. ${err.message} 😔`);
            res.redirect(`/admin/students/${studentId}/fees/log`);
        }
    }
];
const listNotifications = async (req, res) => {
    try {
        const notifications = await db.allAsync("SELECT * FROM notifications ORDER BY created_at DESC");
        res.render('pages/admin/notifications/index', { title: 'Manage Notifications', admin: req.admin, notifications });
    } catch (err) {
        console.error("Error fetching notifications:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t retrieve notifications. 😔`);
        res.redirect('/admin/dashboard');
    }
};
const renderCreateNotificationForm = async (req, res) => {
    let students = [], courses = [];
    try {
        students = await db.allAsync("SELECT id, first_name, registration_number FROM students WHERE is_active = TRUE ORDER BY first_name");
        courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name");
    } catch (err) {
        console.error("Error fetching students/courses for notification form:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load necessary data for the form. ${err.message} 😔`);
    }
    res.render('pages/admin/notifications/form', {
        title: 'Create Notification', admin: req.admin, errors: [],
        title_val: '', message_val: '', target_audience_type: 'all',
        students, courses,
        target_audience_identifier_student: '', target_audience_identifier_course: ''
    });
};
const createNotification = [
    body('title').trim().notEmpty().withMessage('Title is required.'),
    body('message').trim().notEmpty().withMessage('Message is required.'),
    body('target_audience_type').isIn(['all', 'student_id', 'course_id']).withMessage('Invalid target audience type.'),
    body('target_audience_identifier_student').if(body('target_audience_type').equals('student_id')).notEmpty().withMessage('Student selection is required.').isNumeric().withMessage('Student ID must be numeric.'),
    body('target_audience_identifier_course').if(body('target_audience_type').equals('course_id')).notEmpty().withMessage('Course selection is required.').isNumeric().withMessage('Course ID must be numeric.'),
    async (req, res) => {
        const errors = validationResult(req);
        const { title, message, target_audience_type, target_audience_identifier_student, target_audience_identifier_course } = req.body;
        let finalTargetIdentifier = null;
        if (target_audience_type === 'student_id') finalTargetIdentifier = target_audience_identifier_student;
        else if (target_audience_type === 'course_id') finalTargetIdentifier = target_audience_identifier_course;

        if (!errors.isEmpty()) {
            let students = [], courses = [];
            try {
                students = await db.allAsync("SELECT id, first_name, registration_number FROM students WHERE is_active = TRUE ORDER BY first_name");
                courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name");
            } catch (err) { console.error("Error fetching for error render:", err); }
            return res.status(400).render('pages/admin/notifications/form', { title: 'Create Notification', admin: req.admin, errors: errors.array(), title_val: title, message_val: message, target_audience_type, target_audience_identifier: finalTargetIdentifier, students, courses, target_audience_identifier_student, target_audience_identifier_course });
        }
        try {
            if (target_audience_type === 'student_id' && finalTargetIdentifier) { const studentExists = await db.getAsync("SELECT id FROM students WHERE id = ?", [finalTargetIdentifier]); if (!studentExists) throw new Error(`⚠️ Student with ID ${finalTargetIdentifier} not found.`); }
            if (target_audience_type === 'course_id' && finalTargetIdentifier) { const courseExists = await db.getAsync("SELECT id FROM courses WHERE id = ?", [finalTargetIdentifier]); if (!courseExists) throw new Error(`⚠️ Course with ID ${finalTargetIdentifier} not found.`); }
            const result = await db.runAsync( `INSERT INTO notifications (title, message, target_audience_type, target_audience_identifier, created_by_admin_id) VALUES (?, ?, ?, ?, ?)`, [title, message, target_audience_type, (target_audience_type === 'all' ? null : finalTargetIdentifier), req.admin.id] );
            logAdminAction(req.admin.id, 'NOTIFICATION_CREATED', `Admin ${req.admin.name} created notification: ${title}`, 'notification', result.lastID, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Notification created successfully! 🎉');
            res.redirect('/admin/notifications');
        } catch (err) {
            console.error("Error creating notification:", err);
            const specificError = err.message.startsWith("⚠️") ? err.message : `❌ Operation Failed! ❌ Failed to create notification. ${err.message} 😔`;
            req.flash('error_msg', specificError);
            res.redirect('/admin/notifications/create');
        }
    }
];
const deleteNotification = async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM notifications WHERE id = ?", [req.params.id]);
        if (result.changes === 0) {
            req.flash('error_msg', '⚠️ Notification not found.');
        } else {
            logAdminAction(req.admin.id, 'NOTIFICATION_DELETED', `Admin ${req.admin.name} deleted notification ID: ${req.params.id}`, 'notification', req.params.id, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Notification deleted successfully! 🎉');
        }
        res.redirect('/admin/notifications');
    } catch (err) {
        console.error("Error deleting notification:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to delete notification. ${err.message} 😔`);
        res.redirect('/admin/notifications');
    }
};
const listResources = async (req, res) => {
    try {
        const resources = await db.allAsync(`SELECT sr.*, c.name as course_name FROM study_resources sr LEFT JOIN courses c ON sr.course_id = c.id ORDER BY sr.created_at DESC`);
        res.render('pages/admin/resources/index', { title: 'Manage Study Resources', admin: req.admin, resources });
    } catch (err) {
        console.error("Error fetching study resources:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load study resources. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
    }
};
const renderCreateResourceForm = async (req, res) => {
    try {
        const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name");
        res.render('pages/admin/resources/add', { title: 'Add Study Resource', admin: req.admin, courses, errors: [], title_val: '', description_val: '', resource_url_val: '', course_id_val: null });
    } catch (err) {
        console.error("Error fetching courses for resource form:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load data for the resource form. ${err.message} 😔`);
        res.redirect('/admin/study-resources');
    }
};
const createResource = [
    body('title').trim().notEmpty().withMessage('Resource title is required.'),
    body('resource_url').trim().notEmpty().withMessage('Resource URL is required.').isURL().withMessage('Must be a valid URL.'),
    body('description').trim().optional({ checkFalsy: true }),
    body('course_id').trim().optional({ checkFalsy: true }).isInt().withMessage('Invalid course selection.'),
    async (req, res) => {
        const errors = validationResult(req);
        const { title, description, resource_url, course_id } = req.body;
        if (!errors.isEmpty()) {
            const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name").catch(() => []);
            return res.status(400).render('pages/admin/resources/add', { title: 'Add Study Resource', admin: req.admin, courses, errors: errors.array(), title_val: title, description_val: description, resource_url_val: resource_url, course_id_val: course_id });
        }
        try {
            const finalCourseId = course_id ? parseInt(course_id, 10) : null;
            if (finalCourseId) {
                const courseExists = await db.getAsync("SELECT id FROM courses WHERE id = ?", [finalCourseId]);
                if (!courseExists) throw new Error('⚠️ Selected course not found.');
            }
            const result = await db.runAsync( `INSERT INTO study_resources (title, description, resource_url, course_id, uploaded_by_admin_id, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [title, description, resource_url, finalCourseId, req.admin.id] );
            logAdminAction(req.admin.id, 'RESOURCE_CREATED', `Admin ${req.admin.name} created study resource: ${title}`, 'study_resource', result.lastID, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Study resource added successfully! 🎉');
            res.redirect('/admin/study-resources');
        } catch (err) {
            console.error("Error adding study resource:", err);
            const specificError = err.message.startsWith("⚠️") ? err.message : `❌ Operation Failed! ❌ Failed to add study resource. ${err.message} 😔`;
            req.flash('error_msg', specificError);
            const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name").catch(() => []); // Refetch for form
            res.status(400).render('pages/admin/resources/add', { title: 'Add Study Resource', admin: req.admin, courses, errors: [{msg: specificError}], title_val: title, description_val: description, resource_url_val: resource_url, course_id_val: course_id });
        }
    }
];
const renderEditResourceForm = async (req, res) => {
    try {
        const resource = await db.getAsync("SELECT * FROM study_resources WHERE id = ?", [req.params.id]);
        if (!resource) {
            req.flash('error_msg', '⚠️ Study resource not found.');
            return res.redirect('/admin/study-resources');
        }
        const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name");
        res.render('pages/admin/resources/edit', { title: 'Edit Study Resource', admin: req.admin, resource, courses, errors: [] });
    } catch (err) {
        console.error("Error fetching resource for edit:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load resource details for editing. ${err.message} 😔`);
        res.redirect('/admin/study-resources');
    }
};
const updateResource = [
    body('title').trim().notEmpty().withMessage('Resource title is required.'),
    body('resource_url').trim().notEmpty().withMessage('Resource URL is required.').isURL().withMessage('Must be a valid URL.'),
    body('description').trim().optional({ checkFalsy: true }),
    body('course_id').trim().optional({ checkFalsy: true }).isInt().withMessage('Invalid course selection.'),
    async (req, res) => {
        const resourceId = req.params.id;
        const errors = validationResult(req);
        const { title, description, resource_url, course_id } = req.body;
        if (!errors.isEmpty()) {
            const resource = await db.getAsync("SELECT * FROM study_resources WHERE id = ?", [resourceId]).catch(() => ({id: resourceId}));
            const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name").catch(() => []);
            return res.status(400).render('pages/admin/resources/edit', { title: 'Edit Study Resource', admin: req.admin, resource: { ...resource, title, description, resource_url, course_id }, courses, errors: errors.array() });
        }
        try {
            const finalCourseId = course_id ? parseInt(course_id, 10) : null;
             if (finalCourseId) {
                const courseExists = await db.getAsync("SELECT id FROM courses WHERE id = ?", [finalCourseId]);
                if (!courseExists) throw new Error('⚠️ Selected course not found.');
            }
            const result = await db.runAsync( `UPDATE study_resources SET title = ?, description = ?, resource_url = ?, course_id = ?, uploaded_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [title, description, resource_url, finalCourseId, req.admin.id, resourceId] );
            if (result.changes === 0) {
                req.flash('error_msg', '⚠️ Study resource not found or no changes made.');
            } else {
                logAdminAction(req.admin.id, 'RESOURCE_UPDATED', `Admin ${req.admin.name} updated study resource: ${title}`, 'study_resource', resourceId, req.ip);
                req.flash('success_msg', '✨ Update Successful! ✨ Study resource updated successfully! 🎉');
            }
            res.redirect('/admin/study-resources');
        } catch (err) {
            console.error("Error updating study resource:", err);
            const specificError = err.message.startsWith("⚠️") ? err.message : `❌ Operation Failed! ❌ Failed to update study resource. ${err.message} 😔`;
            req.flash('error_msg', specificError);
            res.redirect(`/admin/study-resources/edit/${resourceId}`);
        }
    }
];
const deleteResource = async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM study_resources WHERE id = ?", [req.params.id]);
        if (result.changes === 0) {
            req.flash('error_msg', '⚠️ Study resource not found.');
        } else {
            logAdminAction(req.admin.id, 'RESOURCE_DELETED', `Admin ${req.admin.name} deleted study resource ID: ${req.params.id}`, 'study_resource', req.params.id, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Study resource deleted successfully! 🎉');
        }
        res.redirect('/admin/study-resources');
    } catch (err) {
        console.error("Error deleting study resource:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to delete study resource. ${err.message} 😔`);
        res.redirect('/admin/study-resources');
    }
};
const renderWifiSettingsForm = async (req, res) => {
    try {
        const settingKeys = ['wifi_ssid', 'wifi_password_plaintext', 'wifi_disclaimer'];
        const settingsData = await db.allAsync("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?)", settingKeys);
        const settings = {};
        settingsData.forEach(row => { settings[row.setting_key] = row.setting_value; });
        res.render('pages/admin/settings/wifi', { title: 'WiFi Settings Management', admin: req.admin, settings, errors: [] });
    } catch (err) {
        console.error("Error fetching wifi settings:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load WiFi settings. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
    }
};
const updateWifiSettings = [
    body('wifi_ssid').trim().notEmpty().withMessage('WiFi SSID is required.'),
    body('wifi_password').trim().optional({checkFalsy: true}).isLength({min:8}).withMessage('New WiFi password must be at least 8 characters if provided.'),
    body('wifi_disclaimer').trim().optional({checkFalsy: true}),
    async (req, res) => {
        const errors = validationResult(req);
        const { wifi_ssid, wifi_password, wifi_disclaimer } = req.body;
        if (!errors.isEmpty()) {
            const settingKeys = ['wifi_ssid', 'wifi_password_plaintext', 'wifi_disclaimer'];
            const settingsData = await db.allAsync("SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?)", settingKeys).catch(() => []);
            const currentSettings = {}; // Not strictly needed if just re-rendering with new inputs
            settingsData.forEach(row => { currentSettings[row.setting_key] = row.setting_value; });
            return res.status(400).render('pages/admin/settings/wifi', { title: 'WiFi Settings Management', admin: req.admin, settings: { wifi_ssid, wifi_disclaimer, wifi_password_plaintext: (wifi_password || currentSettings.wifi_password_plaintext) }, errors: errors.array() });
        }
        try {
            const upsertSetting = (key, value, desc, adminId) => db.runAsync( `INSERT INTO site_settings (setting_key, setting_value, description, updated_by_admin_id, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_by_admin_id = excluded.updated_by_admin_id, updated_at = CURRENT_TIMESTAMP`, [key, value, desc, adminId] );
            const updates = [];
            let updatedSettingsForLog = [];
            updates.push(upsertSetting('wifi_ssid', wifi_ssid, 'WiFi Network Name (SSID)', req.admin.id));
            updatedSettingsForLog.push('SSID');
            if (wifi_password) {
                updates.push(upsertSetting('wifi_password_plaintext', wifi_password, 'Plaintext WiFi Password (for student view)', req.admin.id));
                updatedSettingsForLog.push('Password');
            }
            updates.push(upsertSetting('wifi_disclaimer', wifi_disclaimer || '', 'WiFi Usage Disclaimer', req.admin.id));
            if (wifi_disclaimer || wifi_disclaimer === '') updatedSettingsForLog.push('Disclaimer'); // Check if it was actually changed
            await Promise.all(updates);
            logAdminAction(req.admin.id, 'WIFI_SETTINGS_UPDATED', `Admin ${req.admin.name} updated WiFi settings: ${updatedSettingsForLog.join(', ')}`, 'site_settings', null, req.ip);
            req.flash('success_msg', '✨ Update Successful! ✨ WiFi settings updated successfully! 🎉');
            res.redirect('/admin/settings/wifi');
        } catch (err) {
            console.error("Error updating WiFi settings:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to update WiFi settings. ${err.message} 😔`);
            res.redirect('/admin/settings/wifi');
        }
    }
];
const listDownloadableDocuments = async (req, res) => {
    try {
        const documents = await db.allAsync("SELECT * FROM downloadable_documents ORDER BY created_at DESC");
        res.render('pages/admin/documents/index', { title: 'Manage Downloadable Documents', admin: req.admin, documents });
    } catch (err) {
        console.error("Error fetching downloadable documents:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load document list. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
    }
};
const renderCreateDocumentForm = (req, res) => {
    res.render('pages/admin/documents/add', { title: 'Add Downloadable Document', admin: req.admin, errors: [], title_val: '', description_val: '', file_url_val: '', type_val: 'public', expiry_date_val: '' });
};
const createDocument = [
    body('title').trim().notEmpty().withMessage('Document title is required.'),
    body('file_url').trim().notEmpty().withMessage('File URL is required.').isURL().withMessage('Must be a valid URL.'),
    body('type').isIn(['public', 'eulogy']).withMessage('Invalid document type.'),
    body('description').trim().optional({ checkFalsy: true }),
    body('expiry_date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid expiry date format.'),
    async (req, res) => {
        const errors = validationResult(req);
        let { title, description, file_url, type, expiry_date } = req.body;
        if (!errors.isEmpty()) {
            return res.status(400).render('pages/admin/documents/add', { title: 'Add Downloadable Document', admin: req.admin, errors: errors.array(), title_val: title, description_val: description, file_url_val: file_url, type_val: type, expiry_date_val: expiry_date });
        }
        if (type === 'public') expiry_date = null;
        else if (type === 'eulogy' && !expiry_date) { let defaultExpiry = new Date(); defaultExpiry.setDate(defaultExpiry.getDate() + 7); expiry_date = defaultExpiry.toISOString().split('T')[0]; }
        try {
            const result = await db.runAsync( `INSERT INTO downloadable_documents (title, description, file_url, type, expiry_date, uploaded_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [title, description, file_url, type, expiry_date, req.admin.id] );
            logAdminAction(req.admin.id, 'DOCUMENT_CREATED', `Admin ${req.admin.name} added document: ${title}`, 'downloadable_document', result.lastID, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Document entry added successfully! 🎉');
            res.redirect('/admin/documents');
        } catch (err) {
            console.error("Error adding document entry:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to add document entry. ${err.message} 😔`);
            res.redirect('/admin/documents/add');
        }
    }
];
const renderEditDocumentForm = async (req, res) => {
    try {
        const document = await db.getAsync("SELECT * FROM downloadable_documents WHERE id = ?", [req.params.id]);
        if (!document) { req.flash('error_msg', '⚠️ Document entry not found.'); return res.redirect('/admin/documents');}
        if (document.expiry_date) document.expiry_date_formatted = new Date(document.expiry_date).toISOString().split('T')[0];
        res.render('pages/admin/documents/edit', { title: 'Edit Downloadable Document', admin: req.admin, document, errors: [] });
    } catch (err) {
        console.error("Error fetching document for edit:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load document details for editing. ${err.message} 😔`);
        res.redirect('/admin/documents');
    }
};
const updateDocument = [
    body('title').trim().notEmpty().withMessage('Document title is required.'),
    body('file_url').trim().notEmpty().withMessage('File URL is required.').isURL().withMessage('Must be a valid URL.'),
    body('type').isIn(['public', 'eulogy']).withMessage('Invalid document type.'),
    body('description').trim().optional({ checkFalsy: true }),
    body('expiry_date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Invalid expiry date format.'),
    async (req, res) => {
        const docId = req.params.id;
        const errors = validationResult(req);
        let { title, description, file_url, type, expiry_date } = req.body;
        if (!errors.isEmpty()) {
            const documentToReRender = await db.getAsync("SELECT * FROM downloadable_documents WHERE id = ?", [docId]).catch(()=> ({id: docId}));
             if (documentToReRender && documentToReRender.expiry_date) documentToReRender.expiry_date_formatted = new Date(documentToReRender.expiry_date).toISOString().split('T')[0];
            return res.status(400).render('pages/admin/documents/edit', { title: 'Edit Downloadable Document', admin: req.admin, document: { ...documentToReRender, title, description, file_url, type, expiry_date_formatted: expiry_date }, errors: errors.array() });
        }
        if (type === 'public') expiry_date = null;
        else if (type === 'eulogy' && !expiry_date) expiry_date = null;
        try {
            const result = await db.runAsync( `UPDATE downloadable_documents SET title = ?, description = ?, file_url = ?, type = ?, expiry_date = ?, uploaded_by_admin_id = ? WHERE id = ?`, [title, description, file_url, type, expiry_date, req.admin.id, docId] );
            if (result.changes === 0) {
                req.flash('error_msg', '⚠️ Document entry not found or no changes made.');
            } else {
                logAdminAction(req.admin.id, 'DOCUMENT_UPDATED', `Admin ${req.admin.name} updated document: ${title}`, 'downloadable_document', docId, req.ip);
                req.flash('success_msg', '✨ Update Successful! ✨ Document entry updated successfully! 🎉');
            }
            res.redirect('/admin/documents');
        } catch (err) {
            console.error("Error updating document entry:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to update document entry. ${err.message} 😔`);
            res.redirect(`/admin/documents/edit/${docId}`);
        }
    }
];
const deleteDocument = async (req, res) => {
    try {
        const result = await db.runAsync("DELETE FROM downloadable_documents WHERE id = ?", [req.params.id]);
        if (result.changes === 0) {
            req.flash('error_msg', '⚠️ Document entry not found.');
        } else {
            logAdminAction(req.admin.id, 'DOCUMENT_DELETED', `Admin ${req.admin.name} deleted document entry ID: ${req.params.id}`, 'downloadable_document', req.params.id, req.ip);
            req.flash('success_msg', '✨ Success! ✨ Document entry deleted successfully! 🎉');
        }
        res.redirect('/admin/documents');
    } catch (err) {
        console.error("Error deleting document entry:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to delete document entry. ${err.message} 😔`);
        res.redirect('/admin/documents');
    }
};
const adminResetStudentPassword = async (req, res) => {
    const studentId = req.params.studentId; // Correctly get studentId from params
    const adminPerformingAction = req.admin;
    try {
        const student = await db.getAsync("SELECT id, first_name, email FROM students WHERE id = ?", [studentId]);
        if (!student) { req.flash('error_msg', '⚠️ Student not found.'); return res.redirect('/admin/students'); }
        const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD;
        if (!defaultPassword) {
            console.error("CRITICAL: DEFAULT_STUDENT_PASSWORD is not set in .env for admin password reset.");
            req.flash('error_msg', '❌ Operation Failed! ❌ Server configuration error: Default student password not defined. 😔');
            return res.redirect(`/admin/students/view/${studentId}`);
        }
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        await db.runAsync( "UPDATE students SET password_hash = ?, requires_password_change = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [passwordHash, studentId] );
        logAdminAction( adminPerformingAction.id, 'STUDENT_PASSWORD_RESET_BY_ADMIN', `Admin ${adminPerformingAction.name} reset password for student ${student.first_name} (ID: ${studentId}) to default.`, 'student', studentId, req.ip );
        req.flash('success_msg', `✨ Update Successful! ✨ Password for student ${student.first_name} has been reset to the default. They will be required to change it on next login. 🎉`);
        res.redirect(`/admin/students/view/${studentId}`);
    } catch (err) {
        console.error("Error resetting student password by admin:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to reset student password. ${err.message} 😔`);
        res.redirect(`/admin/students/view/${studentId}`);
    }
};
const viewActionLogs = async (req, res) => {
    try {
        const logs = await db.allAsync("SELECT * FROM action_logs ORDER BY created_at DESC LIMIT 100");
        res.render('pages/admin/action-logs', { title: 'Admin Action Logs', admin: req.admin, logs });
    } catch (err) {
        console.error("Error fetching action logs:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load action logs. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
    }
};
const renderSendEmailForm = async (req, res) => {
    try {
        const students = await db.allAsync("SELECT id, first_name, email FROM students WHERE is_active = 1 ORDER BY first_name");
        const courses = await db.allAsync("SELECT id, name FROM courses ORDER BY name");
        res.render('pages/admin/emails/send', { title: 'Send Bulk Email', admin: req.admin, students, courses, errors: [], subject: '', message: '' });
    } catch (err) {
        console.error("Error loading send email form:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load the email form. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
    }
};
const sendBulkEmail = async (req, res) => {
    const { subject, message, recipients, recipient_type } = req.body;
    let valErrors = [];
    if (!subject || !message) { valErrors.push({ msg: '⚠️ Subject and message are required.' }); }
    if (!recipient_type) { valErrors.push({msg: '⚠️ Recipient type is required.'})}
    if (recipient_type !== 'all' && (!recipients || recipients.length === 0)) { valErrors.push({ msg: '⚠️ Please select at least one recipient or choose "All Students".' }); }

    if (valErrors.length > 0) {
        valErrors.forEach(err => req.flash('error_msg', err.msg));
        // To repopulate form, ideally we'd pass back subject, message, etc.
        // For simplicity with redirects, we'll just redirect. User loses input.
        return res.redirect('/admin/emails/send');
    }

    try {
        const { sendEmailWithTemplate } = require('../config/mailer');
        let emailList = [];
        if (recipient_type === 'all') {
            emailList = await db.allAsync("SELECT first_name, email FROM students WHERE is_active = 1");
        } else if (recipient_type === 'selected_students' && recipients) {
            const recipientIds = Array.isArray(recipients) ? recipients : [recipients];
            if (recipientIds.length > 0) {
                const placeholders = recipientIds.map(() => '?').join(',');
                emailList = await db.allAsync(`SELECT first_name, email FROM students WHERE id IN (${placeholders}) AND is_active = 1`, recipientIds);
            }
        } // Add other recipient types like 'course_id' if needed

        if (emailList.length === 0) {
            req.flash('info_msg', 'ℹ️ No recipients matched the criteria for sending emails.');
            return res.redirect('/admin/emails/send');
        }

        let successCount = 0;
        let failCount = 0;
        for (const student of emailList) {
            try {
                await sendEmailWithTemplate({
                    to: student.email, subject: subject, templateName: 'general-notification-email', // Ensure this template is generic enough
                    data: { studentName: student.first_name, notificationTitle: subject, notificationMessage: message },
                    replyTo: process.env.REPLY_TO_EMAIL
                });
                successCount++;
            } catch (emailErr) {
                console.error(`Failed to send email to ${student.email}:`, emailErr);
                failCount++;
            }
        }
        logAdminAction( req.admin.id, 'BULK_EMAIL_SENT', `Admin ${req.admin.name} attempted bulk email "${subject}". Success: ${successCount}, Failed: ${failCount}`, 'email', null, req.ip );

        if (successCount > 0 && failCount === 0) {
            req.flash('success_msg', `✅ Email Sent Successfully! 📩 ${successCount} emails are on their way! 🎉`);
        } else if (successCount > 0 && failCount > 0) {
            req.flash('success_msg', `✅ Email Sent Successfully! 📩 ${successCount} emails are on their way! 🎉`);
            req.flash('error_msg', `❌ Failed to Send Email ⚠️ However, ${failCount} emails failed to send. Check server logs.`);
        } else if (failCount > 0) {
            req.flash('error_msg', `❌ Failed to Send Email ⚠️ All ${failCount} emails failed to send. Check server logs.`);
        }
        res.redirect('/admin/emails/send');
    } catch (err) {
        console.error("Error sending bulk email:", err);
        req.flash('error_msg', `❌ Failed to Send Email ⚠️ Oops! Something went wrong during bulk send. ${err.message} 😔`);
        res.redirect('/admin/emails/send');
    }
};
const renderEmailTestPage = (req, res) => {
    res.render('pages/admin/emails/test', { title: 'Test Email Templates', admin: req.admin, errors: [], testEmail: req.admin.email });
};
const testEmailTemplate = async (req, res) => {
    const { template_type, test_email } = req.body;
    if (!template_type || !test_email) {
        req.flash('error_msg', '⚠️ Template type and test email are required.');
        return res.redirect('/admin/emails/test');
    }
    try {
        const { sendEmailWithTemplate } = require('../config/mailer');
        let templateData = {};
        let subject = '';
        let actualTemplateName = '';

        switch (template_type) {
            case 'otp-student':
                actualTemplateName = 'otp-email';
                templateData = { studentName: 'Test Student', otp: '123456', resetLink: `${process.env.FRONTEND_URL}/student/reset-password?token=test123` };
                subject = 'Test Student OTP Email';
                break;
            case 'otp-customer':
                actualTemplateName = 'customer-otp-email';
                templateData = { customerName: 'Test Customer', otp: '654321', resetLink: `${process.env.FRONTEND_URL}/customer/reset-password?token=testcust123` };
                subject = 'Test Customer OTP Email';
                break;
            case 'general-notification':
                actualTemplateName = 'general-notification-email';
                templateData = { studentName: 'Test User', notificationTitle: 'Test General Notification', notificationMessage: 'This is a test of the general notification email template.', actionLink: `${process.env.FRONTEND_URL}`, actionText: 'Visit Site' };
                subject = 'Test General Notification';
                break;
            case 'contact-form-submission':
                actualTemplateName = 'contact-form-submission';
                 templateData = { senderName: 'Test Sender', senderEmail: 'sender@example.com', emailSubject: 'Test Inquiry', emailMessage: 'This is a test message via contact form.', submissionDate: new Date().toLocaleString() };
                subject = 'Test Contact Form Submission Received';
                break;
            default:
                req.flash('error_msg', '⚠️ Invalid template type selected for test.');
                return res.redirect('/admin/emails/test');
        }
        await sendEmailWithTemplate({ to: test_email, subject: `${subject} - Twoem Online`, templateName: actualTemplateName, data: templateData, replyTo: process.env.REPLY_TO_EMAIL });
        logAdminAction(req.admin.id, 'EMAIL_TEST_SENT', `Admin ${req.admin.name} sent test email ('${template_type}') to ${test_email}`, 'email', null, req.ip);
        req.flash('success_msg', `✅ Email Sent Successfully! 📩 Test email for '${template_type}' sent to ${test_email}! 🎉`);
        res.redirect('/admin/emails/test');
    } catch (err) {
        console.error("Error sending test email:", err);
        req.flash('error_msg', `❌ Failed to Send Email ⚠️ Oops! Something went wrong. ${err.message} 😔`);
        res.redirect('/admin/emails/test');
    }
};
const viewEmailLogs = async (req, res) => {
    try {
        const emailLogs = await db.allAsync(`
            SELECT * FROM action_logs
            WHERE action_type IN ('BULK_EMAIL_SENT', 'EMAIL_TEST_SENT', 'PASSWORD_RESET_EMAIL_SENT', 'NOTIFICATION_EMAIL_SENT', 'PAYMENT_NOTIFICATION_ADMIN')
            ORDER BY created_at DESC
            LIMIT 100 `); // Added PAYMENT_NOTIFICATION_ADMIN
        res.render('pages/admin/emails/logs', { title: 'Email Logs', admin: req.admin, emailLogs });
    } catch (err) {
        console.error("Error fetching email logs:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load email logs. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
    }
};
const downloadDatabaseBackup = (req, res) => {
    const dbFilePath = path.resolve(__dirname, '../../../db/twoem_online.sqlite');
    const backupFilename = `twoem_online_backup_${new Date().toISOString().split('T')[0]}_${new Date().toLocaleTimeString().replace(/:/g, '-')}.sqlite`;
    if (fs.existsSync(dbFilePath)) {
        logAdminAction(req.admin.id, 'DB_BACKUP_DOWNLOADED', `Admin ${req.admin.name} downloaded database backup.`, 'database', null, req.ip);
        res.download(dbFilePath, backupFilename, (err) => {
            if (err) {
                console.error("Error downloading database backup:", err);
                if (!res.headersSent) {
                    req.flash('error_msg', '❌ Operation Failed! ❌ Could not download database backup. 😔');
                    res.redirect('/admin/dashboard');
                }
            }
        });
    } else {
        console.error("Database file not found at:", dbFilePath);
        req.flash('error_msg', '❌ Operation Failed! ❌ Database file not found. Backup failed. 😔');
        res.redirect('/admin/dashboard');
    }
};
const renderRestoreDatabasePage = (req, res) => {
    res.render('pages/admin/settings/database-restore', { title: 'Restore Database', admin: req.admin });
};
const handleRestoreDatabase = async (req, res) => {
    if (!req.file) {
        req.flash('error_msg', '⚠️ No database file uploaded. Please select a file.');
        return res.redirect('/admin/settings/database/restore-page');
    }
    const uploadedFilePath = req.file.path;
    const dbDirectory = path.resolve(__dirname, '../../../db');
    const dbLivePath = path.join(dbDirectory, 'twoem_online.sqlite');
    const dbBackupPath = path.join(dbDirectory, `twoem_online.sqlite.pre-restore-${Date.now()}`);
    try {
        if (!fs.existsSync(dbDirectory)) { fs.mkdirSync(dbDirectory, { recursive: true }); }
        if (fs.existsSync(dbLivePath)) {
            console.log(`[DB Restore] Backing up current database to ${dbBackupPath}`);
            fs.copyFileSync(dbLivePath, dbBackupPath);
        }
        await new Promise((resolveClose, rejectClose) => {
            db.close((err) => {
                if (err) console.error('[DB Restore] Error closing current database connection before restore:', err.message);
                else console.log('[DB Restore] Current database connection closed.');
                resolveClose();
            });
        });
        console.log(`[DB Restore] Replacing live database with uploaded file: ${uploadedFilePath}`);
        fs.renameSync(uploadedFilePath, dbLivePath); // Use renameSync for atomic-like operation
        logAdminAction(req.admin.id, 'DB_RESTORED', `Admin ${req.admin.name} restored database from: ${req.file.originalname}`, 'database', null, req.ip);
        req.flash('success_msg', '✨ Update Successful! ✨ Database restored successfully. Application restart is required for changes to take full effect. 🎉');
        res.redirect('/admin/dashboard');
        // Instruct user to restart application manually.
        // Consider process.exit() here if running under a process manager like PM2 that auto-restarts.
        // For now, relying on manual restart.
    } catch (err) {
        console.error("Error restoring database:", err);
        if (fs.existsSync(dbBackupPath) && !fs.existsSync(dbLivePath)) { // If live DB was removed/failed copy & backup exists
            try {
                fs.copyFileSync(dbBackupPath, dbLivePath); // Try to restore the pre-backup
                console.log(`[DB Restore] Rolled back to pre-restore backup: ${dbBackupPath}`);
            } catch (rollbackErr) {
                console.error(`[DB Restore] CRITICAL: Failed to roll back to pre-restore backup:`, rollbackErr);
            }
        }
        if (fs.existsSync(uploadedFilePath)) { // Clean up uploaded file if it's still there
            fs.unlinkSync(uploadedFilePath);
        }
        req.flash('error_msg', `❌ Operation Failed! ❌ Database restore failed. ${err.message} 😔`);
        res.redirect('/admin/settings/database/restore-page');
    }
};

module.exports = {
    renderRegisterStudentForm, registerStudent,
    listCourses, renderAddCourseForm, addCourse, renderEditCourseForm, updateCourse, deleteCourse,
    listStudents, viewStudentDetails, renderEditStudentForm, updateStudent, toggleStudentStatus,
    renderManageStudentEnrollments, enrollStudentInCourse, removeStudentFromCourse,
    renderEnterMarksForm, saveMarks,
    renderLogFeeForm, saveFeeEntry,
    listNotifications, renderCreateNotificationForm, createNotification, deleteNotification,
    listResources, renderCreateResourceForm, createResource, renderEditResourceForm, updateResource, deleteResource,
    renderWifiSettingsForm, updateWifiSettings,
    listDownloadableDocuments, renderCreateDocumentForm, createDocument, renderEditDocumentForm, updateDocument, deleteDocument,
    viewActionLogs, adminResetStudentPassword,
    renderSendEmailForm, sendBulkEmail, renderEmailTestPage, testEmailTemplate, viewEmailLogs,
    downloadDatabaseBackup, renderRestoreDatabasePage, handleRestoreDatabase
};
