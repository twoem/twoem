const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtHelper'); // Import from helper

// Middleware to authenticate admins
const authAdmin = (req, res, next) => {
    console.log(`[AuthAdmin] Path: ${req.method} ${req.originalUrl}`);
    console.log('[AuthAdmin] All Cookies:', req.cookies);
    const token = req.cookies.admin_auth_token; // Changed cookie name

    if (!token) {
        console.log('[AuthAdmin] No admin_auth_token found in cookies.');
        return res.status(401).redirect('/admin/login?error=Authentication+required.+Please+login.');
    }

    try {
        console.log('[AuthAdmin] Token found. Verifying...');
        const decoded = jwt.verify(token, getJwtSecret()); // Use helper
        console.log('[AuthAdmin] Token decoded successfully:', decoded.email, 'isAdmin:', decoded.isAdmin);

        if (!decoded.isAdmin) {
            console.log('[AuthAdmin] Token does not have isAdmin=true.');
            return res.status(403).redirect('/admin/login?error=Forbidden.+Admin+privileges+required.');
        }
        req.admin = decoded;
        console.log('[AuthAdmin] Admin authenticated:', req.admin.email);
        next();
    } catch (err) {
        console.error('[AuthAdmin] JWT Verification Error:', err.name, err.message);
        if (err.name === 'TokenExpiredError') {
            return res.status(401).redirect('/admin/login?error=Session+expired.+Please+login+again.');
        }
        return res.status(401).redirect('/admin/login?error=Invalid+session.+Please+login+again.');
    }
};

// Middleware to authenticate students
const authStudent = (req, res, next) => {
    // Add similar logging as authAdmin for debugging student sessions if needed
    console.log(`[AuthStudent] Path: ${req.method} ${req.originalUrl}`);
    console.log('[AuthStudent] All Cookies:', req.cookies);
    const token = req.cookies.student_auth_token; // Changed cookie name

    if (!token) {
        console.log('[AuthStudent] No student_auth_token found in cookies.');
        return res.status(401).redirect('/student/login?error=Authentication+required.+Please+login.');
    }

    try {
        console.log('[AuthStudent] student_auth_token found. Verifying...');
        const decoded = jwt.verify(token, getJwtSecret()); // Use helper
        console.log('[AuthStudent] Token decoded successfully:', decoded.email, 'isStudent:', decoded.isStudent);

        if (decoded.isAdmin === true || !decoded.isStudent) { // Check for isStudent flag
            console.log('[AuthStudent] Token is not a valid student token (isAdmin true or isStudent not true).');
            return res.status(403).redirect('/student/login?error=Access+denied.+Invalid+token+type.');
        }
        req.student = decoded;
        console.log('[AuthStudent] Student authenticated:', req.student.email);
        next();
    } catch (err) {
        console.error('[AuthStudent] JWT verification error:', err.name, err.message);
        if (err.name === 'TokenExpiredError') {
            return res.status(401).redirect('/student/login?error=Session+expired.+Please+login+again.');
        }
        return res.status(401).redirect('/student/login?error=Invalid+session.+Please+login+again.');
    }
};

// Middleware to authenticate internet customers
const authCustomer = (req, res, next) => {
    console.log(`[AuthCustomer] Path: ${req.method} ${req.originalUrl}`);
    console.log('[AuthCustomer] All Cookies:', req.cookies);
    const token = req.cookies.customer_auth_token;

    if (!token) {
        console.log('[AuthCustomer] No customer_auth_token found in cookies.');
        req.flash('error_msg', 'Authentication required. Please login.');
        return res.status(401).redirect('/customer/login');
    }

    try {
        console.log('[AuthCustomer] customer_auth_token found. Verifying...');
        const decoded = jwt.verify(token, getJwtSecret()); // Use helper
        console.log('[AuthCustomer] Token decoded successfully:', decoded.phoneNumber, 'isCustomer:', decoded.isCustomer);

        if (!decoded.isCustomer) { // Check for isCustomer flag
            console.log('[AuthCustomer] Token is not a valid customer token (isCustomer not true).');
            req.flash('error_msg', 'Access denied. Invalid token type.');
            return res.status(403).redirect('/customer/login');
        }
        req.customer = decoded; // Populate req.customer
        console.log('[AuthCustomer] Customer authenticated:', req.customer.phoneNumber);
        next();
    } catch (err) {
        console.error('[AuthCustomer] JWT verification error:', err.name, err.message);
        let errorMsg = 'Invalid session. Please login again.';
        if (err.name === 'TokenExpiredError') {
            errorMsg = 'Session expired. Please login again.';
        }
        req.flash('error_msg', errorMsg);
        return res.status(401).redirect('/customer/login');
    }
};

module.exports = {
    authAdmin,
    authStudent,
    authCustomer
};
