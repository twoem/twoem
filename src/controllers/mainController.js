// src/controllers/mainController.js
const db = require('../config/database'); // Import database connection
const { sendEmailWithTemplate } = require('../config/mailer'); // Use sendEmailWithTemplate

// Renders the home page
const renderHomePage = (req, res) => {
    res.render('pages/home', { title: 'Home' });
};

// Renders the contact page
const renderContactPage = (req, res) => {
    res.render('pages/contact', {
        title: 'Contact Us',
        // Flash messages are now handled by global middleware,
        // so they will be available in res.locals directly in the template.
        // No need to pass message/error from query params here if using flash for POST submissions.
        // However, keeping them if some GET routes might still use query params for messages.
        message: req.query.message,
        error: req.query.error
    });
};

// Handles contact form submission
const handleContactForm = async (req, res) => {
    const { name, email: senderEmail, subject: userSubject, message: userMessage } = req.body;

    if (!name || !senderEmail || !userSubject || !userMessage) {
        req.flash('error_msg', 'Please fill in all fields.');
        return res.redirect('/contact');
    }

    const emailSubject = `New Contact Form: ${userSubject} from ${name}`;
    const emailData = {
        senderName: name,
        senderEmail: senderEmail,
        emailSubject: userSubject, // Subject as entered by user for clarity in email content
        emailMessage: userMessage,
        submissionDate: new Date().toLocaleString()
    };

    try {
        emailData.siteUrl = process.env.FRONTEND_URL || 'https://twoemcyberkagwe.onrender.com'; // Added siteUrl
        await sendEmailWithTemplate({
            to: process.env.CONTACT_RECEIVER_EMAIL,
            subject: emailSubject, // This is the subject line of the email notification itself
            templateName: 'contact-form-submission',
            data: emailData,
            replyTo: senderEmail // Correctly set to the client's email
        });

        req.flash('success_msg', 'Thank you for your message! It has been sent successfully.');
        res.redirect('/contact');
    } catch (error) {
        console.error('Failed to send contact email:', error);
        req.flash('error_msg', 'Sorry, there was an error sending your message. Please try again later.');
        res.redirect('/contact');
    }
};

const renderServicesPage = async (req, res) => {
    try {
        const courses = await db.allAsync("SELECT id, name, description FROM courses ORDER BY name ASC");
        res.render('pages/services', {
            title: 'Our Services',
            courses
        });
    } catch (err) {
        console.error("Error fetching courses for services page:", err);
        // Flash message will be shown via global middleware if set before render
        // For a direct error rendering like this, pass error_msg directly
        res.status(500).render('pages/services', {
            title: 'Our Services',
            courses: [],
            error_msg_direct: "Could not load course information at this time." // Use a different var name if needed
        });
    }
};

const renderDownloadsPage = async (req, res) => {
    try {
        const allDocuments = await db.allAsync("SELECT * FROM downloadable_documents ORDER BY type, created_at DESC");
        const publicDocs = [];
        const eulogyDocs = [];
        const now = new Date();

        allDocuments.forEach(doc => {
            if (doc.type === 'public') {
                publicDocs.push(doc);
            } else if (doc.type === 'eulogy') {
                let effectiveExpiryDate;
                if (doc.expiry_date) {
                    effectiveExpiryDate = new Date(doc.expiry_date);
                } else { // Default to 7 days from creation if no specific expiry for eulogy
                    effectiveExpiryDate = new Date(doc.created_at);
                    effectiveExpiryDate.setDate(effectiveExpiryDate.getDate() + 7);
                }
                if (effectiveExpiryDate >= now) {
                    eulogyDocs.push(doc);
                }
            }
        });
        res.render('pages/downloads', {
            title: 'Downloads',
            publicDocs,
            eulogyDocs
        });
    } catch (err) {
        console.error("Error fetching documents for downloads page:", err);
        res.status(500).render('pages/downloads', {
            title: 'Downloads',
            publicDocs: [],
            eulogyDocs: [],
            error_msg_direct: "Could not load documents at this time."
        });
    }
};

const renderDataProtectionPage = (req, res) => {
    res.render('pages/data-protection', { title: 'Data Protection Policy' /* process removed, pass env vars specifically if needed */ });
};

const renderGalleryPage = (req, res) => {
    res.render('pages/gallery', { title: 'Gallery' });
};

const handleRedirect = (req, res) => {
    const targetUrl = req.query.url;
    const docTitle = req.query.title || 'Document'; // Default title if not provided

    if (!targetUrl) {
        // Handle missing URL, perhaps redirect to downloads or show an error
        req.flash('error_msg', 'Invalid redirection link: Target URL is missing.');
        return res.redirect('/downloads');
    }

    // Basic validation for URL to prevent obviously malicious inputs (though proper validation is complex)
    // This is a very basic check. For production, consider more robust URL validation.
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        req.flash('error_msg', 'Invalid redirection link: URL must start with http:// or https://.');
        return res.redirect('/downloads');
    }

    try {
        // Attempt to parse URL to catch some malformed ones early
        new URL(targetUrl);
    } catch (e) {
        req.flash('error_msg', 'Invalid redirection link: URL is malformed.');
        return res.redirect('/downloads');
    }


    res.render('pages/redirect', {
        title: `Redirecting to ${docTitle}...`,
        docTitle: docTitle,
        targetUrl: targetUrl
    });
};

module.exports = {
    renderHomePage,
    renderContactPage,
    handleContactForm,
    renderServicesPage,
    renderDownloadsPage,
    renderDataProtectionPage,
    renderGalleryPage,
    handleRedirect,
};
