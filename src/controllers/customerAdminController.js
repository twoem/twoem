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

            // Specific user-facing error, flash-messages.ejs will add ⚠️ if this is passed as error_msg
            const specificErrorMsg = `⚠️ ${conflictField} already exists.`;
            req.flash('error_msg', specificErrorMsg);
            // It's better to redirect on POST error to avoid form resubmission issues,
            // but if rendering, ensure errors are displayed.
            // For now, keeping the render to show oldInput and specific errors directly.
            return res.status(400).render('pages/admin/customer-register', {
                title: 'Register New Internet Customer',
                admin: req.admin,
                errors: [{ msg: specificErrorMsg }], // Pass it to errors array for the view
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

        // TODO: Add action log for customer registration
        req.flash('success_msg', `✨ Success! ✨ Customer ${firstName} ${lastName} registered successfully with ID ${result.lastID}. 🎉`);
        res.redirect('/admin/customers');

    } catch (err) {
        console.error("Error registering customer:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Server error while registering customer. ${err.message} 😔`);
        // Redirecting is generally better for POST errors
        res.redirect('/admin/customers/register');
        // Old render way:
        // res.status(500).render('pages/admin/customer-register', {
        //     title: 'Register New Internet Customer',
        //     admin: req.admin,
        //     errors: [{ msg: `❌ Operation Failed! ❌ Server error. Please try again. 😔` }],
        //     oldInput: req.body
        // });
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
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    } catch (err) {
        console.error("Error listing customers:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t retrieve customers. ${err.message} 😔`);
        res.redirect('/admin/dashboard');
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
    listCustomers,

    // View a specific customer's details
    viewCustomerDetails: async (req, res) => {
        try {
            const customerId = req.params.id;
            const customer = await db.getAsync(
                "SELECT * FROM customers WHERE id = ?",
                [customerId]
            );

            if (!customer) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }

            const paymentLogs = await db.allAsync(
                "SELECT * FROM customer_payment_logs WHERE customer_id = ? ORDER BY payment_date DESC",
                [customerId]
            );

            // Format dates for display if needed, e.g., customer.installation_date
            // And payment_logs dates

            res.render('pages/admin/customers/view', { // Path to the new EJS view
                title: `Customer Details - ${customer.first_name} ${customer.last_name || customer.organisation_name || ''}`,
                admin: req.admin,
                customer: customer,
                paymentLogs: paymentLogs
            });

        } catch (err) {
            console.error("Error fetching customer details for admin view:", err);
            req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t retrieve customer details. ${err.message} 😔`);
            res.redirect('/admin/customers');
        }
    },

    // Render edit customer form
    renderEditCustomerForm: async (req, res) => {
        try {
            const customerId = req.params.id;
            const customer = await db.getAsync("SELECT * FROM customers WHERE id = ?", [customerId]);

            if (!customer) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }
            // Format date for input type="date"
            if (customer.installation_date) {
                customer.installation_date_formatted = new Date(customer.installation_date).toISOString().split('T')[0];
            }

            res.render('pages/admin/customers/edit', {
                title: 'Edit Customer',
                admin: req.admin,
                customer: customer,
                errors: [], // For displaying validation errors
                oldInput: customer // Pre-fill form with existing data
            });
        } catch (err) {
            console.error("Error fetching customer for edit:", err);
            req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load customer details for editing. ${err.message} 😔`);
            res.redirect('/admin/customers');
        }
    },

    // Handle update customer details
    updateCustomerDetails: async (req, res) => {
        const customerId = req.params.id;
        const errors = validationResult(req);

        // Fetch current customer data to pass back to form if validation fails
        let customerForForm;
        try {
            customerForForm = await db.getAsync("SELECT * FROM customers WHERE id = ?", [customerId]);
            if (!customerForForm) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }
             if (customerForForm.installation_date) { // ensure formatted date is available for re-render
                customerForForm.installation_date_formatted = new Date(customerForForm.installation_date).toISOString().split('T')[0];
            }
        } catch (fetchErr) {
            console.error("Error fetching customer for update validation failure:", fetchErr);
            req.flash('error_msg', '❌ Operation Failed! ❌ Error fetching customer data. Please try again. 😔');
            return res.redirect('/admin/customers');
        }

        if (!errors.isEmpty()) {
            return res.status(400).render('pages/admin/customers/edit', {
                title: 'Edit Customer',
                admin: req.admin,
                customer: customerForForm, // Pass the original customer data for context
                errors: errors.array(),
                oldInput: req.body // Pass the attempted new input
            });
        }

        const {
            firstName, secondName, lastName, organisationName,
            phoneNumber, email, location, installationDate,
            paymentPerMonth, accountNumber
        } = req.body;

        try {
            // Check for uniqueness of email, phone, account number, excluding current customer
            const conflictingCustomer = await db.getAsync(
                "SELECT * FROM customers WHERE (email = ? OR phone_number = ? OR account_number = ?) AND id != ?",
                [email.toLowerCase(), phoneNumber, accountNumber, customerId]
            );

            if (conflictingCustomer) {
                let conflictField = 'Unknown';
                if (conflictingCustomer.email === email.toLowerCase()) conflictField = 'Email';
                else if (conflictingCustomer.phone_number === phoneNumber) conflictField = 'Phone number';
                else if (conflictingCustomer.account_number === accountNumber) conflictField = 'Account Number';

                req.flash('error_msg', `⚠️ ${conflictField} is already in use by another customer.`);
                return res.status(400).render('pages/admin/customers/edit', {
                    title: 'Edit Customer',
                    admin: req.admin,
                    customer: customerForForm,
                    errors: [{ msg: `⚠️ ${conflictField} is already in use by another customer.` }],
                    oldInput: req.body
                });
            }

            await db.runAsync(
                `UPDATE customers SET
                    first_name = ?, second_name = ?, last_name = ?, organisation_name = ?,
                    phone_number = ?, email = ?, location = ?, installation_date = ?,
                    payment_per_month = ?, account_number = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    firstName, secondName || null, lastName, organisationName || null,
                    phoneNumber, email.toLowerCase(), location, installationDate,
                    parseFloat(paymentPerMonth), accountNumber,
                    customerId
                ]
            );

            logAdminAction(req.admin.id, 'CUSTOMER_UPDATED', `Admin ${req.admin.name} updated details for customer ID: ${customerId}`, 'customer', customerId, req.ip);
            req.flash('success_msg', '✨ Update Successful! ✨ Customer details updated successfully! 🎉');
            res.redirect(`/admin/customers/view/${customerId}`);

        } catch (err) {
            console.error("Error updating customer:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to update customer details. ${err.message} 😔`);
            res.redirect(`/admin/customers/edit/${customerId}`);
        }
    },

    // Render manage customer payments page
    renderManageCustomerPaymentsPage: async (req, res) => {
        const { customerId } = req.params;
        try {
            const customer = await db.getAsync("SELECT * FROM customers WHERE id = ?", [customerId]);
            if (!customer) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }
            const paymentLogs = await db.allAsync(
                "SELECT * FROM customer_payment_logs WHERE customer_id = ? ORDER BY payment_date DESC, created_at DESC",
                [customerId]
            );
            res.render('pages/admin/customers/manage-payments', {
                title: `Manage Payments for ${customer.first_name} ${customer.last_name || customer.organisation_name || ''}`,
                admin: req.admin,
                customer,
                paymentLogs,
                errors: [] // For manual payment form
            });
        } catch (err) {
            console.error("Error fetching customer payments for admin:", err);
            req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t retrieve payment information. ${err.message} 😔`);
            res.redirect(`/admin/customers/view/${customerId}`);
        }
    },

    // Log a manual payment by admin
    logManualPayment: async (req, res) => {
        const { customerId } = req.params;
        const { amount, payment_date, payment_mode, notes } = req.body;
        const adminId = req.admin.id;

        // Basic validation
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            req.flash('error_msg', '⚠️ Invalid payment amount.');
            return res.redirect(`/admin/customers/${customerId}/payments`);
        }
        if (!payment_date) { // Further date validation can be added
            req.flash('error_msg', '⚠️ Payment date is required.');
            return res.redirect(`/admin/customers/${customerId}/payments`);
        }
        if (!payment_mode || payment_mode.trim() === '') {
            req.flash('error_msg', '⚠️ Payment mode is required.');
            return res.redirect(`/admin/customers/${customerId}/payments`);
        }

        try {
            const customer = await db.getAsync("SELECT id, current_balance FROM customers WHERE id = ?", [customerId]);
            if (!customer) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }

            const paidAmount = parseFloat(amount);

            // Use a transaction if possible, though sqlite3 with async/await makes it tricky without a wrapper
            // For now, sequential operations:
            await db.runAsync(
                `INSERT INTO customer_payment_logs
                 (customer_id, payment_date, payment_mode, amount_paid, notes_by_admin, verified_by_admin_id, verified_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [customerId, payment_date, payment_mode, paidAmount, notes || null, adminId]
            );

            const newBalance = customer.current_balance - paidAmount;
            await db.runAsync(
                "UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [newBalance, customerId]
            );

            logAdminAction(adminId, 'CUSTOMER_PAYMENT_LOGGED', `Admin ${adminId} logged payment of ${paidAmount} for customer ID ${customerId}. Mode: ${payment_mode}`, 'customer_payment', null, req.ip); // `result.lastID` from payment log insert could be used
            req.flash('success_msg', '✨ Success! ✨ Manual payment logged successfully! Customer balance updated. 🎉');
            res.redirect(`/admin/customers/${customerId}/payments`);

        } catch (err) {
            console.error("Error logging manual payment:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to log payment. ${err.message} 😔`);
            res.redirect(`/admin/customers/${customerId}/payments`);
        }
    },

    // Verify a customer-submitted payment
    verifyCustomerPayment: async (req, res) => {
        const { customerId, paymentLogId } = req.params;
        const { verified_amount } = req.body; // Admin confirms the amount
        const adminId = req.admin.id;

        if (!verified_amount || isNaN(parseFloat(verified_amount)) || parseFloat(verified_amount) <= 0) {
            req.flash('error_msg', '⚠️ Verified amount is required and must be a positive number.');
            return res.redirect(`/admin/customers/${customerId}/payments`);
        }

        try {
            const paymentLog = await db.getAsync("SELECT * FROM customer_payment_logs WHERE id = ? AND customer_id = ?", [paymentLogId, customerId]);
            if (!paymentLog) {
                req.flash('error_msg', '⚠️ Payment log not found.');
                return res.redirect(`/admin/customers/${customerId}/payments`);
            }
            if (paymentLog.verified_at) {
                req.flash('info_msg', 'ℹ️ This payment has already been verified.');
                return res.redirect(`/admin/customers/${customerId}/payments`);
            }

            const customer = await db.getAsync("SELECT id, current_balance FROM customers WHERE id = ?", [customerId]);
            if (!customer) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }

            const actualAmountPaid = parseFloat(verified_amount);

            await db.runAsync(
                `UPDATE customer_payment_logs
                 SET amount_paid = ?, verified_by_admin_id = ?, verified_at = CURRENT_TIMESTAMP, notes_by_admin = COALESCE(notes_by_admin, '') || '\nVerified by admin on ' || strftime('%Y-%m-%d %H:%M:%S', 'now')
                 WHERE id = ?`,
                [actualAmountPaid, adminId, paymentLogId]
            );

            const newBalance = customer.current_balance - actualAmountPaid;
            await db.runAsync(
                "UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [newBalance, customerId]
            );

            logAdminAction(adminId, 'CUSTOMER_PAYMENT_VERIFIED', `Admin ${adminId} verified payment (Log ID: ${paymentLogId}, Amount: ${actualAmountPaid}) for customer ID ${customerId}.`, 'customer_payment', paymentLogId, req.ip);
            req.flash('success_msg', '✨ Update Successful! ✨ Payment verified and customer balance updated! 🎉');
            res.redirect(`/admin/customers/${customerId}/payments`);

        } catch (err) {
            console.error("Error verifying payment:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to verify payment. ${err.message} 😔`);
            res.redirect(`/admin/customers/${customerId}/payments`);
        }
    },

    // Toggle customer's active status
    toggleCustomerActiveStatus: async (req, res) => {
        const { id } = req.params;
        const adminId = req.admin.id;

        try {
            const customer = await db.getAsync("SELECT id, first_name, last_name, organisation_name, is_active, current_balance FROM customers WHERE id = ?", [id]);
            if (!customer) {
                req.flash('error_msg', '⚠️ Customer not found.');
                return res.redirect('/admin/customers');
            }

            const newStatus = !customer.is_active;
            let newDisconnectionDate = null;
            let newGracePeriodEndsAt = null;

            if (!newStatus) { // If deactivating
                newDisconnectionDate = new Date().toISOString();
            } else { // If activating
                // If balance is positive, they might still be in a grace period or overdue.
                // This logic should ideally align with the billing cycle task.
                // For now, just activating clears immediate disconnection.
                // A more robust system would check balance before allowing activation or re-evaluate grace period.
                newDisconnectionDate = null;
                if (customer.current_balance <= 0) { // Clear grace period if they are paid up
                    newGracePeriodEndsAt = null;
                }
                // If balance is still positive, the grace_period_ends_at might need to be re-evaluated by the billing task.
            }

            await db.runAsync(
                "UPDATE customers SET is_active = ?, disconnection_date = ?, grace_period_ends_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [newStatus, newDisconnectionDate, newGracePeriodEndsAt, id]
            );

            const actionVerb = newStatus ? 'Activated' : 'Deactivated';
            const customerName = customer.organisation_name || `${customer.first_name} ${customer.last_name}`;
            logAdminAction(adminId, `CUSTOMER_STATUS_${actionVerb.toUpperCase()}`, `Admin ${adminId} ${actionVerb.toLowerCase()} customer: ${customerName} (ID: ${id})`, 'customer', id, req.ip);
            req.flash('success_msg', `✨ Update Successful! ✨ Customer ${customerName} has been ${actionVerb.toLowerCase()}. 🎉`);
            res.redirect(`/admin/customers/view/${id}`);

        } catch (err) {
            console.error("Error toggling customer status:", err);
            req.flash('error_msg', `❌ Operation Failed! ❌ Failed to toggle customer status. ${err.message} 😔`);
            res.redirect(`/admin/customers/view/${id}`);
        }
    }
};
