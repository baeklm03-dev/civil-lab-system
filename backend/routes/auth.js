const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readSheet, rowsToObjects } = require('../services/sheetsService');
const localUsers = require('../services/localUsers');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activityLog');

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

    // ถ้าไม่ใช่ local admin ให้ตรวจสอบจากตาราง Users (Google Sheet ถ้าตั้งค่าไว้ ไม่งั้น local JSON fallback)
    // schema: userId | username | passwordHash | fullName | role | status | createdAt | lastLogin
    if (!user) {
      let users;
      if (process.env.USERS_SHEET_ID) {
        const rows = await readSheet(process.env.USERS_SHEET_ID, 'Users!A:H');
        users = rowsToObjects(rows);
      } else {
        users = localUsers.getAll();
      }
      const found = users.find((u) => u.username === username && u.status === 'active');
      if (found) {
        const isMatch = await bcrypt.compare(password, found.passwordHash);
        if (isMatch) {
          user = { id: found.userId, username: found.username, name: found.fullName, role: found.role };
        }
      }
    }

    if (!user) {
      await logActivity('', username, 'LOGIN_FAILED', '', req.ip);
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await logActivity(user.id, user.username, 'LOGIN_SUCCESS', '', req.ip);
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
router.post('/logout', authMiddleware, async (req, res) => {
  await logActivity(req.user.id, req.user.username, 'LOGOUT', '', req.ip);
  res.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
});

module.exports = router;
