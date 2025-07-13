const Customer = require('../models/Customer');

// @desc    Get Customer Dashboard
// @route   GET /customer/dashboard
// @access  Private
exports.getCustomerDashboard = async (req, res) => {
    try {
        // req.user is populated by the 'protect' middleware
        const customer = await Customer.findById(req.user.id).select('-password');

        if (!customer) {
            // Should not happen if protect middleware is working correctly
            req.flash('error_msg', 'User not found. Please login again.');
            return res.redirect('/customer/login');
        }

        res.render('customer/dashboard', {
            pageTitle: `Twoem Customers | Dashboard - ${customer.firstName}`,
            user: customer, // Pass the full customer object to the view
            formatDate: (dateString) => { // Helper function to format dates
                if (!dateString) return 'N/A';
                const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                return new Date(dateString).toLocaleDateString(undefined, options);
            },
            formatCurrency: (amount) => { // Helper function to format currency
                 if (typeof amount !== 'number') return 'N/A';
                 return amount.toFixed(2); // Basic formatting, can be enhanced
            }
        });
    } catch (err) {
        console.error('Error fetching customer dashboard:', err);
        res.status(500).render('customer/dashboard', { // Render dashboard with error
            pageTitle: 'Twoem Customers | Dashboard',
            user: req.user, // May or may not be fully populated if error occurred mid-request
            error: 'Server error loading dashboard. Please try again later.',
            success: null,
            formatDate: (date) => date ? new Date(date).toLocaleDateString() : 'N/A',
            formatCurrency: (amount) => typeof amount === 'number' ? amount.toFixed(2) : 'N/A'
        });
    }
};

// @desc    Get Make Payment Page
// @route   GET /customer/makepayment
// @access  Private
exports.getMakePaymentPage = async (req, res) => {
    try {
        const customer = await Customer.findById(req.user.id).select('accountNumber balanceDue subscriptionPerMonth');
        if (!customer) {
            req.flash('error_msg', 'User not found. Please login again.');
            return res.redirect('/customer/login');
        }

        res.render('customer/makepayment', {
            pageTitle: 'Twoem | Subscription',
            user: customer, // Pass necessary customer details
            formatCurrency: (amount) => {
                 if (typeof amount !== 'number') return 'N/A';
                 return amount.toFixed(2);
            }
        });
    } catch (err) {
        console.error('Error fetching make payment page:', err);
        req.flash('error_msg', 'Error loading payment page.');
        res.status(500).redirect('/customer/dashboard');
    }
};

const PaymentConfirmation = require('../models/PaymentConfirmation');

// @desc    Submit Payment Confirmation
// @route   POST /customer/submit-payment-confirmation
// @access  Private
exports.submitPaymentConfirmation = async (req, res) => {
    const { mpesaConfirmationCode, amountPaid } = req.body;
    const customerId = req.user.id;

    // Basic validation
    if (!mpesaConfirmationCode || !amountPaid) {
        req.flash('error_msg', 'M-Pesa code and amount are required.');
        return res.status(400).redirect('/customer/makepayment');
    }
    if (isNaN(parseFloat(amountPaid)) || parseFloat(amountPaid) <= 0) {
        req.flash('error_msg', 'Invalid amount paid.');
        return res.status(400).redirect('/customer/makepayment');
    }
    // M-Pesa code basic format check (alphanumeric, typical length)
    if (!/^[A-Z0-9]{10,15}$/i.test(mpesaConfirmationCode)) { // Case-insensitive check, will be uppercased by model
        req.flash('error_msg', 'Invalid M-Pesa confirmation code format.');
        return res.status(400).redirect('/customer/makepayment');
    }


    try {
        // Optional: Check if this exact M-Pesa code from this customer is already pending/verified
        const existingConfirmation = await PaymentConfirmation.findOne({
            customer: customerId,
            mpesaConfirmationCode: mpesaConfirmationCode.toUpperCase(),
            status: { $in: ['Pending Verification', 'Verified'] }
        });

        if (existingConfirmation) {
            let message = 'This M-Pesa confirmation code has already been submitted and is ';
            message += existingConfirmation.status === 'Pending Verification' ? 'pending verification.' : 'already verified.';
            req.flash('error_msg', message);
            return res.status(400).redirect('/customer/makepayment');
        }

        const newConfirmation = new PaymentConfirmation({
            customer: customerId,
            mpesaConfirmationCode: mpesaConfirmationCode, // Will be uppercased by model
            amountPaid: parseFloat(amountPaid),
            status: 'Pending Verification'
        });

        await newConfirmation.save();

        req.flash('success_msg', 'Payment confirmation submitted successfully! Your account will be updated once payment is verified by an admin.');
        res.redirect('/customer/dashboard');

    } catch (err) {
        console.error('Error submitting payment confirmation:', err);
        let errorMessage = 'Server error submitting payment confirmation. Please try again.';
        if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(e => e.message).join(', ');
        }
        req.flash('error_msg', errorMessage);
        res.status(500).redirect('/customer/makepayment');
    }
};
