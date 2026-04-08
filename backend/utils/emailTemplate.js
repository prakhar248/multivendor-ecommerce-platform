// ============================================================
//  utils/emailTemplate.js — Branded HTML email wrapper
//  Supports OTP display, CTA button, and general content.
//  Branding: ShopEasy
//  Usage: emailTemplate({ title, greeting, body, otp, footer })
// ============================================================

const emailTemplate = ({ title, greeting, body, otp, ctaText, ctaUrl, footer }) => {
  const otpBlock = otp
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
        <tr>
          <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius:16px; padding:24px 48px; text-align:center;">
            <p style="margin:0 0 4px; font-size:12px; text-transform:uppercase; letter-spacing:2px; color:rgba(255,255,255,0.8); font-weight:600;">
              Your verification code
            </p>
            <p style="margin:0; font-size:36px; font-weight:800; letter-spacing:8px; color:#ffffff; font-family:'Courier New',monospace;">
              ${otp}
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 16px; font-size:13px; color:#94a3b8; text-align:center;">
        This code expires in <strong style="color:#7C3AED;">10 minutes</strong>. Do not share it with anyone.
      </p>
    `
    : "";

  const ctaBlock =
    ctaText && ctaUrl
      ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
        <tr>
          <td style="border-radius:8px; background-color:#4F46E5;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block; padding:12px 28px; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; border-radius:8px;">
              ${ctaText}
            </a>
          </td>
        </tr>
      </table>
      `
      : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding:28px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.3px;">
                🛒 ShopEasy
              </h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.75); font-size:13px; font-weight:400;">
                ${title}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${greeting ? `<p style="margin:0 0 16px; font-size:16px; font-weight:600; color:#1e293b;">${greeting}</p>` : ""}
              <div style="margin:0 0 24px; font-size:14px; line-height:1.7; color:#475569;">
                ${body}
              </div>
              ${otpBlock}
              ${ctaBlock}
            </td>
          </tr>

          ${
            footer
              ? `
          <!-- Footer Note -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="border-top:1px solid #e2e8f0; padding-top:16px; font-size:12px; line-height:1.6; color:#94a3b8;">
                ${footer}
              </div>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Brand Footer -->
          <tr>
            <td style="background-color:#f8fafc; padding:16px 32px; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#94a3b8;">
                &copy; ${new Date().getFullYear()} ShopEasy. All rights reserved.
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#cbd5e1;">
                This is an automated email. Please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = emailTemplate;
