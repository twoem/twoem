const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    });

    // Configs from .env
    const emailLogoUrl = process.env.LOGO_URL_EMAIL || 'https://twoemcyberkagwe.onrender.com/logo.png';
    const websiteUrl = process.env.WEBSITE_URL || 'https://twoemcyberkagwe.onrender.com';
    const contactUsEmail = process.env.CONTACT_US_EMAIL || 'twoemcyber@gmail.com';
    const whatsappLink = 'https://wa.me/254707330204?text=Hello%20Madam,%20I%20need%20your%20assistance';

    // Email body (HTML)
    const emailMainContent = `
        <div style="padding: 20px;">
            <h2 style="text-align: center; color: #0e1e25;">Welcome to Twoem Online Productions</h2>
            <p style="text-align: center;">We’re thrilled to serve you! Here's what we offer:</p>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #0d47a1;">🖥️ Web Solutions</h3>
                <p style="margin: 5px 0 0;">Professional websites tailored to your brand and business goals.</p>
            </div>

            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #e65100;">🔐 Cybersecurity Services</h3>
                <p style="margin: 5px 0 0;">Keeping your digital assets safe, always.</p>
            </div>

            <div style="background: #fce4ec; padding: 15px; border-radius: 8px;">
                <h3 style="margin: 0; color: #ad1457;">📞 Tech Support</h3>
                <p style="margin: 5px 0 0;">Quick, expert help whenever you need it.</p>
            </div>

            <!-- WhatsApp CTA -->
            <div style="text-align:center; margin: 20px 0;">
                <a href="${whatsappLink}" style="display:inline-block; background:#25D366; color:white; padding:10px 20px; border-radius:5px; text-decoration:none; font-weight:bold;">
                    💬 Message Us on WhatsApp
                </a>
            </div>

            <!-- Website CTA -->
            <div style="text-align:center; margin: 10px 0;">
                <a href="${websiteUrl}" target="_blank" style="display:inline-block; background:#007bff; color:white; padding:10px 20px; border-radius:5px; text-decoration:none; font-weight:bold;">
                    🌐 Visit Our Website
                </a>
            </div>
        </div>
    `;

    // Footer
    const emailHtmlFooter = `
        <hr style="margin: 30px 0;">
        <div style="text-align: center; padding: 10px;">
            <img src="${emailLogoUrl}" alt="Twoem Logo" style="max-height: 50px; margin-bottom: 10px;" />
            <p style="margin: 5px 0; font-size: 12px; color: #555;">
                Need help? <a href="mailto:${contactUsEmail}" style="color: #007bff;">Contact Us</a>
            </p>
            <p style="margin: 5px 0; font-size: 12px; color: #555;">
                Visit our website: <a href="${websiteUrl}" target="_blank" style="color: #007bff;">${websiteUrl.replace(/^https?:\/\//, '')}</a>
            </p>
            <p style="margin: 15px auto; font-size: 10px; max-width: 90%; color: #888;">
                🔒 <strong>Confidential Notice:</strong> This message is strictly confidential and intended only for the recipient.
                If you received it in error, please notify the sender and delete it immediately.
            </p>
            <p style="font-size: 10px; color: #888;">&copy; ${new Date().getFullYear()} Twoem Online Productions. All rights reserved.</p>
        </div>
    `;

    // Plain Text fallback
    const plainTextBody = `==============================
Welcome to Twoem Online Productions
==============================

We’re thrilled to serve you! Here's what we offer:

🖥️ Web Solutions
Professional websites tailored to your brand and business goals.

🔐 Cybersecurity Services
Keeping your digital assets safe, always.

📞 Tech Support
Quick, expert help whenever you need it.

💬 Message Us on WhatsApp
👉 [Click here to message us]
${whatsappLink}

🌐 Visit Our Website
👉 [Explore our site]
${websiteUrl}

--------------------------------------------------

Need help? Email us at: ${contactUsEmail}

🔒 Confidential Notice:
This message is strictly confidential and intended only for the recipient.
If you received it in error, please notify the sender and delete it immediately.

© ${new Date().getFullYear()} Twoem Online Productions. All rights reserved.
`;

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"Twoem Online Productions" <noreply@twoemcyberkagwe.com>',
        to: options.to,
        subject: options.subject,
        text: options.text || plainTextBody,
        html: `
            <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: white; border-radius: 10px; overflow: hidden;">
                    ${options.html || ''}
                    ${emailMainContent}
                    ${emailHtmlFooter}
                </div>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
};

module.exports = sendEmail;
