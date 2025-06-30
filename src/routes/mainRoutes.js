// src/routes/mainRoutes.js
const express = require('express');
const router = express.Router();
const mainController = require('../controllers/mainController');

// Home page route
router.get('/', mainController.renderHomePage);

// Contact page routes
router.get('/contact', mainController.renderContactPage);
router.post('/contact/send', mainController.handleContactForm);

// Routes for other main pages
router.get('/services', mainController.renderServicesPage);
router.get('/downloads', mainController.renderDownloadsPage);
router.get('/gallery', mainController.renderGalleryPage);
router.get('/data-protection', mainController.renderDataProtectionPage);

// Placeholder routes for dashboards - these will likely move to their own route files
// and include authentication middleware once implemented.
// For now, they are here for basic navigation structure.
router.get('/student/dashboard', mainController.renderStudentDashboardPage); // Direct access for now
router.get('/admin/dashboard', mainController.renderAdminDashboardPage);   // Direct access for now


module.exports = router;
