require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    console.warn('[email] SMTP not configured — emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10
  });

  transporter.verify((err) => {
    if (err) console.error('[email] SMTP verify failed:', err.message);
    else console.log('[email] SMTP ready');
  });

  return transporter;
}

function buildResetEmail({ firstName, resetUrl, expiresMinutes = 10 }) {
  const year = new Date().getFullYear();
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#f5f5fb;font-family:'Segoe UI',Inter,system-ui,sans-serif;line-height:1.55;color:#1f1e33;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border:1px solid #e3e2f0;border-radius:10px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#222f77 0%,#3550d6 55%,#4361ee 100%);padding:32px 24px;text-align:center;">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.14);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/><path d="M22 14H2"/></svg>
        </div>
        <h1 style="margin:0;font-size:1.6rem;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Reset Your Password</h1>
        <p style="margin:8px 0 0;color:#d8d9ff;font-size:0.95rem;">PeerLink — Secure Account Recovery</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px 24px;">
        <p style="margin:0 0 16px;font-size:0.95rem;">Hi <strong>${firstName || 'there'}</strong>,</p>
        <p style="margin:0 0 20px;font-size:0.95rem;color:#5c5b73;">You requested to reset your password. Click the button below to create a new password. This link expires in <strong>${expiresMinutes} minutes</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#4361ee;color:#ffffff;border-radius:8px;font-weight:700;font-size:0.95rem;text-decoration:none;box-shadow:0 4px 14px rgba(67,97,238,0.35);transition:background 0.15s,transform 0.1s;">Reset Password</a>
        </div>
        <p style="margin:20px 0 0;font-size:0.82rem;color:#5c5b73;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="margin:8px 0 0;font-size:0.8rem;color:#4361ee;word-break:break-all;background:#f0f3ff;padding:12px;border-radius:6px;border:1px solid #cdd8fb;">${resetUrl}</p>
        <hr style="border:none;border-top:1px solid #e3e2f0;margin:24px 0;">
        <p style="margin:0;font-size:0.8rem;color:#5c5b73;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
        <p style="margin:8px 0 0;font-size:0.8rem;color:#5c5b73;">For security, this link can only be used once and will expire after ${expiresMinutes} minutes.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f8f8fd;padding:20px 24px;text-align:center;border-top:1px solid #e3e2f0;">
        <p style="margin:0 0 4px;font-size:0.75rem;color:#9697dd;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">PeerLink Peer Tutoring Platform</p>
        <p style="margin:0;font-size:0.75rem;color:#9697dd;">&copy; ${year} PeerLink. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `
Reset Your Password — PeerLink

Hi ${firstName || 'there'},

You requested to reset your password. Visit the link below to create a new password. This link expires in ${expiresMinutes} minutes.

${resetUrl}

If you didn't request this, you can safely ignore this email. Your password will remain unchanged.

For security, this link can only be used once and will expire after ${expiresMinutes} minutes.

— PeerLink Team
`;

  return { html, text };
}

async function sendEmail({ to, subject, html, text }) {
  const tx = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@peerlink.edu';

  if (!tx) {
    console.log('[email] Would send:', { to, subject, text: text.slice(0, 200) + '...' });
    return { success: true, dev: true };
  }

  try {
    const info = await tx.sendMail({ from, to, subject, html, text });
    console.log('[email] Sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendPasswordResetEmail({ email, firstName, resetUrl, expiresMinutes = 10 }) {
  const { html, text } = buildResetEmail({ firstName, resetUrl, expiresMinutes });
  return sendEmail({
    to: email,
    subject: 'Reset Your PeerLink Password',
    html,
    text
  });
}

module.exports = { sendEmail, sendPasswordResetEmail };