// src/config/mailer.js
const nodemailer = require('nodemailer');

// Create a transporter object using SMTP settings from .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10), // Ensure port is an integer
    secure: parseInt(process.env.SMTP_PORT, 10) === 465, // true for 465, false for other ports like 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    // Optional: add debug and logger for development
    // logger: process.env.NODE_ENV === 'development',
    // debug: process.env.NODE_ENV === 'development'
});

// Verify connection configuration (optional, but good for startup check)
if (process.env.NODE_ENV !== 'test') { // Avoid trying to connect during tests if not needed
    transporter.verify((error, success) => {
        if (error) {
            console.error('Mailer Connection Error:', error);
        } else {
            console.log('Mailer is ready to send emails.');
        }
    });
}
/**
 * Sends an email.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} html - The HTML body of the email.
 * @param {string} [replyTo] - Optional: The email address to set as Reply-To.
 * @returns {Promise<object>} Nodemailer sendMail response object
 */
const sendEmail = async ({ to, subject, html, replyTo }) => {
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM.match(/<(.*)>/)[1]}>`,
        to: to,
        subject: subject,
        html: html, // HTML content is now expected to be pre-rendered
    };

    if (replyTo) {
        mailOptions.replyTo = replyTo;
    }

    // console.log("Attempting to send email with options:", mailOptions); // Keep for debugging if needed
    try {
        let info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s to %s', info.messageId, to);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

// New function to render EJS email template and send
const ejs = require('ejs');
const path = require('path');

const sendEmailWithTemplate = async ({ to, subject, templateName, data, replyTo }) => {
    // Construct the full path to the EJS template
    const templatePath = path.join(__dirname, '../views/emails', `${templateName}.ejs`);

    // Add siteUrl and logoUrl to data for use in template, if not already present
    const emailData = {
        ...data,
        siteUrl: process.env.FRONTEND_URL || 'http://localhost:10000',
        logoUrl: `${process.env.FRONTEND_URL || 'http://localhost:10000'}/logo.png` // Assuming logo is served
    };

    try {
        const htmlContent = await ejs.renderFile(templatePath, emailData);

        return sendEmail({ // Use the existing sendEmail function
            to,
            subject,
            html: htmlContent,
            replyTo
        });
    } catch (renderError) {
        console.error('Error rendering email template:', renderError);
        throw renderError; // Re-throw to be caught by controller
    }
};

module.exports = {
    sendEmail, // Keep original for direct HTML sending if needed elsewhere
    sendEmailWithTemplate
};
