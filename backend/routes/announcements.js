const express = require('express');
const crypto = require('crypto');
const { readSheet, appendSheet, updateSheet, rowsToObjects, ensureSheetTab, deleteSheetRow, getSheets } = require('../services/sheetsService');
const localAnnouncements = require('../services/localAnnouncements');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
const SHEET_NAME = 'Announcements';
const HEADER = ['announcementId', 'label', 'content', 'active', 'createdAt'];
const RANGE = `${SHEET_NAME}!A:E`;

const useSheets = () => !!process.env.SPREADSHEET_ID;

async function ensureTab() {
  const sheets = await getSheets();
  await ensureSheetTab(sheets, process.env.SPREADSHEET_ID, SHEET_NAME, [HEADER]);
}

async function getAll() {
  if (useSheets()) {
    await ensureTab();
    const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
    return rowsToObjects(rows);
  }
  return localAnnouncements.getAll();
}

// ── GET /api/announcements?activeOnly=true ─────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { activeOnly = 'true' } = req.query;
    let list = await getAll();
    if (activeOnly === 'true') list = list.filter((a) => String(a.active).toLowerCase() === 'true');
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('Get announcements error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงประกาศ' });
  }
});

// ── POST /api/announcements ────────────────────────────────
router.post('/', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { label, content } = req.body;
    if (!label || !content) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกหัวข้อและเนื้อหาประกาศ' });
    }

    const record = {
      announcementId: crypto.randomUUID(),
      label,
      content,
      active: 'true',
      createdAt: new Date().toISOString(),
    };

    if (useSheets()) {
      await ensureTab();
      await appendSheet(process.env.SPREADSHEET_ID, RANGE, [HEADER.map((h) => record[h])]);
    } else {
      localAnnouncements.append(record);
    }

    res.status(201).json({ success: true, data: record });
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างประกาศ' });
  }
});

// ── PUT /api/announcements/:id ─────────────────────────────
router.put('/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { label, content } = req.body;
    if (!label || !content) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกหัวข้อและเนื้อหาประกาศ' });
    }

    if (useSheets()) {
      const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบประกาศนี้' });
      const existing = headers.reduce((o, h, i) => { o[h] = dataRows[rowIndex][i] ?? ''; return o; }, {});
      const merged = { ...existing, label, content };
      await updateSheet(process.env.SPREADSHEET_ID, `${SHEET_NAME}!A${rowIndex + 2}:E${rowIndex + 2}`, [HEADER.map((h) => merged[h] ?? '')]);
    } else {
      const updated = localAnnouncements.updateOne(req.params.id, { label, content });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบประกาศนี้' });
    }

    res.json({ success: true, message: 'อัปเดตประกาศสำเร็จ' });
  } catch (err) {
    console.error('Update announcement error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── PATCH /api/announcements/:id/status ────────────────────
router.patch('/:id/status', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { active } = req.body;
    const activeVal = active ? 'true' : 'false';

    if (useSheets()) {
      const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบประกาศนี้' });
      const activeCol = headers.indexOf('active');
      const colLetter = String.fromCharCode(65 + activeCol);
      await updateSheet(process.env.SPREADSHEET_ID, `${SHEET_NAME}!${colLetter}${rowIndex + 2}`, [[activeVal]]);
    } else {
      const updated = localAnnouncements.updateOne(req.params.id, { active: activeVal });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบประกาศนี้' });
    }

    res.json({ success: true, data: { active: activeVal } });
  } catch (err) {
    console.error('Toggle announcement status error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── DELETE /api/announcements/:id ───────────────────────────
router.delete('/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    if (useSheets()) {
      const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
      const [, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบประกาศนี้' });
      await deleteSheetRow(process.env.SPREADSHEET_ID, SHEET_NAME, rowIndex + 2);
    } else {
      const ok = localAnnouncements.deleteOne(req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบประกาศนี้' });
    }

    res.json({ success: true, message: 'ลบประกาศสำเร็จ' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
