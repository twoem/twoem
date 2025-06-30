const db = require('../config/database');
const { sendEmail } = require('../config/mailer'); // For payment notification to admin

// Render customer dashboard
const renderDashboard = async (req, res) => {
    try {
        const customerId = req.customer.id; // Populated by authCustomer middleware
        const customer = await db.getAsync("SELECT id, first_name, second_name, last_name, organisation_name, phone_number, email, location, installation_date, payment_per_month, account_number, current_balance, disconnection_date, grace_period_ends_at FROM customers WHERE id = ?", [customerId]);

        if (!customer) {
            req.flash('error_msg', '⚠️ Customer profile not found.');
            return res.redirect('/customer/login');
        }

        // Calculate disconnection date if applicable (basic example)
        // More sophisticated logic will be needed based on billing cycle and grace period.
        let calculatedDisconnectionDate = customer.disconnection_date;
        let gracePeriodMessage = null;

        if (customer.current_balance > 0) { // Customer owes money
            const today = new Date();
            // This is a simplified logic. Real logic would involve checking last payment date, billing cycle (1st of month)
            // and grace period (7 days after 1st if not paid).
            // For now, if balance > 0, let's assume they are in grace period or past due.
            // A proper implementation would require a scheduled job to update balances and disconnection dates.

            // Example: If today is past the 7th of the month and balance is positive, they might be disconnected.
            // const gracePeriodEnd = new Date(today.getFullYear(), today.getMonth(), 7);
            // if (today > gracePeriodEnd && !calculatedDisconnectionDate) {
            //    calculatedDisconnectionDate = new Date(today.getFullYear(), today.getMonth(), 8).toISOString().split('T')[0]; // Disconnect on 8th
            // } else if (today <= gracePeriodEnd) {
            //    gracePeriodMessage = `Payment due. Grace period ends on ${gracePeriodEnd.toLocaleDateString()}.`;
            // }
        }


        res.render('pages/customer/dashboard', { // Path: views/pages/customer/dashboard.ejs
            title: 'My Dashboard',
            customer: req.customer, // from auth middleware (contains basic info)
            profile: customer, // from DB (contains detailed info)
            calculatedDisconnectionDate: calculatedDisconnectionDate,
            gracePeriodMessage: gracePeriodMessage,
            // errors: [],
            // success_msg: req.flash('success_msg') // Handled by global flash
        });
    } catch (err) {
        console.error("Error rendering customer dashboard:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load dashboard information. ${err.message} 😔`);
        res.redirect('/customer/login'); // Redirect to login, as dashboard is critical
    }
};

// Render internet subscription status page
const renderSubscriptionStatus = async (req, res) => {
    try {
        const customerId = req.customer.id;
        const customer = await db.getAsync("SELECT account_number, current_balance, disconnection_date, grace_period_ends_at FROM customers WHERE id = ?", [customerId]);
        const paymentLogs = await db.allAsync("SELECT payment_date, payment_mode, amount_paid, transaction_code, verified_at FROM customer_payment_logs WHERE customer_id = ? ORDER BY payment_date DESC", [customerId]);

        if (!customer) {
            req.flash('error_msg', '⚠️ Customer profile not found.');
            return res.redirect('/customer/login'); // Or dashboard if more appropriate contextually
        }

        // Similar logic for disconnection date as in dashboard can be applied here or refined.

        res.render('pages/customer/subscription-status', { // Path: views/pages/customer/subscription-status.ejs
            title: 'My Subscription Status',
            customer: req.customer,
            accountDetails: customer,
            paymentLogs: paymentLogs,
            // calculatedDisconnectionDate, gracePeriodMessage can be passed here too
        });
    } catch (err) {
        console.error("Error rendering subscription status:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load subscription details. ${err.message} 😔`);
        res.redirect('/customer/dashboard');
    }
};

// Render make payment page (shows instructions and a form to submit M-PESA code)
const renderMakePaymentPage = async (req, res) => {
     try {
        const customerId = req.customer.id;
        const customer = await db.getAsync("SELECT account_number, current_balance, first_name, last_name, phone_number FROM customers WHERE id = ?", [customerId]);

        if (!customer) {
            req.flash('error_msg', '⚠️ Customer profile not found.');
            return res.redirect('/customer/dashboard');
        }

        res.render('pages/customer/make-payment', { // Path: views/pages/customer/make-payment.ejs
            title: 'Make a Payment',
            customer: req.customer, // from auth
            accountDetails: customer, // from DB
            businessNo: process.env.BUSINESS_NO || 'YOUR_PAYBILL_HERE', // From .env
            // errors: []
        });
    } catch (err) {
        console.error("Error rendering make payment page:", err);
        req.flash('error_msg', `⚠️ Failed to Load Data! We couldn’t load payment page. ${err.message} 😔`);
        res.redirect('/customer/dashboard');
    }
};

// Handle submission of M-PESA transaction code
const handlePaymentNotification = async (req, res) => {
    const { transactionCode, accountNumber, amountDue } = req.body; // amountDue is just for email context
    const customerId = req.customer.id;

    if (!transactionCode) {
        req.flash('error_msg', '⚠️ M-PESA transaction code is required.');
        return res.redirect('/customer/make-payment');
    }

    try {
        const customer = await db.getAsync("SELECT first_name, last_name, phone_number, email, account_number, current_balance FROM customers WHERE id = ?", [customerId]);
        if (!customer) {
            req.flash('error_msg', '⚠️ Customer not found.'); // Should ideally not happen if logged in
            return res.redirect('/customer/make-payment');
        }

        // Log the UNVERIFIED payment attempt
        await db.runAsync(
            `INSERT INTO customer_payment_logs (customer_id, payment_date, payment_mode, amount_paid, transaction_code, verified_by_admin_id, verified_at)
             VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, NULL, NULL)`,
            [customerId, 'M-Pesa (Pending Verification)', 0, transactionCode] // Amount is 0 until admin verifies
        );

        // Send email to admin
        const adminEmail = process.env.ADMIN_EMAIL_RECIPIENT || process.env.ADMIN1_EMAIL; // Fallback or specific admin email
        if (adminEmail) {
            try {
                const emailSubject = `M-Pesa Payment Notification - Acc: ${customer.account_number}`;
                const emailTextBody = `
A customer has submitted an M-Pesa transaction code for their internet payment.
Please verify and update their account.

Customer Name: ${customer.first_name} ${customer.last_name || ''}
Phone Number: ${customer.phone_number}
Account Number: ${customer.account_number}
Reported Account Due (before this payment): KES ${customer.current_balance.toFixed(2)}
Submitted M-Pesa Code/Message:
${transactionCode}

Please log in to the admin portal to verify this payment.
                `;
                const emailHtmlBody = `
<p>A customer has submitted an M-Pesa transaction code for their internet payment.</p>
<p>Please verify and update their account.</p>
<hr>
<p><strong>Customer Name:</strong> ${customer.first_name} ${customer.last_name || ''}</p>
<p><strong>Phone Number:</strong> ${customer.phone_number}</p>
<p><strong>Account Number:</strong> ${customer.account_number}</p>
<p><strong>Reported Account Due (before this payment):</strong> KES ${customer.current_balance.toFixed(2)}</p>
<p><strong>Submitted M-Pesa Code/Message:</strong></p>
<pre>${transactionCode}</pre>
<hr>
<p>Please log in to the admin portal to verify this payment.</p>
                `;
                await sendEmail({
                    to: adminEmail,
                    subject: emailSubject,
                    text: emailTextBody,
                    html: emailHtmlBody
                });
                req.flash('success_msg', '✅ Email Sent Successfully! 📩 Transaction code submitted. Your payment will be reflected once verified by an administrator. 🎉');
            } catch (emailError) {
                console.error("Failed to send payment notification email to admin:", emailError);
                req.flash('error_msg', `❌ Failed to Send Email ⚠️ Transaction code submitted, but notification to admin failed. Please contact support if your payment isn't reflected soon. 😔`);
            }
        } else {
            console.warn('Admin email for payment notification (ADMIN_EMAIL_RECIPIENT) not configured in .env.');
            req.flash('info_msg', 'ℹ️ Transaction code submitted. Verification will be processed. (Admin email not configured for immediate notification).');
        }

        res.redirect('/customer/internet-subscription-status');

    } catch (err) {
        console.error("Error handling payment notification:", err);
        req.flash('error_msg', `❌ Operation Failed! ❌ Failed to submit payment notification. ${err.message} 😔`);
        res.redirect('/customer/make-payment');
    }
};


// Placeholder for updating customer details by customer
const renderUpdateProfileForm = async (req, res) => {
    // TODO: Fetch customer details and render a form
};

const handleUpdateProfile = async (req, res) => {
    // TODO: Validate input and update customer details in DB
};


module.exports = {
    renderDashboard,
    renderSubscriptionStatus,
    renderMakePaymentPage,
    handlePaymentNotification,
    renderUpdateProfileForm,
    handleUpdateProfile
};
