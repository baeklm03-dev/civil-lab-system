const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { readSheet, appendSheet, updateSheet, rowsToObjects, createWorkOrderSheet, buildWorkOrderSheet, readWorkOrderSheet, calcTotalPrice, readFirstTabValues } = require('../services/sheetsService');
const { GooglePermissionError, GoogleNotFoundError } = require('../lib/googleApiErrors');
const localStore = require('../services/localStore');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../services/activityLog');

// อ่าน/สร้าง Google Sheet ภายนอก (ของลูกค้า) ล้มเหลวเพราะยังไม่ได้แชร์สิทธิ์ให้ service account
// -> ส่งอีเมลกลับไปด้วยเพื่อให้ frontend บอกผู้ใช้ว่าต้องแชร์ให้ใคร
function googlePermissionMessage(err) {
  if (err instanceof GoogleNotFoundError) return 'ไม่พบ Google Sheet นี้ (ลิงก์อาจไม่ถูกต้อง หรือถูกลบไปแล้ว)';
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(ยังไม่ได้ตั้งค่า GOOGLE_SERVICE_ACCOUNT_EMAIL)';
  return `ไม่มีสิทธิ์เข้าถึง Google Sheet นี้ — กรุณาแชร์สิทธิ์ (อย่างน้อย Viewer) ให้กับอีเมล ${email} ก่อน`;
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
// A:P = original 16 cols, Q:R = test_type/custom_test_name, S = selected_announcements,
// T = custom_columns (JSON), U = custom_header_fields (JSON),
// V = imported_headers (JSON), W = imported_rows (JSON), X = import_source
const RANGE = 'WorkOrders!A:X';

const useSheets = () => !!process.env.WORKORDERS_SHEET_ID;
const useFormSheet = () => !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

// แปลง record เป็นแถวสำหรับเขียนลง Sheets (คอลัมน์ A:X) — ใช้ร่วมกันทุกจุดที่สร้างใบงาน
function rowFromRecord(record) {
  return [
    record.ref_no, record.project_name, record.contractor, record.sample_type,
    record.sample_count || '', record.test_age_days || '',
    record.received_date, record.status || 'รับเรื่อง',
    record.sheet_id, record.sheet_url, record.notes || '',
    record.created_by, record.created_at,
    '', '', '',
    record.test_type, record.custom_test_name, record.selected_announcements,
    JSON.stringify(record.custom_columns || []),
    JSON.stringify(record.custom_header_fields || []),
    JSON.stringify(record.imported_headers || []),
    JSON.stringify(record.imported_rows || []),
    record.import_source || '',
  ];
}

// ── helpers ──────────────────────────────────────────────

// testType (concrete/steel/other) ถ้าไม่ได้ตั้งค่าไว้ (ใบงานเก่าก่อนมีฟีเจอร์นี้) ให้เดาจาก sample_type
function resolveTestType(order) {
  if (order.test_type) return order.test_type;
  const t = (order.sample_type || '').toLowerCase();
  if (['steel', 'rebar', 'db', 'rb', 'bar'].some((k) => t.includes(k))) return 'steel';
  if (t) return 'concrete';
  return 'other';
}

function filterByDateRange(orders, startDate, endDate) {
  if (!startDate && !endDate) return orders;
  return orders.filter((o) => {
    if (!o.received_date) return false;
    if (startDate && o.received_date < startDate) return false;
    if (endDate && o.received_date > endDate) return false;
    return true;
  });
}

function getDailyTrend(orders) {
  const counts = {};
  orders.forEach((o) => {
    if (!o.received_date) return;
    counts[o.received_date] = (counts[o.received_date] || 0) + 1;
  });
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function getLast6Months(orders) {
  const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const now = new Date();
  const result = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ month: thaiMonths[d.getMonth()], count: orders.filter((o) => o.received_date?.startsWith(key)).length });
  }
  return result;
}

function buildStats(orders) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    thisMonth: orders.filter((o) => o.received_date?.startsWith(thisMonth)).length,
    pending:   orders.filter((o) => ['รับเรื่อง', 'รอข้อมูล', 'ดำเนินการ'].includes(o.status)).length,
    completed: orders.filter((o) => o.status === 'เสร็จสิ้น').length,
    total:     orders.length,
    byStatus: {
      รับเรื่อง:  orders.filter((o) => o.status === 'รับเรื่อง').length,
      รอข้อมูล:  orders.filter((o) => o.status === 'รอข้อมูล').length,
      ดำเนินการ: orders.filter((o) => o.status === 'ดำเนินการ').length,
      เสร็จสิ้น:  orders.filter((o) => o.status === 'เสร็จสิ้น').length,
    },
    byType: {
      Cube:     orders.filter((o) => o.sample_type === 'Cube').length,
      Coring:   orders.filter((o) => o.sample_type === 'Coring').length,
      Cylinder: orders.filter((o) => ['Cylinder', 'Cylinder Cap'].includes(o.sample_type)).length,
      Other:    orders.filter((o) => o.sample_type === 'Other').length,
    },
    monthlyTrend: getLast6Months(orders),
    recent: [...orders].reverse().slice(0, 5),
    byTestType: {
      concrete: orders.filter((o) => resolveTestType(o) === 'concrete').length,
      steel:    orders.filter((o) => resolveTestType(o) === 'steel').length,
      other:    orders.filter((o) => resolveTestType(o) === 'other').length,
    },
    totalRevenue: orders.reduce((sum, o) => sum + calcTotalPrice(o.test_items), 0),
    jobsOverTime: getDailyTrend(orders),
  };
}

function parseJsonArrayField(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

function parseCustomColumns(order) {
  return {
    ...order,
    custom_columns: parseJsonArrayField(order.custom_columns),
    custom_header_fields: parseJsonArrayField(order.custom_header_fields),
    imported_headers: parseJsonArrayField(order.imported_headers),
    imported_rows: parseJsonArrayField(order.imported_rows),
  };
}

async function getAllOrders() {
  if (useSheets()) {
    const rows = await readSheet(process.env.WORKORDERS_SHEET_ID, RANGE);
    return rowsToObjects(rows).map(parseCustomColumns);
  }
  return localStore.getAll().map(parseCustomColumns);
}

async function generateRefNo(orders) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `${yy}${mm}${dd}`;
  const todayCount = orders.filter((o) => o.ref_no?.startsWith(prefix)).length;
  return `${prefix}${String(todayCount + 1).padStart(2, '0')}`;
}

async function getDashboardSummary(startDate, endDate) {
  const orders = await getAllOrders();
  return buildStats(filterByDateRange(orders, startDate, endDate));
}

// ── GET /api/workorders/stats ─────────────────────────────
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getDashboardSummary(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
  }
});

// ── GET /api/workorders ───────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 15, startDate, endDate, testType } = req.query;
    let orders = await getAllOrders();

    orders = filterByDateRange(orders, startDate, endDate);
    if (testType) orders = orders.filter((o) => resolveTestType(o) === testType);
    if (status && status !== 'ทั้งหมด') orders = orders.filter((o) => o.status === status);
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) => o.ref_no?.toLowerCase().includes(q) ||
               o.project_name?.toLowerCase().includes(q) ||
               o.contractor?.toLowerCase().includes(q)
      );
    }

    // ล่าสุดขึ้นก่อน
    orders = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = orders.length;
    const start = (Number(page) - 1) * Number(limit);
    const paginated = orders.slice(start, start + Number(limit));

    res.json({ success: true, data: paginated, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('Get workorders error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

// ── GET /api/workorders/:refNo ────────────────────────────
router.get('/:refNo', authMiddleware, async (req, res) => {
  try {
    const orders = await getAllOrders();
    const order = orders.find((o) => o.ref_no === req.params.refNo);
    if (!order) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── GET /api/workorders/:refNo/finance-summary ────────────
router.get('/:refNo/finance-summary', authMiddleware, async (req, res) => {
  try {
    const orders = await getAllOrders();
    const order = orders.find((o) => o.ref_no === req.params.refNo);
    if (!order) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });

    const items = Array.isArray(order.test_items) ? order.test_items : [];
    const totalPrice = calcTotalPrice(items);

    const t = resolveTestType(order);
    const testTypeLabel = t === 'concrete' ? 'ทดสอบกำลังอัดคอนกรีต'
      : t === 'steel' ? 'ทดสอบแรงดึงเหล็กเส้น'
      : (order.custom_test_name || 'ทดสอบอื่นๆ');

    // รูปแบบข้อความแจ้งไลน์ (การเงิน)
    const summary = [
      `Email : ce@eng.kmutnb.ac.th`,
      `Tax : ${order.tax_id || ''}`,
      `ชื่อ : ${order.receipt_name || ''}`,
      `ที่อยู่ : ${order.receipt_address || ''}`,
      `รายการ : ${testTypeLabel}`,
      `ราคา : ${totalPrice}`,
      `เลขที่สั่งจ้าง : ${order.order_number || order.ref_no}`,
    ].join('\n');

    res.json({ success: true, summary });
  } catch (err) {
    console.error('Finance summary error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── helper: attempt form-sheet creation (non-fatal) ───────
async function tryBuildFormSheet(record) {
  if (!useFormSheet()) return;
  try {
    const result = await buildWorkOrderSheet(record);
    record.sheet_url = result.sheet_url;
    record.sheet_id = String(result.sheetId);
  } catch (e) {
    console.warn('Form-sheet creation skipped:', e.message);
  }
}

// ── POST /api/workorders ──────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      project_name, contractor, sample_type, sample_count, test_age_days, notes,
      // optional extended fields for the form sheet
      customer_name, company, phone, specimen_from,
      receipt_name, receipt_address, tax_id,
      professor, received_by, test_items,
      // test category (concrete/steel/other) — orthogonal to sample_type (specimen shape)
      test_type, custom_test_name, selected_announcements, custom_columns, custom_header_fields,
    } = req.body;


    const allOrders = await getAllOrders();
    const ref_no = await generateRefNo(allOrders);
    const now = new Date();
    const received_date = now.toISOString().split('T')[0];
    const created_by = req.user.name;

    const record = {
      ref_no, project_name, contractor, sample_type: sample_type || '',
      sample_count: sample_count || '',
      test_age_days: test_age_days || '',
      received_date, status: 'รับเรื่อง',
      sheet_id: '', sheet_url: '',
      notes: notes || '',
      created_by, created_at: now.toISOString(),
      compressive_strength: '', result_status: '', result_notes: '',
      // extended
      customer_name: customer_name || '',
      company: company || '',
      phone: phone || '',
      specimen_from: specimen_from || '',
      receipt_name: receipt_name || '',
      receipt_address: receipt_address || '',
      tax_id: tax_id || '',
      professor: professor || '',
      received_by: received_by || '',
      test_items: test_items || [],
      test_type: test_type || '',
      custom_test_name: custom_test_name || '',
      selected_announcements: selected_announcements || '',
      custom_columns: Array.isArray(custom_columns) ? custom_columns : [],
      custom_header_fields: Array.isArray(custom_header_fields) ? custom_header_fields : [],
      imported_headers: [], imported_rows: [], import_source: '',
    };

    // Legacy template copy (TEMPLATE_SHEET_ID) — kept for backward compat
    if (!useFormSheet() && process.env.TEMPLATE_SHEET_ID) {
      try {
        const sheet = await createWorkOrderSheet(process.env.TEMPLATE_SHEET_ID, `[${ref_no}] ${project_name}`);
        record.sheet_url = sheet.url;
        record.sheet_id = sheet.id;
      } catch (e) {
        console.warn('Template sheet skipped:', e.message);
      }
    }

    // New structured form sheet
    await tryBuildFormSheet(record);

    if (useSheets()) {
      await appendSheet(process.env.WORKORDERS_SHEET_ID, RANGE, [rowFromRecord(record)]);
    } else {
      localStore.append(record);
    }

    await logActivity(req.user.id, req.user.username, 'CREATE_WORKORDER', `REF: ${ref_no}`, req.ip);
    res.status(201).json({ success: true, message: 'สร้างใบงานสำเร็จ', data: record });
  } catch (err) {
    console.error('Create workorder error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้างใบงาน' });
  }
});

// สร้างใบงานหนึ่งรายการจากข้อมูลที่นำเข้า (ไฟล์ Excel หรือลิงก์ Google Sheet)
// test_type ตายตัวเป็น 'other' — เป็นการเก็บข้อมูลดิบไว้อ้างอิงเฉยๆ ไม่ผูกกับสูตรคำนวณใดๆ ในระบบ
async function createImportedWorkOrder({ project_name, contractor, custom_test_name, imported_headers, imported_rows, import_source, user, ip }) {
  const allOrders = await getAllOrders();
  const ref_no = await generateRefNo(allOrders);
  const now = new Date();

  const record = {
    ref_no, project_name: project_name || '', contractor: contractor || '', sample_type: '',
    sample_count: '', test_age_days: '',
    received_date: now.toISOString().split('T')[0], status: 'รับเรื่อง',
    sheet_id: '', sheet_url: '',
    notes: '',
    created_by: user.name, created_at: now.toISOString(),
    compressive_strength: '', result_status: '', result_notes: '',
    customer_name: '', company: '', phone: '', specimen_from: '',
    receipt_name: '', receipt_address: '', tax_id: '', professor: '', received_by: '',
    test_items: [],
    test_type: 'other',
    custom_test_name: custom_test_name || '',
    selected_announcements: '',
    custom_columns: [], custom_header_fields: [],
    imported_headers, imported_rows, import_source,
  };

  // หมายเหตุ: buildWorkOrderSheet ยังไม่มี template สำหรับ "อื่นๆ" โดยเฉพาะ จะได้ฟอร์มแบบคอนกรีตเป็นค่าเริ่มต้น (fallback ใน resolveTestTypeForSheet)
  await tryBuildFormSheet(record);

  if (useSheets()) {
    await appendSheet(process.env.WORKORDERS_SHEET_ID, RANGE, [rowFromRecord(record)]);
  } else {
    localStore.append(record);
  }

  await logActivity(user.id, user.username, 'IMPORT_WORKORDER', `REF: ${ref_no} (${import_source})`, ip);
  return record;
}

function parseSheetRows(values) {
  if (!values.length) return { headers: [], rows: [] };
  const [headers, ...rows] = values;
  return { headers: headers.map((h) => String(h ?? '')), rows: rows.map((r) => r.map((c) => String(c ?? ''))) };
}

// ── POST /api/workorders/import-file — นำเข้าจากไฟล์ Excel (.xlsx) ─────
router.post('/import-file', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์ Excel (.xlsx)' });
    }
    const { project_name, contractor, custom_test_name } = req.body;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลในไฟล์ที่แนบ' });
    }
    const values = [];
    ws.eachRow((row) => {
      values.push(row.values.slice(1).map((v) => (v == null ? '' : (v.text ?? v.result ?? v))).map(String));
    });
    const { headers, rows } = parseSheetRows(values);
    if (!headers.length) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลในไฟล์ที่แนบ' });
    }

    const record = await createImportedWorkOrder({
      project_name, contractor, custom_test_name,
      imported_headers: headers, imported_rows: rows,
      import_source: req.file.originalname,
      user: req.user, ip: req.ip,
    });

    res.status(201).json({ success: true, message: 'นำเข้าสำเร็จ', data: record });
  } catch (err) {
    console.error('Import file error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + err.message });
  }
});

// ── POST /api/workorders/import-sheet-link — นำเข้าจากลิงก์ Google Sheet ─
router.post('/import-sheet-link', authMiddleware, async (req, res) => {
  try {
    const { url, project_name, contractor, custom_test_name } = req.body;
    const match = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'ลิงก์ Google Sheet ไม่ถูกต้อง' });
    }

    const { title, values } = await readFirstTabValues(match[1]);
    const { headers, rows } = parseSheetRows(values);
    if (!headers.length) {
      return res.status(400).json({ success: false, message: 'ไม่พบข้อมูลใน Sheet นี้' });
    }

    const record = await createImportedWorkOrder({
      project_name, contractor, custom_test_name,
      imported_headers: headers, imported_rows: rows,
      import_source: title,
      user: req.user, ip: req.ip,
    });

    res.status(201).json({ success: true, message: 'นำเข้าสำเร็จ', data: record });
  } catch (err) {
    if (err instanceof GooglePermissionError || err instanceof GoogleNotFoundError) {
      return res.status(err instanceof GoogleNotFoundError ? 404 : 403).json({ success: false, message: googlePermissionMessage(err) });
    }
    console.error('Import sheet link error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการนำเข้าจากลิงก์: ' + err.message });
  }
});

// ── PATCH /api/workorders/:refNo/status ───────────────────
router.patch('/:refNo/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['รับเรื่อง', 'รอข้อมูล', 'ดำเนินการ', 'เสร็จสิ้น'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }

    if (useSheets()) {
      const rows = await readSheet(process.env.WORKORDERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.refNo);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
      const statusCol = headers.indexOf('status');
      const colLetter = String.fromCharCode(65 + statusCol);
      await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!${colLetter}${rowIndex + 2}`, [[status]]);
    } else {
      const updated = localStore.updateOne(req.params.refNo, { status });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
    }

    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── PATCH /api/workorders/:refNo/custom-columns ───────────
// รับได้ทั้ง custom_columns (คอลัมน์ตาราง) และ custom_header_fields (หัวข้อบนที่ต้องกรอก) สำหรับ test_type=other
router.patch('/:refNo/custom-columns', authMiddleware, async (req, res) => {
  try {
    const { custom_columns, custom_header_fields } = req.body;
    if (custom_columns !== undefined && !Array.isArray(custom_columns)) {
      return res.status(400).json({ success: false, message: 'custom_columns ต้องเป็น array' });
    }
    if (custom_header_fields !== undefined && !Array.isArray(custom_header_fields)) {
      return res.status(400).json({ success: false, message: 'custom_header_fields ต้องเป็น array' });
    }

    if (useSheets()) {
      const rows = await readSheet(process.env.WORKORDERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.refNo);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
      const sheetRow = rowIndex + 2;
      if (custom_columns !== undefined) {
        const col = headers.indexOf('custom_columns');
        const colLetter = String.fromCharCode(65 + col);
        await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!${colLetter}${sheetRow}`, [[JSON.stringify(custom_columns)]]);
      }
      if (custom_header_fields !== undefined) {
        const col = headers.indexOf('custom_header_fields');
        const colLetter = String.fromCharCode(65 + col);
        await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!${colLetter}${sheetRow}`, [[JSON.stringify(custom_header_fields)]]);
      }
    } else {
      const fields = {};
      if (custom_columns !== undefined) fields.custom_columns = custom_columns;
      if (custom_header_fields !== undefined) fields.custom_header_fields = custom_header_fields;
      const updated = localStore.updateOne(req.params.refNo, fields);
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
    }

    res.json({ success: true, message: 'อัปเดตคอลัมน์สำเร็จ' });
  } catch (err) {
    console.error('Update custom-columns error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── PATCH /api/workorders/:refNo/result ───────────────────
router.patch('/:refNo/result', authMiddleware, async (req, res) => {
  try {
    const { compressive_strength, result_notes, weight_kg, area_cm2, load_kn } = req.body;

    if (useSheets()) {
      const rows = await readSheet(process.env.WORKORDERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.refNo);
      if (rowIndex === -1) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
      const sheetRow = rowIndex + 2;
      await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!N${sheetRow}:P${sheetRow}`, [
        [compressive_strength || '', result_notes || '', `${weight_kg || ''}|${area_cm2 || ''}|${load_kn || ''}`],
      ]);
      const statusCol = headers.indexOf('status');
      const colLetter = String.fromCharCode(65 + statusCol);
      await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!${colLetter}${sheetRow}`, [['เสร็จสิ้น']]);
    } else {
      const updated = localStore.updateOne(req.params.refNo, {
        weight_kg: weight_kg || '',
        area_cm2: area_cm2 || '',
        load_kn: load_kn || '',
        compressive_strength: compressive_strength || '',
        result_notes: result_notes || '',
        status: 'เสร็จสิ้น',
      });
      if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });
    }

    res.json({ success: true, message: 'บันทึกผลทดสอบสำเร็จ' });
  } catch (err) {
    console.error('Save result error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ── POST /api/workorders/:refNo/sync-sheet ────────────────
router.post('/:refNo/sync-sheet', authMiddleware, async (req, res) => {
  try {
    const orders = await getAllOrders();
    const order = orders.find((o) => o.ref_no === req.params.refNo);
    if (!order) return res.status(404).json({ success: false, message: 'ไม่พบใบงาน' });
    if (!order.sheet_url) return res.status(400).json({ success: false, message: 'ยังไม่มี Google Sheet' });

    const match = order.sheet_url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return res.status(400).json({ success: false, message: 'sheet_url ไม่ถูกต้อง' });
    const spreadsheetId = match[1];

    const synced = await readWorkOrderSheet(spreadsheetId);

    const updateFields = {
      customer_name:   synced.customer_name,
      company:         synced.company,
      phone:           synced.phone,
      specimen_from:   synced.specimen_from,
      project_name:    synced.project_name || order.project_name,
      receipt_name:    synced.receipt_name,
      receipt_address: synced.receipt_address,
      tax_id:          synced.tax_id,
      professor:       synced.professor,
      received_date:   synced.received_date || order.received_date,
      received_by:     synced.received_by,
      test_items:      synced.test_items,
      order_number:    synced.order_number,
    };

    if (useSheets()) {
      // minimal update — only fields stored in WORKORDERS_SHEET_ID are updated
      // extended fields stored locally via JSON overlay (future enhancement)
    }
    localStore.updateOne(req.params.refNo, updateFields);

    res.json({ success: true, message: 'ซิงค์ข้อมูลสำเร็จ', data: { ...order, ...updateFields } });
  } catch (err) {
    if (err instanceof GooglePermissionError || err instanceof GoogleNotFoundError) {
      return res.status(err instanceof GoogleNotFoundError ? 404 : 403).json({ success: false, message: googlePermissionMessage(err) });
    }
    console.error('Sync-sheet error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

// ── POST /api/workorders/:refNo/create-sheet ──────────────
router.post('/:refNo/create-sheet', authMiddleware, async (req, res) => {
  try {
    if (!useFormSheet()) {
      return res.status(400).json({ success: false, message: 'Google Service Account ยังไม่ได้ตั้งค่าใน .env' });
    }

    const orders = await getAllOrders();
    const order = orders.find((o) => o.ref_no === req.params.refNo);
    if (!order) return res.status(404).json({ success: false, message: 'ไม่พบใบงานนี้' });

    // Merge any extra fields passed in request body
    const workOrderData = { ...order, ...req.body };

    const result = await buildWorkOrderSheet(workOrderData);
    const sheet_url = result.sheet_url;
    const sheet_id = String(result.sheetId);

    // Persist updated sheet_url
    if (useSheets()) {
      const rows = await readSheet(process.env.WORKORDERS_SHEET_ID, RANGE);
      const [headers, ...dataRows] = rows;
      const rowIndex = dataRows.findIndex((r) => r[0] === req.params.refNo);
      if (rowIndex !== -1) {
        const sheetRow = rowIndex + 2;
        const idCol = headers.indexOf('sheet_id');
        const urlCol = headers.indexOf('sheet_url');
        if (idCol !== -1) await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!${String.fromCharCode(65 + idCol)}${sheetRow}`, [[sheet_id]]);
        if (urlCol !== -1) await updateSheet(process.env.WORKORDERS_SHEET_ID, `WorkOrders!${String.fromCharCode(65 + urlCol)}${sheetRow}`, [[sheet_url]]);
      }
    } else {
      localStore.updateOne(req.params.refNo, { sheet_url, sheet_id });
    }

    res.json({ success: true, sheet_url, message: 'สร้าง Google Sheet สำเร็จ' });
  } catch (err) {
    console.error('Create-sheet error:', err);
    if (err instanceof GooglePermissionError || err instanceof GoogleNotFoundError) {
      return res.status(err instanceof GoogleNotFoundError ? 404 : 403).json({ success: false, message: googlePermissionMessage(err) });
    }
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
  }
});

module.exports = router;
module.exports.getDashboardSummary = getDashboardSummary;
module.exports.resolveTestType = resolveTestType;
module.exports.filterByDateRange = filterByDateRange;
