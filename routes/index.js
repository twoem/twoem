const express = require('express');
const router = express.Router();

// @route   GET /
// @desc    Public facing home page (assuming it exists or will be adapted)
// @access  Public
router.get('/', (req, res) => {
    // For now, let's assume you have a public home page.
    // If not, this could redirect to a portal login or a general landing page.
    // As per instructions, we are not altering public pages.
    // This route might render an existing public home page or be minimal.
    res.send('<h1>Public Home Page</h1><p>Navigate to /customer/login, /student/login, or /admin/login to see portal placeholders.</p><p><a href="/portals-nav-test">Test Portals Dropdown</a></p>');
});

// A test route to see the navbar with "Portals" dropdown
router.get('/portals-nav-test', (req, res) => {
    res.render('partials/navbar_test_page', { pageTitle: 'Navbar Test' });
});


module.exports = router;
