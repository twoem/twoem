const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');

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

// ... (all other student controller methods)
