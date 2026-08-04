const express = require('express');
const { body } = require('express-validator');
const { readSheet, appendSheet, updateSheet, rowsToObjects, deleteSheetRow } = require('../services/sheetsService');
const localPersonnel = require('../services/localPersonnel');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();
const SHEET_RANGE = 'Personnel!A:E';
const useSheets = () => !!process.env.PERSONNEL_SHEET_ID;
const PERSONNEL_ROLES = ['tester', 'professor'];

const personnelValidators = [
  body('fullname_th').trim().notEmpty().withMessage('กรุณากรอกชื่อ-นามสกุล (TH) และบทบาท'),
  body('role').isIn(PERSONNEL_ROLES).withMessage(`role ต้องเป็นหนึ่งใน: ${PERSONNEL_ROLES.join(', ')}`),
];

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
router.post('/', authMiddleware, requireRole('admin', 'superadmin'), personnelValidators, handleValidationErrors, async (req, res) => {
  try {
    const { fullname_en, fullname_th, role } = req.body;
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
router.put('/:id', authMiddleware, requireRole('admin', 'superadmin'), personnelValidators, handleValidationErrors, async (req, res) => {
  try {
    const { fullname_en, fullname_th, role, active } = req.body;
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
router.patch('/:id/status', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
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

// DELETE /api/personnel/:id
router.delete('/:id', authMiddleware, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    if (useSheets()) {
      const rows = await readSheet(process.env.PERSONNEL_SHEET_ID, SHEET_RANGE);
      const [, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.id);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบบุคลากรนี้' });
      await deleteSheetRow(process.env.PERSONNEL_SHEET_ID, 'Personnel', rowIndex + 2);
    } else {
      const ok = localPersonnel.deleteOne(req.params.id);
      if (!ok) return res.status(404).json({ success: false, message: 'ไม่พบบุคลากรนี้' });
    }
    res.json({ success: true, message: 'ลบบุคลากรสำเร็จ' });
  } catch (err) {
    console.error('Delete personnel error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
