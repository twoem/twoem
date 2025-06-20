const nodemailer = require('nodemailer');
const { compile } = require('ejs');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendEmail = async ({ to, subject, text, html }) => {
    try {
        if (!html) {
            // Basic HTML template if none provided
            html = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                    ${text.replace(/\n/g, '<br>')}
                    <br><br>
                    <p>Best regards,<br>Twoem Online Productions</p>
                </div>
            `;
        }

        await transporter.sendMail({
            from: `"No Reply" <${process.env.EMAIL_USER}>`,
            to,
            replyTo: 'twoemcyber@gmail.com',
            subject,
            text,
            html
        });
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

// Pre-compiled email templates
const templates = {
    welcome: compile(
        fs.readFileSync(path.join(__dirname, '../views/emails/welcome.ejs'), 'utf-8')
};

exports.sendTemplateEmail = async (templateName, data) => {
    if (!templates[templateName]) {
        throw new Error(`Template ${templateName} not found`);
    }

    const html = templates[templateName](data);
    
    return this.sendEmail({
        to: data.to,
        subject: data.subject,
        html
    });
};
