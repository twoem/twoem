const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Render the form to register a new internet customer
const renderRegisterCustomerForm = (req, res) => {
    res.render('pages/admin/customer-register', { // Assuming view will be at views/pages/admin/customer-register.ejs
        title: 'Register New Internet Customer',
        admin: req.admin,
        errors: [],
        oldInput: {}
    });
};

// Handle the registration of a new internet customer
const registerCustomer = async (req, res) => {
    // Input validation rules (will be more specific later)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).render('pages/admin/customer-register', {
            title: 'Register New Internet Customer',
            admin: req.admin,
            errors: errors.array(),
            oldInput: req.body
        });
    }

    const {
        firstName, secondName, lastName, organisationName,
        phoneNumber, email, location, installationDate,
        paymentPerMonth, accountNumber, initialBalance
    } = req.body;

    const defaultPassword = process.env.DEFAULT_CUSTOMER_PASSWORD || "Mynet@2020"; // As per requirement

    try {
        // Check for existing phone number or email or account number
        const existingCustomer = await db.getAsync(
            "SELECT * FROM customers WHERE phone_number = ? OR email = ? OR account_number = ?",
            [phoneNumber, email, accountNumber]
        );

        if (existingCustomer) {
            let conflictField = 'Unknown';
            if (existingCustomer.phone_number === phoneNumber) conflictField = 'Phone number';
            else if (existingCustomer.email === email) conflictField = 'Email';
            else if (existingCustomer.account_number === accountNumber) conflictField = 'Account Number';

            req.flash('error_msg', `${conflictField} already exists.`);
            return res.status(400).render('pages/admin/customer-register', {
                title: 'Register New Internet Customer',
                admin: req.admin,
                errors: [{ msg: `${conflictField} already exists.` }],
                oldInput: req.body
            });
        }

        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        const adminId = req.admin.id; // Assumes req.admin is populated by authAdmin middleware

        const result = await db.runAsync(
            `INSERT INTO customers (
                first_name, second_name, last_name, organisation_name,
                phone_number, email, location, installation_date,
                payment_per_month, account_number, current_balance, password_hash,
                registered_by_admin_id, requires_password_change, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)`,
            [
                firstName, secondName || null, lastName, organisationName || null,
                phoneNumber, email, location, installationDate,
                parseFloat(paymentPerMonth), accountNumber, parseFloat(initialBalance), hashedPassword,
                adminId
            ]
        );

        // TODO: Add action log
        req.flash('success_msg', `Customer ${firstName} ${lastName} registered successfully with ID ${result.lastID}.`);
        res.redirect('/admin/customers'); // Redirect to the list of customers

    } catch (err) {
        console.error("Error registering customer:", err);
        req.flash('error_msg', 'Server error while registering customer. Please try again.');
        res.status(500).render('pages/admin/customer-register', {
            title: 'Register New Internet Customer',
            admin: req.admin,
            errors: [{ msg: 'Server error. Please try again.' }],
            oldInput: req.body
        });
    }
};

// List all internet customers
const listCustomers = async (req, res) => {
    try {
        const customers = await db.allAsync("SELECT id, first_name, last_name, organisation_name, phone_number, email, account_number, current_balance, is_active FROM customers ORDER BY created_at DESC");
        res.render('pages/admin/customers-list', { // Assuming view will be at views/pages/admin/customers-list.ejs
            title: 'Manage Internet Customers',
            admin: req.admin,
            customers: customers,
            success_msg: req.flash('success_msg'), // Pass flash messages
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error("Error listing customers:", err);
        req.flash('error_msg', 'Failed to retrieve customers.');
        res.redirect('/admin/dashboard'); // Or an error page
    }
};

// More functions will be added here for:
// - View customer details
// - Render edit customer form
// - Update customer details
// - Log payments
// - Manage disconnection status etc.

module.exports = {
    renderRegisterCustomerForm,
    registerCustomer,
    listCustomers
};
