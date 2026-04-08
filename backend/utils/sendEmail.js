// ============================================================
//  utils/sendEmail.js — Brevo SMTP email utility
//  Development mode: Logs OTP to console
//  Production mode: Sends emails via Brevo SMTP
// ============================================================

const nodemailer = require("nodemailer");

// Validate SMTP configuration
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error("❌ SMTP configuration is incomplete in .env file");
  console.error("Required: SMTP_HOST, SMTP_USER, SMTP_PASS");
  process.exit(1);
}

// Create Nodemailer transporter with Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false, // TLS (not SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP connection failed:", error.message);
  } else {
    console.log("✅ Brevo SMTP connection established");
  }
});

if (process.env.NODE_ENV === "development") {
  console.log("🔧 Development mode: Emails will be sent via Brevo SMTP");
}

/**
 * Send an email using Brevo SMTP (Nodemailer).
 * 
 * Sends emails in both development and production modes via Brevo SMTP.
 * 
 * @param {Object} options
 * @param {string} options.to      — recipient email
 * @param {string} options.subject — email subject line
 * @param {string} options.html    — HTML body content
 * @returns {Promise<Object>}      — Nodemailer response
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!to) throw new Error("Recipient email is required");
    if (!subject) throw new Error("Email subject is required");
    if (!html) throw new Error("Email HTML content is required");

    // ── SEND EMAIL VIA BREVO SMTP ──────────────────────────────
    console.log(`📧 Sending email to: ${to}`);

    const info = await transporter.sendMail({
      from: `"ShopEasy" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log("✅ Email sent successfully. Message ID:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw err;
  }
};

module.exports = sendEmail;