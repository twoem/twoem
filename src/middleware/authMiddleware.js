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

        // Fetch full student details from DB
        const db = require('../config/database'); // Ensure db is accessible
        const studentDetails = await db.getAsync("SELECT * FROM students WHERE id = ?", [decoded.id]);

        if (!studentDetails) {
            console.log('[AuthStudent] Student not found in DB after token verification.');
            res.clearCookie('student_auth_token');
            return res.status(401).redirect('/student/login?error=Student+record+not+found.');
        }

        if (!studentDetails.is_active) {
            console.log('[AuthStudent] Student account is inactive.');
            res.clearCookie('student_auth_token');
            // It's important to use req.flash here if it's set up before this middleware runs,
            // or pass messages via query params for login page.
            return res.status(403).redirect('/student/login?error=Your+account+is+inactive.+Please+contact+administration.');
        }

        req.student = studentDetails; // Attach full student object
        console.log('[AuthStudent] Student authenticated:', req.student.email);
        next();
    } catch (err) {
        // Clear cookie if any error during JWT verification or DB fetch
        res.clearCookie('student_auth_token');
        console.error('[AuthStudent] JWT verification or DB error:', err.name, err.message);
        if (err.name === 'TokenExpiredError') {
            return res.status(401).redirect('/student/login?error=Session+expired.+Please+login+again.');
        }
        return res.status(401).redirect('/student/login?error=Invalid+session.+Please+login+again.');
    }
};

// Middleware to authenticate customers
const authCustomer = (req, res, next) => {
    console.log(`[AuthCustomer] Path: ${req.method} ${req.originalUrl}`);
    console.log('[AuthCustomer] All Cookies:', req.cookies);
    const token = req.cookies.token; // Generic token cookie used for customer login

    if (!token) {
        console.log('[AuthCustomer] No token found in cookies.');
        req.flash('error', 'Authentication required. Please login.');
        return res.status(401).redirect('/portal/customer/login');
    }

    try {
        console.log('[AuthCustomer] Token found. Verifying...');
        // Use the main JWT_SECRET as it was used for signing customer tokens
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('[AuthCustomer] Token decoded successfully:', decoded.id, 'type:', decoded.type);

        if (decoded.type !== 'customer') { // Check for type 'customer' in payload
            console.log('[AuthCustomer] Token is not a valid customer token.');
            req.flash('error', 'Access denied. Invalid token type.');
            return res.status(403).redirect('/portal/customer/login');
        }

        // Optionally: Fetch customer from DB to ensure they still exist and are active
        // const customer = await Customer.findById(decoded.id);
        // if (!customer || !customer.isActive) {
        //     res.clearCookie('token');
        //     req.flash('error', 'Account not found or inactive.');
        //     return res.status(401).redirect('/portal/customer/login');
        // }
        // req.customer = customer; // Attach full customer object

        // --- Billing Logic Integration ---
        const Customer = require('../models/customerModel'); // Moved import here to avoid circular deps if any
        let customerDoc = await Customer.findById(decoded.id);

        if (!customerDoc) {
            res.clearCookie('token');
            req.flash('error', 'Account not found. Please login again.');
            return res.status(401).redirect('/portal/customer/login');
        }

        if (!customerDoc.isActive) {
             // No billing updates for inactive accounts, but allow access if token is valid
             req.customer = customerDoc; // Attach customer object
             req.customerId = decoded.id;
             console.log('[AuthCustomer] Customer authenticated but inactive:', decoded.id);
             return next();
        }

        let needsSave = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today to the start of the day

        if (customerDoc.paymentPerMonth > 0 && customerDoc.lastBillingDate) {
            let lastBillDate = new Date(customerDoc.lastBillingDate);
            lastBillDate.setHours(0, 0, 0, 0); // Normalize

            // Next billing date is the 1st of the month AFTER lastBillDate's month
            let nextBillingDay = new Date(lastBillDate.getFullYear(), lastBillDate.getMonth() + 1, 1);

            // Loop while the next potential billing day is on or before the 1st of the current month
            while (nextBillingDay <= new Date(today.getFullYear(), today.getMonth(), 1)) {
                // Check if this billing cycle (represented by nextBillingDay) has already been processed
                // This check is implicitly handled because we advance lastBillDate inside the loop.
                // If we've already billed for this nextBillingDay, lastBillDate would be >= nextBillingDay.
                // The loop condition `nextBillingDay <= new Date(today.getFullYear(), today.getMonth(), 1)`
                // and updating `customerDoc.lastBillingDate = new Date(nextBillingDay)` ensures we only bill once per cycle.

                console.log(`[AuthCustomer] Applying bill for ${customerDoc.accountNumber} for month starting ${nextBillingDay.toDateString()}`);
                customerDoc.currentBalance += customerDoc.paymentPerMonth;
                customerDoc.lastBillingDate = new Date(nextBillingDay); // Record that this month is now billed
                needsSave = true;

                // Advance to the next month's 1st day for the next iteration
                nextBillingDay.setMonth(nextBillingDay.getMonth() + 1);
            }
        }

        if (needsSave) {
            // Recalculate disconnectionDate
            if (customerDoc.currentBalance < 0) {
                // Disconnection is 7 days after the 1st of the month for which the bill made them negative.
                // This is the most recent lastBillingDate.
                const gracePeriodDays = 7;
                let disconnect = new Date(customerDoc.lastBillingDate);
                disconnect.setDate(disconnect.getDate() + gracePeriodDays);
                customerDoc.disconnectionDate = disconnect;
            } else {
                customerDoc.disconnectionDate = null; // Clear if balance is positive or zero
            }
            await customerDoc.save();
            console.log(`[AuthCustomer] Customer ${customerDoc.accountNumber} updated. New Balance: ${customerDoc.currentBalance}, New DiscDate: ${customerDoc.disconnectionDate}`);
        }

        req.customer = customerDoc; // Attach full, potentially updated customer object
        req.customerId = decoded.id;
        console.log('[AuthCustomer] Customer authenticated & billed:', req.customerId);
        next();
    } catch (err) {
        console.error('[AuthCustomer] JWT/Billing Logic Error:', err.name, err.message);
        res.clearCookie('token'); // Clear potentially invalid token
        if (err.name === 'TokenExpiredError') {
            req.flash('error', 'Session expired. Please login again.');
            return res.status(401).redirect('/portal/customer/login');
        }
        req.flash('error', 'Invalid session. Please login again.');
        return res.status(401).redirect('/portal/customer/login');
    }
};


module.exports = {
    authAdmin,
    authStudent,
    authCustomer
};
