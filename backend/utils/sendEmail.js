// ============================================================
//  utils/sendEmail.js — Brevo SMTP email utility
//  Sends emails via Brevo SMTP with detailed error logging
// ============================================================

const nodemailer = require("nodemailer");

// Validate SMTP configuration
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error("❌ SMTP configuration is incomplete in .env file");
  console.error("Required: SMTP_HOST, SMTP_USER, SMTP_PASS");
  console.error("SMTP_HOST:", process.env.SMTP_HOST);
  console.error("SMTP_USER:", process.env.SMTP_USER);
  console.error("SMTP_PASS:", process.env.SMTP_PASS ? "***" : "NOT SET");
  process.exit(1);
}

console.log("📧 Brevo SMTP Configuration:");
console.log("   Host:", process.env.SMTP_HOST);
console.log("   Port:", process.env.SMTP_PORT || 587);
console.log("   User:", process.env.SMTP_USER);
console.log("   Pass: ***HIDDEN***");

// Create Nodemailer transporter with Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false, // TLS (not SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  logger: true, // Enable debug logging
  debug: true   // Enable debug output
});

// Verify SMTP connection on startup
console.log("🔍 Testing SMTP connection...");
transporter.verify()
  .then(() => {
    console.log("✅ Brevo SMTP connection successful!");
  })
  .catch((error) => {
    console.error("❌ SMTP connection test failed:");
    console.error("   Error:", error.message);
    console.error("   Code:", error.code);
    console.error("   Hostname:", error.hostname);
  });

/**
 * Send an email using Brevo SMTP (Nodemailer).
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

    console.log("\n📧 Attempting to send email...");
    console.log("   To:", to);
    console.log("   Subject:", subject);

    const info = await transporter.sendMail({
      from: `"ShopEasy" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log("✅ Email sent successfully!");
    console.log("   Message ID:", info.messageId);
    console.log("   Response:", info.response);
    return info;
  } catch (err) {
    console.error("\n❌ Email sending failed!");
    console.error("   Error Message:", err.message);
    console.error("   Error Code:", err.code);
    console.error("   Error Details:", err);
    throw err;
  }
};

module.exports = sendEmail;