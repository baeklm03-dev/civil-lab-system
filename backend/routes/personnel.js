const express = require('express');
const { readSheet, appendSheet, updateSheet, rowsToObjects } = require('../services/sheetsService');
const localPersonnel = require('../services/localPersonnel');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const SHEET_RANGE = 'Personnel!A:E';
const useSheets = () => !!process.env.PERSONNEL_SHEET_ID;

async function getAll() {
  if (useSheets()) {
    const rows = await readSheet(process.env.PERSONNEL_SHEET_ID, SHEET_RANGE);
    return rowsToObjects(rows);
  }
  return localPersonnel.getAll();
}

// GET /api/personnel
router.get('/', authMiddleware, async (req, res) => {
  try {
    let list = await getAll();
    const { role, active } = req.query;
    if (role) list = list.filter((p) => p.role === role);
    if (active !== undefined) list = list.filter((p) => String(p.active) === active);
    res.json({ success: true, data: list });
  } catch (err) {
    console.error('Get personnel error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบุคลากร' });
  }
});

// POST /api/personnel
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { fullname_en, fullname_th, role } = req.body;
    if (!fullname_th || !role) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ-นามสกุล (TH) และบทบาท' });
    }
    const id = String(Date.now());
    const record = { id, fullname_en: fullname_en || '', fullname_th, role, active: 'true' };

    if (useSheets()) {
      await appendSheet(process.env.PERSONNEL_SHEET_ID, SHEET_RANGE, [
        [id, fullname_en || '', fullname_th, role, 'true'],
      ]);
    } else {
      localPersonnel.append(record);
    }
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    console.error('Add personnel error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มบุคลากร' });
  }
});

// PUT /api/personnel/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { fullname_en, fullname_th, role, active } = req.body;
    if (!fullname_th || !role) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' });
    }
    const activeVal = active !== undefined ? String(active) : 'true';

    if (useSheets()) {
      const rows = await readSheet(process.env.PERSONNEL_SHEET_ID, SHEET_RANGE);
      const [, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบบุคลากรนี้' });
      await updateSheet(
        process.env.PERSONNEL_SHEET_ID,
        `Personnel!A${rowIndex + 2}:E${rowIndex + 2}`,
        [[req.params.id, fullname_en || '', fullname_th, role, activeVal]],
      );
    } else {
      const updated = localPersonnel.updateOne(req.params.id, { fullname_en: fullname_en || '', fullname_th, role, active: activeVal });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบบุคลากรนี้' });
    }
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    console.error('Update personnel error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดต' });
  }
});

// PATCH /api/personnel/:id/status  — toggle active/inactive
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const list = await getAll();
    const person = list.find((p) => p.id === req.params.id);
    if (!person) return res.status(404).json({ success: false, message: 'ไม่พบบุคลากรนี้' });
    const newActive = String(person.active) === 'true' ? 'false' : 'true';

    if (useSheets()) {
      const rows = await readSheet(process.env.PERSONNEL_SHEET_ID, SHEET_RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบบุคลากรนี้' });
      const activeCol = headers.indexOf('active');
      const colLetter = String.fromCharCode(65 + activeCol);
      await updateSheet(process.env.PERSONNEL_SHEET_ID, `Personnel!${colLetter}${rowIndex + 2}`, [[newActive]]);
    } else {
      localPersonnel.updateOne(req.params.id, { active: newActive });
    }
    res.json({ success: true, data: { active: newActive } });
  } catch (err) {
    console.error('Toggle personnel status error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
