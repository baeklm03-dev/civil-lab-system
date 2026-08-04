const express = require('express');
const { google } = require('googleapis');
const { saveToken, hasToken } = require('../services/tokenStore');

const router = express.Router();
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google-auth/callback';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  );
}

// GET /api/google-auth/status
router.get('/status', (req, res) => {
  res.json({ connected: hasToken() });
});

// GET /api/google-auth/connect
router.get('/connect', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  });
  res.redirect(url);
});

// GET /api/google-auth/callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    saveToken(tokens);
    res.send(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#22c55e">✅ เชื่อมต่อ Google Drive สำเร็จ!</h2>
        <p>ปิดหน้าต่างนี้แล้วกลับไปใช้งานระบบได้เลย</p>
        <script>setTimeout(()=>window.close(),2000)</script>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('เกิดข้อผิดพลาด: ' + err.message);
  }
});

module.exports = { router, getOAuth2Client, REDIRECT_URI };
