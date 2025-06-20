const { sendEmail } = require('../utils/emailService');
const { validationResult } = require('express-validator');

exports.showContactForm = (req, res) => {
    res.render('contact', {
        title: 'Twoem | Contact',
        currentPage: 'contact'
    });
};

exports.submitContactForm = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.render('contact', {
            title: 'Twoem | Contact',
            errors: errors.array(),
            formData: req.body
        });
    }

    const { name, email, subject, message } = req.body;

    try {
        await sendEmail({
            to: process.env.EMAIL_USER,
            subject: `Contact Form: ${subject || 'No Subject'}`,
            text: `From: ${name} <${email}>\n\n${message}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
                ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
            `
        });

        res.redirect('/contact-success');
    } catch (error) {
        console.error('Contact form error:', error);
        res.render('contact', {
            title: 'Twoem | Contact',
            error: 'Failed to send message. Please try again.',
            formData: req.body
        });
    }
};

exports.showContactSuccess = (req, res) => {
    res.render('contact-success', {
        title: 'Twoem | Message Sent'
    });
};
