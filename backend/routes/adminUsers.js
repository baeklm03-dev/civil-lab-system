const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body } = require('express-validator');
const { readSheet, appendSheet, updateSheet, rowsToObjects, ensureSheetTab, deleteSheetRow, getSheets } = require('../services/sheetsService');
const localUsers = require('../services/localUsers');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');
const { logActivity } = require('../services/activityLog');

const router = express.Router();
const SHEET_NAME = 'Users';
const HEADER = ['userId', 'username', 'passwordHash', 'fullName', 'role', 'status', 'createdAt', 'lastLogin'];
const RANGE = `${SHEET_NAME}!A:H`;
const USER_ROLES = ['superadmin', 'admin', 'user'];

const createUserValidators = [
  body('username').trim().notEmpty().withMessage('กรุณากรอก username'),
  body('password').isLength({ min: 6 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  body('fullName').trim().notEmpty().withMessage('กรุณากรอกชื่อ-นามสกุล'),
  body('role').isIn(USER_ROLES).withMessage(`role ต้องเป็นหนึ่งใน: ${USER_ROLES.join(', ')}`),
];
const updateUserValidators = [
  body('role').optional().isIn(USER_ROLES).withMessage(`role ต้องเป็นหนึ่งใน: ${USER_ROLES.join(', ')}`),
  body('status').optional().isIn(['active', 'inactive']).withMessage('status ต้องเป็น active หรือ inactive'),
];
const resetPasswordValidators = [
  body('newPassword').isLength({ min: 6 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
];

const useSheets = () => !!process.env.USERS_SHEET_ID;

async function ensureTab() {
  const sheets = await getSheets();
  await ensureSheetTab(sheets, process.env.USERS_SHEET_ID, SHEET_NAME, [HEADER]);
}

async function getAll() {
  if (useSheets()) {
    await ensureTab();
    const rows = await readSheet(process.env.USERS_SHEET_ID, RANGE);
    return rowsToObjects(rows);
  }
  return localUsers.getAll();
}

function stripHash(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// ── GET /api/admin/users ───────────────────────────────────
router.get('/', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    const list = await getAll();
    res.json({ success: true, data: list.map(stripHash) });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
});

// ── POST /api/admin/users ──────────────────────────────────
router.post('/', authMiddleware, requireRole('superadmin'), createUserValidators, handleValidationErrors, async (req, res) => {
  try {
    const { username, password, fullName, role, status } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const record = {
      userId: crypto.randomUUID(),
      username,
      passwordHash,
      fullName,
      role,
      status: status || 'active',
      createdAt: now,
      lastLogin: '',
    };

    if (useSheets()) {
      await ensureTab();
      await appendSheet(process.env.USERS_SHEET_ID, RANGE, [HEADER.map((h) => record[h])]);
    } else {
      localUsers.append(record);
    }

    await logActivity(req.user.id, req.user.username, 'CREATE_USER', `Username: ${username}`, req.ip);
    res.status(201).json({ success: true, data: stripHash(record) });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
  }
});

// ── PUT /api/admin/users/:id ────────────────────────────────
router.put('/:id', authMiddleware, requireRole('superadmin'), updateUserValidators, handleValidationErrors, async (req, res) => {
  try {
    const { fullName, role, status } = req.body;
    const fields = {};
    if (fullName !== undefined) fields.fullName = fullName;
    if (role !== undefined) fields.role = role;
    if (status !== undefined) fields.status = status;

    if (useSheets()) {
      const rows = await readSheet(process.env.USERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
      const existing = headers.reduce((o, h, i) => { o[h] = dataRows[rowIndex][i] ?? ''; return o; }, {});
      const merged = { ...existing, ...fields };
      await updateSheet(process.env.USERS_SHEET_ID, `${SHEET_NAME}!A${rowIndex + 2}:H${rowIndex + 2}`, [HEADER.map((h) => merged[h] ?? '')]);
    } else {
      const updated = localUsers.updateOne(req.params.id, fields);
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
    }

    await logActivity(req.user.id, req.user.username, 'UPDATE_USER', `UserId: ${req.params.id}`, req.ip);
    res.json({ success: true, message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── PATCH /api/admin/users/:id/status ──────────────────────
router.patch('/:id/status', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status ต้องเป็น active หรือ inactive' });
    }

    if (useSheets()) {
      const rows = await readSheet(process.env.USERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
      const statusCol = headers.indexOf('status');
      const colLetter = String.fromCharCode(65 + statusCol);
      await updateSheet(process.env.USERS_SHEET_ID, `${SHEET_NAME}!${colLetter}${rowIndex + 2}`, [[status]]);
    } else {
      const updated = localUsers.updateOne(req.params.id, { status });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
    }

    res.json({ success: true, data: { status } });
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── DELETE /api/admin/users/:id ─────────────────────────────
router.delete('/:id', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีของตัวเองได้' });
    }

    if (useSheets()) {
      const rows = await readSheet(process.env.USERS_SHEET_ID, RANGE);
      const [, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
      await deleteSheetRow(process.env.USERS_SHEET_ID, SHEET_NAME, rowIndex + 2);
    } else {
      const ok = localUsers.deleteOne(req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
    }

    await logActivity(req.user.id, req.user.username, 'DELETE_USER', `UserId: ${req.params.id}`, req.ip);
    res.json({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── POST /api/admin/users/:id/reset-password ───────────────
router.post('/:id/reset-password', authMiddleware, requireRole('superadmin'), resetPasswordValidators, handleValidationErrors, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (useSheets()) {
      const rows = await readSheet(process.env.USERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
      const hashCol = headers.indexOf('passwordHash');
      const colLetter = String.fromCharCode(65 + hashCol);
      await updateSheet(process.env.USERS_SHEET_ID, `${SHEET_NAME}!${colLetter}${rowIndex + 2}`, [[passwordHash]]);
    } else {
      const updated = localUsers.updateOne(req.params.id, { passwordHash });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้นี้' });
    }

    res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
