const express = require('express');
const { readSheet, rowsToObjects } = require('../services/sheetsService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { SHEET_NAME, RANGE } = require('../services/activityLog');

const router = express.Router();

async function getAllLogs() {
  if (!process.env.SPREADSHEET_ID) return []; // logging only meaningful once a master spreadsheet is configured
  try {
    const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
    return rowsToObjects(rows);
  } catch {
    return []; // tab doesn't exist yet — no activity logged so far
  }
}

function filterLogs(logs, { startDate, endDate, userId, action }) {
  return logs.filter((l) => {
    if (startDate && l.timestamp.slice(0, 10) < startDate) return false;
    if (endDate && l.timestamp.slice(0, 10) > endDate) return false;
    if (userId && l.userId !== userId) return false;
    if (action && l.action !== action) return false;
    return true;
  });
}

// ── GET /api/admin/logs ─────────────────────────────────────
router.get('/', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    const { startDate, endDate, userId, action, page = 1, limit = 50 } = req.query;
    let logs = await getAllLogs();
    logs = filterLogs(logs, { startDate, endDate, userId, action });
    logs = [...logs].reverse(); // newest first

    const total = logs.length;
    const start = (Number(page) - 1) * Number(limit);
    const paginated = logs.slice(start, start + Number(limit));

    res.json({ success: true, data: paginated, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึง log' });
  }
});

// ── GET /api/admin/logs/export ─────────────────────────────
router.get('/export', authMiddleware, requireRole('superadmin'), async (req, res) => {
  try {
    const { startDate, endDate, userId, action } = req.query;
    let logs = await getAllLogs();
    logs = filterLogs(logs, { startDate, endDate, userId, action });

    const headers = ['timestamp', 'userId', 'username', 'action', 'detail', 'ipAddress'];
    const csvBody = [headers, ...logs.map((l) => headers.map((h) => l[h] ?? ''))]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="system-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('﻿' + csvBody);
  } catch (err) {
    console.error('Export logs error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการ export log' });
  }
});

module.exports = router;
