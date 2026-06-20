const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = {};

// ── Gmail transporter ──────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ── Helper: generate 6-digit OTP ──────────────────────────────────────────
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Helper: clean expired OTPs ────────────────────────────────────────────
function cleanExpired() {
  const now = Date.now();
  for (const email in otpStore) {
    if (otpStore[email].expiresAt < now) delete otpStore[email];
  }
}

// ── POST /send-otp ─────────────────────────────────────────────────────────
app.post('/send-otp', async (req, res) => {
  cleanExpired();
  const { email } = req.body;

  if (!email || !email.endsWith('@aurumanalytica.in')) {
    return res.status(400).json({ success: false, message: 'Only @aurumanalytica.in emails allowed.' });
  }

  const otp = generateOTP();
  otpStore[email] = { otp, expiresAt: Date.now() + 2 * 60 * 1000 }; // 2 min

  const userName = email.split('@')[0];
  const mailOptions = {
    from: `"Aurum Analytica" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Your Aurum Analytica Login OTP',
    html: `
      <div style="font-family:Calibri,Arial,sans-serif;max-width:480px;margin:0 auto;background:#f4f6fb;padding:32px 24px;border-radius:16px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:22px;font-weight:800;color:#0f2a4a;letter-spacing:-0.5px">Aurum Analytica</div>
          <div style="font-size:13px;color:#6b7a9a;margin-top:4px">Leads Intelligence Platform</div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px 24px;border:1px solid #dde3ef">
          <p style="font-size:15px;color:#1a2540;margin:0 0 8px">Hi <strong>${userName}</strong>,</p>
          <p style="font-size:13px;color:#6b7a9a;margin:0 0 24px;line-height:1.6">
            Your one-time login OTP for Aurum Analytica is:
          </p>
          <div style="background:#0f2a4a;border-radius:10px;padding:18px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:800;color:#fff;letter-spacing:10px">${otp}</span>
          </div>
          <p style="font-size:12px;color:#6b7a9a;margin:0;line-height:1.6">
            ⏱ This OTP is valid for <strong>2 minutes</strong>.<br>
            🔒 Do not share this OTP with anyone.
          </p>
        </div>
        <p style="font-size:11px;color:#9aa5b8;text-align:center;margin-top:20px">
          © Aurum Analytica · Developed by Manish Maurya
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[OTP] Sent to ${email}`);
    res.json({ success: true, message: 'OTP sent successfully.' });
  } catch (err) {
    console.error('[OTP] Send failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Check server config.' });
  }
});

// ── POST /verify-otp ───────────────────────────────────────────────────────
app.post('/verify-otp', (req, res) => {
  cleanExpired();
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP required.' });
  }

  const record = otpStore[email];

  if (!record) {
    return res.status(400).json({ success: false, message: 'OTP expired or not found. Please resend.' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ success: false, message: 'Incorrect OTP. Please try again.' });
  }

  // OTP correct — delete it (one-time use)
  delete otpStore[email];
  console.log(`[OTP] Verified for ${email}`);
  res.json({ success: true, message: 'OTP verified.' });
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Aurum OTP Server running ✓' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Aurum OTP Server started on port ${PORT}\n`);
});
