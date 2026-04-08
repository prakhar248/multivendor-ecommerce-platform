// ============================================================
//  utils/sendEmail.js — Nodemailer email utility
//  Uses Gmail SMTP for transactional emails.
// ============================================================

const nodemailer = require("nodemailer");

// Create reusable transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email using Nodemailer.
 * @param {Object} options
 * @param {string} options.to      — recipient email
 * @param {string} options.subject — email subject line
 * @param {string} options.html    — HTML body content
 * @returns {Promise<Object>}      — Nodemailer response
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"ShopEasy" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Email error:", err.message);

    // In development, don't throw — just log the error
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️  Email failed in dev mode — continuing without sending.");
      return null;
    }

    throw err;
  }
};

module.exports = sendEmail;