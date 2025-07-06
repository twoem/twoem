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

// Route for download redirection
router.get('/redirect', mainController.handleRedirect);

// All Portal Routes have been removed as per the requirement.

module.exports = router;
