const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');
const Student = require('../models/Student');
const Admin = require('../models/Admin'); // Now using Admin model

// Generic protect middleware - will determine user type
exports.protect = async (req, res, next) => {
    let token;

    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    // else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // token = req.headers.authorization.split(' ')[1];
    // }

    if (!token) {
        // For EJS views, redirect to login. For API, send 401.
        // Check originalUrl to see if it's a customer, student, or admin route
        let loginRedirect = '/'; // Default redirect
        if (req.originalUrl.startsWith('/customer')) {
            loginRedirect = '/customer/login';
        } else if (req.originalUrl.startsWith('/student')) {
            loginRedirect = '/student/login';
        } else if (req.originalUrl.startsWith('/admin')) {
            loginRedirect = '/admin/login';
        }
        return res.status(401).redirect(`${loginRedirect}?error=Not authorized, please login.`);
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user to request object
        // The payload structure is { user: { id: customer.id, type: 'customer' } }
        if (decoded.user && decoded.user.type === 'customer') {
            req.user = await Customer.findById(decoded.user.id).select('-password');
            if (!req.user) {
                // User not found, maybe deleted after token was issued
                res.cookie('token', '', { httpOnly: true, expires: new Date(0) }); // Clear cookie
                const userType = decoded.user && decoded.user.type ? decoded.user.type : 'customer';
                return res.status(401).redirect(`/${userType}/login?error=User not found, please login again.`);
            }
        } else if (decoded.user && decoded.user.type === 'student') {
            req.user = await Student.findById(decoded.user.id).select('-password');
            if (!req.user) {
                res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
                return res.status(401).redirect('/student/login?error=User not found, please login again.');
            }
        } else if (decoded.user && decoded.user.type === 'admin') {
            req.user = await Admin.findById(decoded.user.id).select('-password');
            if (!req.user) {
                res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
                return res.status(401).redirect('/admin/login?error=User not found, please login again.');
            }
        } else {
            // Token is for a different user type or malformed, or type not handled yet
            let loginRedirect = '/'; // Default redirect
            if (req.originalUrl.startsWith('/customer')) loginRedirect = '/customer/login';
            else if (req.originalUrl.startsWith('/student')) loginRedirect = '/student/login';
            else if (req.originalUrl.startsWith('/admin')) loginRedirect = '/admin/login';
            return res.status(401).redirect(`${loginRedirect}?error=Invalid token or user type, please login.`);
        }

        if (!req.user) { // Fallback if user type not matched or user deleted
             let loginRedirect = '/';
             if (req.originalUrl.startsWith('/customer')) loginRedirect = '/customer/login';
             else if (req.originalUrl.startsWith('/student')) loginRedirect = '/student/login';
             else if (req.originalUrl.startsWith('/admin')) loginRedirect = '/admin/login';
             return res.status(401).redirect(`${loginRedirect}?error=Not authorized, please login.`);
        }

        next();
    } catch (err) {
        console.error('Token verification error:', err);
        let loginRedirect = '/';
        if (req.originalUrl.startsWith('/customer')) loginRedirect = '/customer/login';
        else if (req.originalUrl.startsWith('/student')) loginRedirect = '/student/login';
        else if (req.originalUrl.startsWith('/admin')) loginRedirect = '/admin/login';
        return res.status(401).redirect(`${loginRedirect}?error=Not authorized, token failed.`);
    }
};


// Middleware to ensure the user is a customer
exports.protectCustomer = (req, res, next) => {
    if (req.user && req.user.constructor.modelName === 'Customer') { // Check model name
        next();
    } else {
        res.status(403).redirect('/customer/login?error=Access denied. Not a customer account.');
    }
};

// Middleware to ensure the user is a student
exports.protectStudent = (req, res, next) => {
    if (req.user && req.user.constructor.modelName === 'Student') {
        next();
    } else {
        // If not a student, or if req.user is not even set (e.g. wrong token type initially)
        // The main 'protect' should handle general token issues. This is an additional check.
        res.status(403).redirect('/student/login?error=Access denied. Not a student account.');
    }
};

// Middleware to check if the CUSTOMER has a default password
exports.checkDefaultPassword = (req, res, next) => { // Renamed to be specific
    if (req.user && req.user.isDefaultPassword && req.originalUrl !== '/customer/change-password' && !req.originalUrl.endsWith('/logout')) {
        return res.redirect('/customer/change-password?message=Please change your default password to continue.');
    }
    next();
};

// Middleware to ensure the user is an Admin
exports.protectAdmin = (req, res, next) => {
    if (req.user && req.user.constructor.modelName === 'Admin') {
        next();
    } else {
        res.status(403).redirect('/admin/login?error=Access denied. Not an admin account.');
    }
};


// Middleware to check if the STUDENT has a default password
exports.checkStudentDefaultPassword = (req, res, next) => {
    if (req.user && req.user.isDefaultPassword && req.originalUrl !== '/student/change-password' && !req.originalUrl.endsWith('/logout')) {
        return res.redirect('/student/change-password?message=Please change your default password to continue.');
    }
    next();
};

// Middleware to check if STUDENT profile (Next of Kin) needs update
exports.checkStudentProfile = (req, res, next) => {
    // This should only trigger if default password is NOT true, as that takes precedence
    if (req.user && !req.user.isDefaultPassword && req.user.profileRequiresUpdate &&
        req.originalUrl !== '/student/update-profile' &&
        !req.originalUrl.endsWith('/logout') &&
        req.originalUrl !== '/student/change-password' // Don't interfere if they are changing password
        ) {
        return res.redirect('/student/update-profile?message=Please update your Next of Kin information to continue.');
    }
    next();
};
