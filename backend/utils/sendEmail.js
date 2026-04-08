// ============================================================
//  utils/sendEmail.js — Resend email utility
//  Uses Resend for transactional emails.
// ============================================================

const { Resend } = require("resend");

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email using Resend.
 * @param {Object} options
 * @param {string} options.to      — recipient email
 * @param {string} options.subject — email subject line
 * @param {string} options.html    — HTML body content
 * @returns {Promise<Object>}      — Resend response
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from: "ShopEasy <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    if (response.error) {
      console.error("❌ Resend API Error:", response.error);
      throw new Error(response.error.message || "Resend API error");
    }

    console.log("✅ Email sent successfully:", response.id);
    return response;
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw err;
  }
};

module.exports = sendEmail;