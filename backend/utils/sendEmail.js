// ============================================================
//  utils/sendEmail.js — Resend email utility
//  Development-only bypass: Routes all emails to DEV_EMAIL in dev mode
// ============================================================

const { Resend } = require("resend");

// Validate API key on startup
if (!process.env.RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY is not set in .env file");
  process.exit(1);
}

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

console.log("✅ Resend initialized with API key:", process.env.RESEND_API_KEY.substring(0, 10) + "...");

if (process.env.NODE_ENV === "development") {
  if (!process.env.DEV_EMAIL) {
    console.warn("⚠️  Development mode: DEV_EMAIL not set. Email routing unavailable.");
  } else {
    console.log("🔧 Development mode enabled. All emails will be routed to:", process.env.DEV_EMAIL);
  }
}

/**
 * Send an email using Resend.
 * 
 * Development Mode: Routes all emails to DEV_EMAIL
 * Production Mode: Sends to actual recipient email
 * 
 * @param {Object} options
 * @param {string} options.to      — recipient email (actual user)
 * @param {string} options.subject — email subject line
 * @param {string} options.html    — HTML body content
 * @returns {Promise<Object>}      — Resend response
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    if (!to) throw new Error("Recipient email is required");
    if (!subject) throw new Error("Email subject is required");
    if (!html) throw new Error("Email HTML content is required");

    // ── DEVELOPMENT MODE: Route to DEV_EMAIL ────────────────────
    const isDevMode = process.env.NODE_ENV === "development";
    const actualRecipient = isDevMode ? process.env.DEV_EMAIL : to;

    if (isDevMode) {
      console.log(`📧 [DEV] Intended recipient: ${to}`);
      console.log(`📧 [DEV] Routed to: ${actualRecipient}`);
    } else {
      console.log(`📧 Sending email to: ${to}`);
    }

    const response = await resend.emails.send({
      from: "ShopEasy <onboarding@resend.dev>",
      to: actualRecipient,
      subject,
      html,
    });

    if (response.error) {
      console.error("❌ Resend API Error:", JSON.stringify(response.error, null, 2));
      throw new Error(response.error.message || "Resend API error");
    }

    console.log("✅ Email sent successfully. Message ID:", response.id);
    return response;
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
    throw err;
  }
};

module.exports = sendEmail;