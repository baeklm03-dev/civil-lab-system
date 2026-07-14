const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readSheet, rowsToObjects } = require('../services/sheetsService');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก username และ password' });
    }

    let user = null;

    // ตรวจสอบ local admin จาก .env ก่อน (ใช้เมื่อยังไม่ได้ตั้งค่า Google Sheets)
    if (
      process.env.LOCAL_ADMIN_USERNAME &&
      process.env.LOCAL_ADMIN_PASSWORD_HASH &&
      username === process.env.LOCAL_ADMIN_USERNAME
    ) {
      const isMatch = await bcrypt.compare(password, process.env.LOCAL_ADMIN_PASSWORD_HASH);
      if (isMatch) {
        user = {
          id: 'local-1',
          username: process.env.LOCAL_ADMIN_USERNAME,
          name: process.env.LOCAL_ADMIN_NAME || 'Admin',
          role: process.env.LOCAL_ADMIN_ROLE || 'admin',
        };
      }
    }

    // ถ้าไม่ใช่ local admin ให้อ่านจาก Google Sheet
    if (!user && process.env.USERS_SHEET_ID) {
      const rows = await readSheet(process.env.USERS_SHEET_ID, 'Users!A:F');
      const users = rowsToObjects(rows);
      const found = users.find((u) => u.username === username && u.active === 'TRUE');
      if (found) {
        const isMatch = await bcrypt.compare(password, found.password_hash);
        if (isMatch) {
          user = { id: found.id, username: found.username, name: found.name, role: found.role };
        }
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

// GET /api/auth/me — ตรวจสอบ token ปัจจุบัน
router.get('/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/logout (client ลบ token เองได้ แต่ให้มี endpoint ไว้)
router.post('/logout', authMiddleware, (req, res) => {
  res.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
});

module.exports = router;
