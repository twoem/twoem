const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const Fee = require('../models/Fee');
const Resource = require('../models/Resource');
const { sendEmail } = require('../utils/emailService');
const { formatDate } = require('../utils/helpers');

// Authentication
exports.showLogin = (req, res) => {
    if (req.session.studentId) return res.redirect('/student/dashboard');
    res.render('student/login', { title: 'Twoem | Student Login' });
};

exports.login = async (req, res) => {
    const { regNumber, password } = req.body;
    
    try {
        const student = await Student.findOne({ 
            regNumber: regNumber.toUpperCase(), 
            isActive: true 
        });
        
        if (!student) {
            return res.render('student/login', {
                error: 'Invalid registration number or account inactive',
                title: 'Twoem | Student Login'
            });
        }
        
        const match = await bcrypt.compare(password, student.passwordHash);
        if (!match) {
            return res.render('student/login', {
                error: 'Invalid password',
                title: 'Twoem | Student Login'
            });
        }
        
        if (student.mustResetPassword) {
            req.session.tempStudentId = student._id;
            return res.redirect('/student/reset-password-first');
        }
        
        req.session.studentId = student._id;
        student.lastLogin = new Date();
        await student.save();
        
        res.redirect('/student/dashboard');
    } catch (error) {
        console.error('Student login error:', error);
        res.render('student/login', {
            error: 'An error occurred. Please try again.',
            title: 'Twoem | Student Login'
        });
    }
};

exports.showResetPasswordFirst = (req, res) => {
    if (!req.session.tempStudentId) {
        return res.redirect('/student/login');
    }
    
    res.render('student/reset-password-first', {
        title: 'Twoem | Reset Password'
    });
};

exports.processResetPasswordFirst = async (req, res) => {
    const { newPassword, confirmPassword } = req.body;
    
    if (newPassword !== confirmPassword) {
        return res.render('student/reset-password-first', {
            error: 'Passwords do not match',
            title: 'Twoem | Reset Password'
        });
    }
    
    try {
        const student = await Student.findById(req.session.tempStudentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        student.passwordHash = await bcrypt.hash(newPassword, 10);
        student.mustResetPassword = false;
        await student.save();
        
        req.session.studentId = student._id;
        delete req.session.tempStudentId;
        
        res.redirect('/student/dashboard');
    } catch (error) {
        console.error('Password reset error:', error);
        res.render('student/reset-password-first', {
            error: 'Failed to reset password. Please try again.',
            title: 'Twoem | Reset Password'
        });
    }
};

exports.showForgotPassword = (req, res) => {
    res.render('student/forgot-password', {
        title: 'Twoem | Forgot Password'
    });
};

exports.processForgotPassword = async (req, res) => {
    const { regNumberOrEmail } = req.body;
    
    try {
        const student = await Student.findOne({
            $or: [
                { regNumber: regNumberOrEmail.toUpperCase() },
                { email: regNumberOrEmail }
            ],
            isActive: true
        });
        
        if (!student) {
            return res.render('student/forgot-password', {
                title: 'Twoem | Forgot Password',
                message: 'If an account exists with that information, a reset link has been sent.'
            });
        }
        
        const resetToken = await student.createPasswordResetToken();
        const resetUrl = `${process.env.WEBSITE_DOMAIN}/student/reset-password?token=${resetToken}`;
        
        await sendEmail({
            to: student.email,
            subject: 'Password Reset Request',
            text: `Hello ${student.fullName},\n\nYou requested to reset your password. Click the link below to proceed:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nTwoem Online Productions`,
            html: `<p>Hello ${student.fullName},</p>
                   <p>You requested to reset your password. Click the link below to proceed:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>This link expires in 1 hour.</p>
                   <p>If you didn't request this, please ignore this email.</p>
                   <p>Best regards,<br>Twoem Online Productions</p>`
        });
        
        res.render('student/forgot-password', {
            title: 'Twoem | Forgot Password',
            message: 'If an account exists with that information, a reset link has been sent.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.render('student/forgot-password', {
            title: 'Twoem | Forgot Password',
            error: 'Failed to process request. Please try again.'
        });
    }
};

exports.showResetPassword = async (req, res) => {
    const { token } = req.query;
    
    try {
        const student = await Student.findOne({
            passwordResetExpires: { $gt: Date.now() }
        });
        
        if (!student || !(await bcrypt.compare(token, student.passwordResetTokenHash))) {
            return res.render('student/reset-password', {
                title: 'Twoem | Reset Password',
                error: 'Invalid or expired token'
            });
        }
        
        res.render('student/reset-password', {
            title: 'Twoem | Reset Password',
            token
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.render('student/reset-password', {
            title: 'Twoem | Reset Password',
            error: 'Failed to process request. Please try again.'
        });
    }
};

exports.processResetPassword = async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body;
    
    if (newPassword !== confirmPassword) {
        return res.render('student/reset-password', {
            title: 'Twoem | Reset Password',
            token,
            error: 'Passwords do not match'
        });
    }
    
    try {
        const student = await Student.findOne({
            passwordResetExpires: { $gt: Date.now() }
        });
        
        if (!student || !(await bcrypt.compare(token, student.passwordResetTokenHash))) {
            return res.render('student/reset-password', {
                title: 'Twoem | Reset Password',
                error: 'Invalid or expired token'
            });
        }
        
        student.passwordHash = await bcrypt.hash(newPassword, 10);
        student.passwordResetTokenHash = undefined;
        student.passwordResetExpires = undefined;
        student.mustResetPassword = false;
        await student.save();
        
        res.render('student/reset-password', {
            title: 'Twoem | Reset Password',
            success: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.render('student/reset-password', {
            title: 'Twoem | Reset Password',
            token,
            error: 'Failed to reset password. Please try again.'
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.redirect('/student/login');
};

// Dashboard
exports.dashboard = async (req, res) => {
    try {
        const [student, notifications, feeRecords] = await Promise.all([
            Student.findById(req.session.studentId),
            Notification.find({ 
                $or: [
                    { studentId: req.session.studentId },
                    { isGlobal: true }
                ]
            }).sort({ sentAt: -1 }).limit(5),
            Fee.find({ studentId: req.session.studentId }).sort({ paymentDate: -1 })
        ]);
        
        if (!student) {
            return res.redirect('/student/login');
        }
        
        const totalPaid = feeRecords.reduce((sum, fee) => sum + fee.amountPaid, 0);
        const balance = 15000 - totalPaid; // Assuming standard fee is 15,000
        
        res.render('student/dashboard', {
            title: 'Twoem | Student Dashboard',
            student,
            notifications,
            totalPaid,
            balance
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/student/login');
    }
};

// Profile
exports.showProfile = async (req, res) => {
    try {
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        res.render('student/profile', {
            title: 'Twoem | My Profile',
            student
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/student/dashboard');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        // Update email if changed
        if (email && email !== student.email) {
            student.email = email;
        }
        
        // Update password if provided
        if (currentPassword && newPassword) {
            const match = await bcrypt.compare(currentPassword, student.passwordHash);
            if (!match) {
                return res.render('student/profile', {
                    title: 'Twoem | My Profile',
                    student,
                    error: 'Current password is incorrect'
                });
            }
            
            student.passwordHash = await bcrypt.hash(newPassword, 10);
            student.mustResetPassword = false;
        }
        
        await student.save();
        
        res.render('student/profile', {
            title: 'Twoem | My Profile',
            student,
            success: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.render('student/profile', {
            title: 'Twoem | My Profile',
            student: await Student.findById(req.session.studentId),
            error: 'Failed to update profile'
        });
    }
};

// Academics
exports.showAcademics = async (req, res) => {
    try {
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        // In a real app, you'd fetch this from the database
        const academicRecord = {
            unitMarks: {
                "Introduction to Computers": 85,
                "Keyboard Management": 78,
                "Microsoft Word": 92,
                "Microsoft Excel": 88,
                "Microsoft Publisher": 76,
                "Microsoft PowerPoint": 90,
                "Microsoft Access": 82,
                "Internet and Email": 95
            },
            examMarks: {
                theory: 80,
                practical: 85
            },
            finalScore: 83.5,
            isEligibleCertificate: true,
            recordedAt: new Date('2023-06-15')
        };
        
        // Check fees
        const feeRecords = await Fee.find({ studentId: req.session.studentId });
        const totalPaid = feeRecords.reduce((sum, fee) => sum + fee.amountPaid, 0);
        const feeCleared = totalPaid >= 15000;
        
        res.render('student/academics', {
            title: 'Twoem | Academic Records',
            student,
            academicRecord,
            feeCleared,
            totalPaid
        });
    } catch (error) {
        console.error('Academics error:', error);
        res.redirect('/student/dashboard');
    }
};

// Fees
exports.showFees = async (req, res) => {
    try {
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        const feeRecords = await Fee.find({ studentId: req.session.studentId })
            .sort({ paymentDate: -1 });
            
        const totalPaid = feeRecords.reduce((sum, fee) => sum + fee.amountPaid, 0);
        const balance = 15000 - totalPaid; // Assuming standard fee is 15,000
        
        res.render('student/fees', {
            title: 'Twoem | Fee Statement',
            student,
            feeRecords,
            totalPaid,
            balance
        });
    } catch (error) {
        console.error('Fees error:', error);
        res.redirect('/student/dashboard');
    }
};

exports.requestReceipt = async (req, res) => {
    try {
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        const feeRecords = await Fee.find({ studentId: req.session.studentId })
            .sort({ paymentDate: -1 });
            
        const totalPaid = feeRecords.reduce((sum, fee) => sum + fee.amountPaid, 0);
        
        await sendEmail({
            to: student.email,
            subject: 'Your Fee Receipts',
            text: `Hello ${student.fullName},\n\nHere are your payment records:\n\n${feeRecords.map(fee => `Amount: KES ${fee.amountPaid}\nDate: ${formatDate(fee.paymentDate)}\nReference: ${fee.referenceNumber}\n`).join('\n')}\nTotal Paid: KES ${totalPaid}\n\nBest regards,\nTwoem Online Productions`,
            html: `<p>Hello ${student.fullName},</p>
                   <p>Here are your payment records:</p>
                   <table border="1" cellpadding="5" cellspacing="0">
                     <thead>
                       <tr>
                         <th>Amount</th>
                         <th>Date</th>
                         <th>Reference</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${feeRecords.map(fee => `
                         <tr>
                           <td>KES ${fee.amountPaid}</td>
                           <td>${formatDate(fee.paymentDate)}</td>
                           <td>${fee.referenceNumber}</td>
                         </tr>
                       `).join('')}
                     </tbody>
                   </table>
                   <p><strong>Total Paid:</strong> KES ${totalPaid}</p>
                   <p>Best regards,<br>Twoem Online Productions</p>`
        });
        
        res.redirect('/student/fees?success=Receipts sent to your email');
    } catch (error) {
        console.error('Request receipt error:', error);
        res.redirect('/student/fees?error=Failed to send receipts');
    }
};

// Resources
exports.showResources = async (req, res) => {
    try {
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        const resources = await Resource.find({
            $or: [
                { targetCourse: { $exists: false } },
                { targetCourse: { $in: [
                    "Introduction to Computers",
                    "Keyboard Management",
                    "Microsoft Word",
                    "Microsoft Excel", 
                    "Microsoft Publisher",
                    "Microsoft PowerPoint",
                    "Microsoft Access",
                    "Internet and Email"
                ] } }
            ],
            $or: [
                { expiryDate: { $exists: false } },
                { expiryDate: { $gt: new Date() } }
            ]
        }).sort({ uploadDate: -1 });
        
        res.render('student/resources', {
            title: 'Twoem | Learning Resources',
            student,
            resources
        });
    } catch (error) {
        console.error('Resources error:', error);
        res.redirect('/student/dashboard');
    }
};

// Notifications
exports.showNotifications = async (req, res) => {
    try {
        const student = await Student.findById(req.session.studentId);
        if (!student) {
            return res.redirect('/student/login');
        }
        
        const notifications = await Notification.find({ 
            $or: [
                { studentId: req.session.studentId },
                { isGlobal: true }
            ]
        }).sort({ sentAt: -1 });
        
