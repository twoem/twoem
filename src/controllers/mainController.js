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

// Renders the admin login page
const renderAdminLoginPage = (req, res) => {
    // Flash messages (success_msg, error_msg, error) are available via res.locals due to global middleware
    res.render('pages/admin-login', {
        title: 'Admin Login'
    });
};

// Renders the student login page
const renderStudentLoginPage = (req, res) => {
    // Flash messages and activeTab (if set by a redirect to here with query param)
    res.render('pages/student-login', {
        title: 'Student Portal Login',
        activeTab: req.query.activeTab // For activating specific tab on load
    });
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

// Dashboard placeholders - these actual dashboard routes are protected and handled by their respective controllers
const renderStudentDashboardPage = (req, res) => {
    // This is likely unused as /student/dashboard is handled by studentRoutes + authStudentController
    res.render('pages/student-dashboard', { title: 'Student Dashboard', student: req.student });
};
const renderAdminDashboardPage = (req, res) => {
    // This is likely unused as /admin/dashboard is handled by adminRoutes + adminController
    res.render('pages/admin-dashboard', { title: 'Admin Dashboard', admin: req.admin });
};

const renderDataProtectionPage = (req, res) => {
    res.render('pages/data-protection', { title: 'Data Protection Policy' /* process removed, pass env vars specifically if needed */ });
};

const renderGalleryPage = (req, res) => {
    res.render('pages/gallery', { title: 'Gallery' });
};

module.exports = {
    renderHomePage,
    renderContactPage,
    handleContactForm,
    renderAdminLoginPage,
    renderStudentLoginPage,
    renderServicesPage,
    renderDownloadsPage,
    renderStudentDashboardPage, // These might be dead code if dashboards are fully handled by auth controllers
    renderAdminDashboardPage,   //
    renderDataProtectionPage,
    renderGalleryPage,
};
