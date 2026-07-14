const express = require('express');
const crypto = require('crypto');
const { readSheet, appendSheet, updateSheet, rowsToObjects, ensureSheetTab, deleteSheetRow, getSheets } = require('../services/sheetsService');
const localResults = require('../services/localResults');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const SHEET_NAME = 'TestResults';
const HEADER = [
  'resultId', 'workOrderId', 'testType', 'specNo',
  'col1', 'col2', 'col3', 'col4', 'col5', 'col6', 'col7', 'col8', 'col9', 'col10', 'col11',
  'createdAt', 'createdBy',
];
const RANGE = `${SHEET_NAME}!A:Q`;

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
  return localResults.getAll();
}

// GET /api/results?workOrderId=
router.get('/', authMiddleware, async (req, res) => {
  try {
    let list = await getAll();
    const { workOrderId } = req.query;
    if (workOrderId) list = list.filter((r) => r.workOrderId === workOrderId);
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงผลทดสอบ' });
  }
});

// POST /api/results  { workOrderId, testType, specimens: [...] }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { workOrderId, testType, specimens } = req.body;
    if (!workOrderId || !Array.isArray(specimens) || !specimens.length) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ workOrderId และรายการผลทดสอบ' });
    }

    const now = new Date().toISOString();
    const created = specimens.map((sp, i) => ({
      resultId: crypto.randomUUID(),
      workOrderId,
      testType: testType || '',
      specNo: sp.specNo != null ? String(sp.specNo) : String(i + 1),
      col1: sp.col1 || '', col2: sp.col2 || '', col3: sp.col3 || '', col4: sp.col4 || '',
      col5: sp.col5 || '', col6: sp.col6 || '', col7: sp.col7 || '', col8: sp.col8 || '',
      col9: sp.col9 || '', col10: sp.col10 || '', col11: sp.col11 || '',
      createdAt: now,
      createdBy: req.user.name,
    }));

    if (useSheets()) {
      await ensureTab();
      const rows = created.map((r) => HEADER.map((h) => r[h]));
      await appendSheet(process.env.SPREADSHEET_ID, RANGE, rows);
    } else {
      created.forEach((r) => localResults.append(r));
    }

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create results error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึกผลทดสอบ' });
  }
});

// PUT /api/results/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const fields = {};
    for (let i = 1; i <= 11; i++) {
      const key = `col${i}`;
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }

    if (useSheets()) {
      const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบผลทดสอบนี้' });
      const existing = headers.reduce((o, h, i) => { o[h] = dataRows[rowIndex][i] ?? ''; return o; }, {});
      const merged = { ...existing, ...fields };
      const sheetRow = rowIndex + 2;
      await updateSheet(process.env.SPREADSHEET_ID, `${SHEET_NAME}!A${sheetRow}:Q${sheetRow}`, [HEADER.map((h) => merged[h] ?? '')]);
    } else {
      const updated = localResults.updateOne(req.params.id, fields);
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบผลทดสอบนี้' });
    }

    res.json({ success: true, message: 'อัปเดตผลทดสอบสำเร็จ' });
  } catch (err) {
    console.error('Update result error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE /api/results/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (useSheets()) {
      const rows = await readSheet(process.env.SPREADSHEET_ID, RANGE);
      const [, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบผลทดสอบนี้' });
      await deleteSheetRow(process.env.SPREADSHEET_ID, SHEET_NAME, rowIndex + 2);
    } else {
      const ok = localResults.deleteOne(req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบผลทดสอบนี้' });
    }

    res.json({ success: true, message: 'ลบผลทดสอบสำเร็จ' });
  } catch (err) {
    console.error('Delete result error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
