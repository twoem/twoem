const bcrypt = require('bcrypt');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');

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

exports.dashboard = async (req, res) => {
    const studentCount = await Student.countDocuments({ isActive: true });
    const recentStudents = await Student.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5);
    
    res.render('admin/dashboard', {
        title: 'Twoem | Admin Dashboard',
        studentCount,
        recentStudents
    });
};

// ... (all other admin controller methods)
