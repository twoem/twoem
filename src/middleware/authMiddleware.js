const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtHelper'); // Import from helper
const db = require('../config/database'); // For authStudent
const Customer = require('../models/customerModel'); // For authCustomer

// Middleware to authenticate admins
const authAdmin = (req, res, next) => {
    console.log(`[AuthAdmin] Path: ${req.method} ${req.originalUrl}`);
    // console.log('[AuthAdmin] All Cookies:', req.cookies);
    const token = req.cookies.admin_auth_token;

    if (!token) {
        console.log('[AuthAdmin] No admin_auth_token found in cookies.');
        return res.status(401).redirect('/admin/login?error=Authentication+required.+Please+login.');
    }

    try {
        console.log('[AuthAdmin] Token found. Verifying...');
        const decoded = jwt.verify(token, getJwtSecret());
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
const authStudent = (req, res, next) => { // REMOVED async
    console.log(`[AuthStudent] Path: ${req.method} ${req.originalUrl}`);
    const token = req.cookies.student_auth_token;

    if (!token) {
        console.log('[AuthStudent] No student_auth_token found in cookies.');
        if(req.flash) req.flash('error', 'Authentication required. Please login.');
        return res.status(401).redirect('/student/login?error=Authentication+required.+Please+login.');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, getJwtSecret());
        console.log('[AuthStudent] Token decoded successfully:', decoded.id, 'isStudent:', decoded.isStudent);

        if (decoded.isAdmin === true || !decoded.isStudent) {
            console.log('[AuthStudent] Token is not a valid student token.');
            if(req.flash) req.flash('error', 'Access denied. Invalid token type.');
            return res.status(403).redirect('/student/login?error=Access+denied.+Invalid+token+type.');
        }
    } catch (err) { // Handle JWT verification errors synchronously
        res.clearCookie('student_auth_token');
        console.error('[AuthStudent] JWT verification error:', err.name, err.message);
        let errorMsg = 'Invalid session. Please login again.';
        if (err.name === 'TokenExpiredError') {
            errorMsg = 'Session expired. Please login again.';
        }
        if(req.flash) req.flash('error', errorMsg);
        return res.status(401).redirect(`/student/login?error=${encodeURIComponent(errorMsg)}`);
    }

    // Proceed with database call using promises
    db.getAsync("SELECT * FROM students WHERE id = ?", [decoded.id])
        .then(studentDetails => {
            if (!studentDetails) {
                console.log('[AuthStudent] Student not found in DB after token verification.');
                res.clearCookie('student_auth_token');
                if(req.flash) req.flash('error', 'Student record not found.');
                return res.status(401).redirect('/student/login?error=Student+record+not+found.');
            }

            if (!studentDetails.is_active) {
                console.log('[AuthStudent] Student account is inactive.');
                res.clearCookie('student_auth_token');
                if(req.flash) req.flash('error', 'Your account is inactive. Please contact administration.');
                return res.status(403).redirect('/student/login?error=Your+account+is+inactive.+Please+contact+administration.');
            }

            req.student = studentDetails;
            console.log('[AuthStudent] Student authenticated:', req.student.email);
            next();
        })
        .catch(err => { // Catch errors from db.getAsync()
            res.clearCookie('student_auth_token');
            console.error('[AuthStudent] DB error:', err.name, err.message);
            let errorMsg = 'An error occurred. Please try again.';
            if(req.flash) req.flash('error', errorMsg);
            return res.status(500).redirect(`/student/login?error=${encodeURIComponent(errorMsg)}`);
        });
};

// Middleware to authenticate customers
const authCustomer = (req, res, next) => { // REMOVED async
    console.log(`[AuthCustomer] Path: ${req.method} ${req.originalUrl}`);
    const token = req.cookies.token;

    if (!token) {
        console.log('[AuthCustomer] No token found in cookies.');
        req.flash('error', 'Authentication required. Please login.');
        return res.status(401).redirect('/portal/customer/login');
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[AuthCustomer] Token decoded successfully:', decoded.id, 'type:', decoded.type);

        if (decoded.type !== 'customer') {
            console.log('[AuthCustomer] Token is not a valid customer token.');
            req.flash('error', 'Access denied. Invalid token type.');
            return res.status(403).redirect('/portal/customer/login');
        }
    } catch (err) { // Handle JWT verification errors synchronously
        console.error('[AuthCustomer] JWT verification error:', err.name, err.message);
        res.clearCookie('token');
        let errorMsg = 'Invalid session. Please login again.';
        if (err.name === 'TokenExpiredError') {
            errorMsg = 'Session expired. Please login again.';
        }
        req.flash('error', errorMsg);
        return res.status(401).redirect(`/portal/customer/login?error=${encodeURIComponent(errorMsg)}`);
    }

    Customer.findById(decoded.id).exec() // Mongoose queries return promises, use exec()
        .then(customerDoc => {
            if (!customerDoc) {
                res.clearCookie('token');
                req.flash('error', 'Account not found. Please login again.');
                return res.status(401).redirect('/portal/customer/login');
            }

            if (!customerDoc.isActive) {
                req.customer = customerDoc;
                req.customerId = decoded.id;
                console.log('[AuthCustomer] Customer authenticated but inactive:', decoded.id);
                return next();
            }

            let needsSave = false;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (customerDoc.paymentPerMonth > 0 && customerDoc.lastBillingDate) {
                let lastBillDate = new Date(customerDoc.lastBillingDate);
                lastBillDate.setHours(0, 0, 0, 0);
                let nextBillingDay = new Date(lastBillDate.getFullYear(), lastBillDate.getMonth() + 1, 1);

                while (nextBillingDay <= new Date(today.getFullYear(), today.getMonth(), 1)) {
                    customerDoc.currentBalance += customerDoc.paymentPerMonth;
                    customerDoc.lastBillingDate = new Date(nextBillingDay);
                    needsSave = true;
                    nextBillingDay.setMonth(nextBillingDay.getMonth() + 1);
                }
            }

            if (needsSave) {
                if (customerDoc.currentBalance < 0) {
                    const gracePeriodDays = 7;
                    let disconnect = new Date(customerDoc.lastBillingDate);
                    disconnect.setDate(disconnect.getDate() + gracePeriodDays);
                    customerDoc.disconnectionDate = disconnect;
                } else {
                    customerDoc.disconnectionDate = null;
                }
                return customerDoc.save(); // This returns a promise
            } else {
                return Promise.resolve(customerDoc); // Pass customerDoc to next .then if no save needed
            }
        })
        .then(savedCustomerDoc => { // This 'then' handles result of save() or the resolved customerDoc
            // If save was skipped, savedCustomerDoc is the original customerDoc
            req.customer = savedCustomerDoc;
            req.customerId = decoded.id; // decoded is still in scope
            console.log('[AuthCustomer] Customer authenticated & billed (if applicable):', req.customerId);
            next();
        })
        .catch(err => { // Catches errors from findById, save, or any other promise rejection
            console.error('[AuthCustomer] DB/Billing Logic Error:', err.name, err.message);
            res.clearCookie('token');
            let errorMsg = 'An error occurred processing your request. Please try again.';
            // err.name might be 'TokenExpiredError' if caught by JWT verify, but here it's more likely DB/Mongoose error
            req.flash('error', errorMsg);
            return res.status(500).redirect(`/portal/customer/login?error=${encodeURIComponent(errorMsg)}`);
        });
};

module.exports = {
    authAdmin,
    authStudent,
    authCustomer
};
