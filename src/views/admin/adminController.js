const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const Fee = require('../models/Fee');
const Resource = require('../models/Resource');
const { sendEmail } = require('../utils/emailService');
const { formatDate } = require('../utils/helpers');

// Authentication
exports.showLogin = (req, res) => {
    if (req.session.isAdmin) return res.redirect('/admin/dashboard');
    res.render('admin/login', { title: 'Twoem | Admin Login' });
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    
    if (username !== process.env.ADMIN_USERNAME) {
        return res.render('admin/login', { 
            error: 'Invalid credentials',
            title: 'Twoem | Admin Login'
        });
    }
    
    const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    if (match) {
        req.session.isAdmin = true;
        return res.redirect('/admin/dashboard');
    }
    
    res.render('admin/login', { 
        error: 'Invalid credentials',
        title: 'Twoem | Admin Login'
    });
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
};

// Dashboard
exports.dashboard = async (req, res) => {
    try {
        const [studentCount, recentStudents, pendingFees, recentNotifications] = await Promise.all([
            Student.countDocuments({ isActive: true }),
            Student.find({ isActive: true }).sort({ createdAt: -1 }).limit(5),
            Fee.aggregate([
                { $group: { _id: null, totalBalance: { $sum: "$balance" } } }
            ]),
            Notification.find({ isGlobal: true })
                .sort({ sentAt: -1 })
                .limit(3)
        ]);

        res.render('admin/dashboard', {
            title: 'Twoem | Admin Dashboard',
            studentCount,
            recentStudents,
            pendingBalance: pendingFees[0]?.totalBalance || 0,
            recentNotifications
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('admin/dashboard', {
            title: 'Twoem | Admin Dashboard',
            error: 'Failed to load dashboard data'
        });
    }
};

// Student Management
exports.listStudents = async (req, res) => {
    try {
        const students = await Student.find({ isActive: true }).sort({ fullName: 1 });
        res.render('admin/students', {
            title: 'Twoem | Manage Students',
            students,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('List students error:', error);
        res.redirect('/admin/dashboard?error=Failed to load students');
    }
};

exports.registerStudent = async (req, res) => {
    try {
        const { regNumber, fullName, email } = req.body;
        
        const existingStudent = await Student.findOne({ 
            $or: [{ regNumber }, { email }] 
        });
        
        if (existingStudent) {
            return res.redirect('/admin/students?error=Registration number or email already exists');
        }

        const passwordHash = await bcrypt.hash('Portal@2025', 10);
        
        const student = new Student({
            regNumber,
            fullName,
            email,
            passwordHash,
            mustResetPassword: true,
            isActive: true
        });
        
        await student.save();
        
        await sendEmail({
            to: email,
            subject: 'Welcome to Twoem Student Portal',
            text: `Hello ${fullName},\n\nYour account has been created.\n\nRegistration Number: ${regNumber}\nTemporary Password: Portal@2025\n\nPlease login and change your password immediately.\n\nPortal URL: ${process.env.WEBSITE_DOMAIN}/student/login\n\nBest regards,\nTwoem Admin`,
            html: `<p>Hello ${fullName},</p>
                   <p>Your account has been created.</p>
                   <p><strong>Registration Number:</strong> ${regNumber}<br>
                   <strong>Temporary Password:</strong> Portal@2025</p>
                   <p>Please <a href="${process.env.WEBSITE_DOMAIN}/student/login">login here</a> and change your password immediately.</p>
                   <p>Best regards,<br>Twoem Admin</p>`
        });

        res.redirect('/admin/students?success=Student registered successfully');
    } catch (error) {
        console.error('Register student error:', error);
        res.redirect('/admin/students?error=Failed to register student');
    }
};

exports.showEditStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.redirect('/admin/students?error=Student not found');
        }
        
        res.render('admin/edit-student', {
            title: 'Twoem | Edit Student',
            student
        });
    } catch (error) {
        console.error('Edit student error:', error);
        res.redirect('/admin/students?error=Failed to load student');
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { fullName, email } = req.body;
        
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { fullName, email },
            { new: true }
        );
        
        if (!student) {
            return res.redirect('/admin/students?error=Student not found');
        }
        
        res.redirect('/admin/students?success=Student updated successfully');
    } catch (error) {
        console.error('Update student error:', error);
        res.redirect(`/admin/students/${req.params.id}/edit?error=Failed to update student`);
    }
};

exports.deactivateStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        
        if (!student) {
            return res.redirect('/admin/students?error=Student not found');
        }
        
        await sendEmail({
            to: student.email,
            subject: 'Account Deactivated',
            text: `Hello ${student.fullName},\n\nYour student account has been deactivated.\n\nIf this was a mistake, please contact the admin.\n\nBest regards,\nTwoem Admin`,
            html: `<p>Hello ${student.fullName},</p>
                   <p>Your student account has been deactivated.</p>
                   <p>If this was a mistake, please contact the admin.</p>
                   <p>Best regards,<br>Twoem Admin</p>`
        });
        
        res.redirect('/admin/students?success=Student deactivated successfully');
    } catch (error) {
        console.error('Deactivate student error:', error);
        res.redirect('/admin/students?error=Failed to deactivate student');
    }
};

exports.resetStudentPassword = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.redirect('/admin/students?error=Student not found');
        }
        
        const passwordHash = await bcrypt.hash('Portal@2025', 10);
        student.passwordHash = passwordHash;
        student.mustResetPassword = true;
        await student.save();
        
        await sendEmail({
            to: student.email,
            subject: 'Password Reset',
            text: `Hello ${student.fullName},\n\nYour password has been reset to the default: Portal@2025\n\nPlease login and change it immediately.\n\nPortal URL: ${process.env.WEBSITE_DOMAIN}/student/login\n\nBest regards,\nTwoem Admin`,
            html: `<p>Hello ${student.fullName},</p>
                   <p>Your password has been reset to the default: <strong>Portal@2025</strong></p>
                   <p>Please <a href="${process.env.WEBSITE_DOMAIN}/student/login">login here</a> and change it immediately.</p>
                   <p>Best regards,<br>Twoem Admin</p>`
        });
        
        res.redirect('/admin/students?success=Password reset successfully');
    } catch (error) {
        console.error('Reset password error:', error);
        res.redirect('/admin/students?error=Failed to reset password');
    }
};

// Fees Management
exports.listFees = async (req, res) => {
    try {
        const students = await Student.find({ isActive: true }).sort({ fullName: 1 });
        const feeRecords = await Fee.find().populate('studentId');
        
        // Calculate balances for each student
        const studentsWithFees = students.map(student => {
            const studentFees = feeRecords.filter(fee => fee.studentId._id.equals(student._id));
            const totalPaid = studentFees.reduce((sum, fee) => sum + fee.amountPaid, 0);
            const balance = 15000 - totalPaid; // Assuming standard fee is 15,000
            
            return {
                ...student.toObject(),
                totalPaid,
                balance
            };
        });
        
        res.render('admin/fees', {
            title: 'Twoem | Fees Management',
            students: studentsWithFees
        });
    } catch (error) {
        console.error('List fees error:', error);
        res.redirect('/admin/dashboard?error=Failed to load fee records');
    }
};

exports.recordPayment = async (req, res) => {
    try {
        const { studentId, amountPaid, paymentDate, referenceNumber } = req.body;
        
        const fee = new Fee({
            studentId,
            amountPaid: parseFloat(amountPaid),
            paymentDate: new Date(paymentDate),
            referenceNumber,
            recordedBy: req.session.adminId
        });
        
        await fee.save();
        
        const student = await Student.findById(studentId);
        if (student) {
            await sendEmail({
                to: student.email,
                subject: 'Payment Received',
                text: `Hello ${student.fullName},\n\nWe have received your payment of KES ${amountPaid}.\n\nReference: ${referenceNumber}\nDate: ${formatDate(paymentDate)}\n\nThank you for your payment.\n\nBest regards,\nTwoem Admin`,
                html: `<p>Hello ${student.fullName},</p>
                       <p>We have received your payment of <strong>KES ${amountPaid}</strong>.</p>
                       <p><strong>Reference:</strong> ${referenceNumber}<br>
                       <strong>Date:</strong> ${formatDate(paymentDate)}</p>
                       <p>Thank you for your payment.</p>
                       <p>Best regards,<br>Twoem Admin</p>`
            });
        }
        
        res.redirect('/admin/fees?success=Payment recorded successfully');
    } catch (error) {
        console.error('Record payment error:', error);
        res.redirect('/admin/fees?error=Failed to record payment');
    }
};

exports.sendFeeReminders = async (req, res) => {
    try {
        const students = await Student.find({ isActive: true });
        const feeRecords = await Fee.find().populate('studentId');
        
        const studentsWithBalances = students.map(student => {
            const studentFees = feeRecords.filter(fee => fee.studentId._id.equals(student._id));
            const totalPaid = studentFees.reduce((sum, fee) => sum + fee.amountPaid, 0);
            const balance = 15000 - totalPaid;
            
            return {
                student,
                balance
            };
        }).filter(item => item.balance > 0);
        
        // Send emails to each student with balance
        await Promise.all(studentsWithBalances.map(async ({ student, balance }) => {
            await sendEmail({
                to: student.email,
                subject: 'Fee Balance Reminder',
                text: `Hello ${student.fullName},\n\nYour current fee balance is KES ${balance}.\n\nPlease clear your balance to avoid inconvenience.\n\nBest regards,\nTwoem Admin`,
                html: `<p>Hello ${student.fullName},</p>
                       <p>Your current fee balance is <strong>KES ${balance}</strong>.</p>
                       <p>Please clear your balance to avoid inconvenience.</p>
                       <p>Best regards,<br>Twoem Admin</p>`
            });
        }));
        
        res.redirect('/admin/fees?success=Reminders sent successfully');
    } catch (error) {
        console.error('Send reminders error:', error);
        res.redirect('/admin/fees?error=Failed to send reminders');
    }
};

// Academics Management
exports.listStudentsForGrades = async (req, res) => {
    try {
        const students = await Student.find({ isActive: true }).sort({ fullName: 1 });
        res.render('admin/academics-list', {
            title: 'Twoem | Academic Records',
            students
        });
    } catch (error) {
        console.error('List students for grades error:', error);
        res.redirect('/admin/dashboard?error=Failed to load students');
    }
};

exports.showGradeForm = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.redirect('/admin/academics?error=Student not found');
        }
        
        res.render('admin/academics-form', {
            title: 'Twoem | Enter Grades',
            student,
            courses: [
                "Introduction to Computers",
                "Keyboard Management",
                "Microsoft Word",
                "Microsoft Excel",
                "Microsoft Publisher",
                "Microsoft PowerPoint",
                "Microsoft Access",
                "Internet and Email"
            ]
        });
    } catch (error) {
        console.error('Show grade form error:', error);
        res.redirect('/admin/academics?error=Failed to load form');
    }
};

exports.saveGrades = async (req, res) => {
    try {
        const { studentId, unitMarks, theoryMark, practicalMark } = req.body;
        
        // Calculate final score
        const unitAverage = Object.values(unitMarks)
            .map(Number)
            .reduce((sum, mark) => sum + mark, 0) / 8;
        
        const examAverage = (Number(theoryMark) + Number(practicalMark)) / 2;
        const finalScore = (unitAverage * 0.3) + (examAverage * 0.7);
        
        // Check if fees are cleared
        const feeRecords = await Fee.find({ studentId });
        const totalPaid = feeRecords.reduce((sum, fee) => sum + fee.amountPaid, 0);
        const isEligible = finalScore >= 60 && totalPaid >= 15000;
        
        // Save academic record
        const academicRecord = {
            studentId,
            unitMarks,
            examMarks: {
                theory: theoryMark,
                practical: practicalMark
            },
            finalScore,
            isEligibleCertificate: isEligible,
            recordedBy: req.session.adminId,
            recordedAt: new Date()
        };
        
        // In a real app, you'd save this to a database
        // For now, we'll just pass it to the view
        res.render('admin/academics-result', {
            title: 'Twoem | Grade Results',
            student: await Student.findById(studentId),
            academicRecord,
            totalPaid,
            feeCleared: totalPaid >= 15000
        });
    } catch (error) {
        console.error('Save grades error:', error);
        res.redirect(`/admin/academics/${req.params.id}?error=Failed to save grades`);
    }
};

// Resources Management
exports.listResources = async (req, res) => {
    try {
        const resources = await Resource.find()
            .sort({ uploadDate: -1 })
            .populate('uploadedBy', 'fullName');
            
        res.render('admin/resources', {
            title: 'Twoem | Learning Resources',
            resources
        });
    } catch (error) {
        console.error('List resources error:', error);
        res.redirect('/admin/dashboard?error=Failed to load resources');
    }
};

exports.uploadResource = async (req, res) => {
    try {
        if (!req.file) {
            return res.redirect('/admin/resources?error=No file uploaded');
        }
        
        const { description, targetCourse, expiryDate } = req.body;
        
        const resource = new Resource({
            originalName: req.file.originalname,
            storedName: req.file.filename,
            filePath: `/uploads/public/${req.file.filename}`,
            description,
            targetCourse,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            uploadedBy: req.session.adminId
        });
        
        await resource.save();
        
        res.redirect('/admin/resources?success=Resource uploaded successfully');
    } catch (error) {
        console.error('Upload resource error:', error);
        res.redirect('/admin/resources?error=Failed to upload resource');
    }
};

exports.deleteResource = async (req, res) => {
    try {
        const resource = await Resource.findByIdAndDelete(req.params.id);
        if (!resource) {
            return res.redirect('/admin/resources?error=Resource not found');
        }
        
        // In a real app, you'd also delete the file from storage
        res.redirect('/admin/resources?success=Resource deleted successfully');
    } catch (error) {
        console.error('Delete resource error:', error);
        res.redirect('/admin/resources?error=Failed to delete resource');
    }
};

// Notifications Management
exports.listNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find()
            .sort({ sentAt: -1 })
            .populate('studentId', 'regNumber fullName');
            
        res.render('admin/notifications', {
            title: 'Twoem | Notifications',
            notifications
        });
    } catch (error) {
        console.error('List notifications error:', error);
        res.redirect('/admin/dashboard?error=Failed to load notifications');
    }
};

exports.sendNotification = async (req, res) => {
    try {
        const { studentId, title, message } = req.body;
        
        const notification = new Notification({
            studentId,
            title,
            message,
            isGlobal: false,
            sentBy: req.session.adminId
        });
        
        await notification.save();
        
        const student = await Student.findById(studentId);
        if (student) {
            await sendEmail({
                to: student.email,
                subject: title,
                text: `${message}\n\n--\nTwoem Online Productions`,
                html: `<p>${message.replace(/\n/g, '<br>')}</p>
                       <p>--<br>Twoem Online Productions</p>`
            });
        }
        
        res.redirect('/admin/notifications?success=Notification sent successfully');
    } catch (error) {
        console.error('Send notification error:', error);
        res.redirect('/admin/notifications?error=Failed to send notification');
    }
};

exports.broadcastNotification = async (req, res) => {
    try {
        const { title, message } = req.body;
        
        const notification = new Notification({
            title,
            message,
            isGlobal: true,
            sentBy: req.session.adminId
        });
        
        await notification.save();
        
        // Get all active students
        const students = await Student.find({ isActive: true });
        
        // Send emails to all students
        await Promise.all(students.map(async student => {
            await sendEmail({
                to: student.email,
                subject: title,
                text: `${message}\n\n--\nTwoem Online Productions`,
                html: `<p>${message.replace(/\n/g, '<br>')}</p>
                       <p>--<br>Twoem Online Productions</p>`
            });
        }));
        
        res.redirect('/admin/notifications?success=Broadcast sent successfully');
    } catch (error) {
        console.error('Broadcast notification error:', error);
        res.redirect('/admin/notifications?error=Failed to send broadcast');
    }
};
