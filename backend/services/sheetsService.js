const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const tokenStore = require('./tokenStore');
const localAnnouncements = require('./localAnnouncements');
const { getOAuth2Client, REDIRECT_URI } = require('../routes/googleAuth');

let sheetsClient = null;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function getSheets() {
  if (!sheetsClient) {
    const auth = getAuth();
    sheetsClient = google.sheets({ version: 'v4', auth });
  }
  return sheetsClient;
}

async function getDrive() {
  const stored = tokenStore.getToken();
  if (!stored?.refresh_token) {
    throw new Error('GOOGLE_AUTH_REQUIRED');
  }
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(stored);
  oauth2Client.on('tokens', (tokens) => tokenStore.saveToken(tokens));
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// อัปโหลดไฟล์ .xlsx จริงขึ้น Drive แล้วแปลงเป็น Google Sheet ในขั้นตอนเดียว
// (รักษาสูตร/dropdown/merge/format ของไฟล์ต้นฉบับไว้ครบ — ดีกว่าสร้างชีทเปล่าแล้วเขียนทุก cell เอง)
async function uploadTemplateAsSheet(templatePath, fileName, folderId) {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: fs.createReadStream(templatePath),
    },
    fields: 'id',
  });
  return res.data.id;
}

async function getSheetsOAuth() {
  const stored = tokenStore.getToken();
  if (!stored?.refresh_token) throw new Error('GOOGLE_AUTH_REQUIRED');
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(stored);
  oauth2Client.on('tokens', (tokens) => tokenStore.saveToken(tokens));
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function readWorkOrderSheet(spreadsheetId) {
  const sheets = await getSheetsOAuth();
  const q = "'No 01'";

  // Cell layout matched to the real templates (Concrete/Steel Test Form-sheet.xlsx)
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${q}!D12`, `${q}!D13`, `${q}!D14`,  // 0-2: customer_name, company, phone
      `${q}!D17`, `${q}!D20`,               // 3-4: specimen_from, project_name
      `${q}!D24`, `${q}!D27`, `${q}!D30`,   // 5-7: receipt_name, receipt_address, tax_id
      `${q}!G4`,  `${q}!G5`,  `${q}!G6`,   // 8-10: professor, received_date, received_by
      `${q}!C33:C42`, `${q}!D33:D42`,      // 11-12: bar_size, manufacturer
      `${q}!G33:G42`, `${q}!K33:K42`,      // 13-14: quantity, notes
    ],
  });

  const vr = res.data.valueRanges;
  const cell = (i) => vr[i]?.values?.[0]?.[0] || '';
  const col  = (i) => (vr[i]?.values || []).map((r) => r[0] || '');

  const barSizes      = col(11);
  const manufacturers = col(12);
  const quantities    = col(13);
  const itemNotes     = col(14);

  // แถวว่างในเทมเพลตมีค่า placeholder ตายตัวอยู่แล้ว (bar_size="N/A", quantity="0")
  // ต้องกรองออก ไม่ใช่แถวข้อมูลจริง
  const test_items = [];
  for (let i = 0; i < 10; i++) {
    const barSize = barSizes[i] && barSizes[i] !== 'N/A' ? barSizes[i] : '';
    const qty = quantities[i] && quantities[i] !== '0' ? quantities[i] : '';
    if (barSize || qty) {
      test_items.push({
        bar_size:     barSize,
        manufacturer: manufacturers[i] || '',
        quantity:     qty,
        notes:        itemNotes[i]     || '',
      });
    }
  }

  return {
    customer_name:   cell(0),
    company:         cell(1),
    phone:           cell(2),
    specimen_from:   cell(3),
    project_name:    cell(4),
    receipt_name:    cell(5),
    receipt_address: cell(6),
    tax_id:          cell(7),
    professor:       cell(8),
    received_date:   cell(9),
    received_by:     cell(10),
    test_items,
  };
}

// อ่านข้อมูลจาก Sheet
async function readSheet(spreadsheetId, range) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values || [];
}

// เขียนข้อมูลต่อท้าย Sheet
// หมายเหตุ: ใช้ RAW (ไม่ใช่ USER_ENTERED) เพราะแอปนี้อ่านค่ากลับมาเป็น string เสมอ (ผ่าน rowsToObjects)
// USER_ENTERED จะทำให้ Sheets ตีความ "true"/"false" เป็น boolean และวันที่แบบ YYYY-MM-DD เป็น date
// serial แล้วอ่านกลับมาไม่ตรงกับที่เขียนไป (เช่น "true" -> "TRUE") — ไม่กระทบ buildWorkOrderSheet
// ที่เขียนสูตร/ตัวเลขราคาตรงผ่าน sheets.spreadsheets.values.* โดยตรง (ไม่ผ่าน helper นี้)
async function appendSheet(spreadsheetId, range, values) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
  return res.data;
}

// อัปเดตข้อมูลในแถวที่ระบุ
async function updateSheet(spreadsheetId, range, values) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  return res.data;
}

// แปลง rows (array of arrays) → array of objects โดยใช้ row แรกเป็น header
function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const [headers, ...dataRows] = rows;
  return dataRows.map((row) =>
    headers.reduce((obj, header, i) => {
      obj[header] = row[i] ?? '';
      return obj;
    }, {})
  );
}

// สร้าง Google Sheet ใหม่จาก template และ share ด้วย service account
async function createWorkOrderSheet(templateSheetId, title) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Copy template sheet
  const copied = await drive.files.copy({
    fileId: templateSheetId,
    requestBody: { name: title },
  });

  // Share กับ anyone with link (optional — ปรับตามนโยบายองค์กร)
  await drive.permissions.create({
    fileId: copied.data.id,
    requestBody: { role: 'writer', type: 'anyone' },
  });

  return {
    id: copied.data.id,
    url: `https://docs.google.com/spreadsheets/d/${copied.data.id}`,
  };
}

// ── Price-list sheet ──────────────────────────────────────
const PRICE_SHEET_NAME = 'รายการค่าทดสอบ';
const PRICE_DATA = [
  ['ชนิดตัวอย่าง', 'ราคา / ชิ้น', '', 'หมายเหตุ คิดขั้นต่ำ 3 ชิ้น'],
  ['RB 6',  300, '', ''],
  ['RB 9',  300, '', ''],
  ['DB 9',  300, '', ''],
  ['DB 10', 300, '', ''],
  ['DB 12', 300, '', ''],
  ['DB 15', 350, '', ''],
  ['DB 16', 350, '', ''],
  ['DB 20', 400, '', ''],
  ['DB 25', 450, '', ''],
  ['DB 28', 500, '', ''],
  ['DB 32', 600, '', ''],
  ['N/A',     0, '', ''],
];

// สร้าง sheet tab ใหม่ถ้ายังไม่มี พร้อมกรอกแถวเริ่มต้น (header หรือ header+data)
async function ensureSheetTab(sheets, spreadsheetId, title, initialRows) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const exists = meta.data.sheets.some((s) => s.properties.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });

  if (initialRows && initialRows.length) {
    const maxCols = Math.max(...initialRows.map((r) => r.length));
    const lastCol = String.fromCharCode(65 + maxCols - 1);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${title}'!A1:${lastCol}${initialRows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: initialRows },
    });
  }
}

async function ensurePriceListSheet(sheets, spreadsheetId) {
  return ensureSheetTab(sheets, spreadsheetId, PRICE_SHEET_NAME, PRICE_DATA);
}

// ลบแถวหนึ่งแถวออกจาก sheet tab (sheetRowNumber = เลขแถวจริงในชีท เริ่มที่ 1)
async function deleteSheetRow(spreadsheetId, sheetTitle, sheetRowNumber) {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const sheetMeta = meta.data.sheets.find((s) => s.properties.title === sheetTitle);
  if (!sheetMeta) throw new Error(`ไม่พบ sheet tab "${sheetTitle}"`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetMeta.properties.sheetId,
            dimension: 'ROWS',
            startIndex: sheetRowNumber - 1,
            endIndex: sheetRowNumber,
          },
        },
      }],
    },
  });
}

// คำนวณราคารวมจาก test_items (bar_size + quantity) โดยใช้ตารางราคาเดียวกับที่ใช้ใน VLOOKUP ของ buildWorkOrderSheet
function calcTotalPrice(test_items) {
  if (!Array.isArray(test_items)) return 0;
  return test_items.reduce((sum, item) => sum + getItemPrice(item.bar_size) * (Number(item.quantity) || 0), 0);
}

// ราคา/ชิ้น ของขนาดเหล็กเส้นหนึ่งรายการ (ตารางเดียวกับ calcTotalPrice)
function getItemPrice(barSize) {
  const row = PRICE_DATA.slice(1).find((r) => r[0] === barSize);
  return row ? Number(row[1]) || 0 : 0;
}

// ดึงประกาศตาม id list (dual-mode: Sheets ถ้าตั้งค่า SPREADSHEET_ID ไว้ ไม่งั้นใช้ local JSON)
async function getAnnouncementsByIds(ids) {
  if (!ids || !ids.length) return [];
  let all;
  if (process.env.SPREADSHEET_ID) {
    const sheets = await getSheets();
    const header = ['announcementId', 'label', 'content', 'active', 'createdAt'];
    await ensureSheetTab(sheets, process.env.SPREADSHEET_ID, 'Announcements', [header]);
    const rows = await readSheet(process.env.SPREADSHEET_ID, 'Announcements!A:E');
    all = rowsToObjects(rows);
  } else {
    all = localAnnouncements.getAll();
  }
  return ids.map((id) => all.find((a) => a.announcementId === id)).filter(Boolean);
}

// เดา testType จากใบงาน (เหมือน resolveTestType ใน routes/workorders.js — ทำซ้ำที่นี่เพราะ
// services/ ไม่ควรพึ่งพา routes/ ย้อนกลับ)
function resolveTestTypeForSheet(wo) {
  if (wo.test_type) return wo.test_type;
  const t = (wo.sample_type || '').toLowerCase();
  if (['steel', 'rebar', 'db', 'rb', 'bar'].some((k) => t.includes(k))) return 'steel';
  return 'concrete';
}

const SHEET_TEMPLATES = {
  concrete: path.join(__dirname, '../assets/templates/concrete-test-form.xlsx'),
  steel: path.join(__dirname, '../assets/templates/steel-test-form.xlsx'),
};

// ── Build structured work-order spreadsheet FILE ──────────
// อัปโหลดไฟล์ template จริง (Concrete/Steel Test Form-sheet.xlsx) ตาม testType แล้วเติมเฉพาะ
// ค่าที่เปลี่ยนต่อใบงาน — label, สูตร, dropdown, ตาราง "รายการค่าทดสอบ" มาจากไฟล์ template เองทั้งหมด
async function buildWorkOrderSheet(workOrderData) {
  const sheets = await getSheets();
  const drive = await getDrive();
  const wo = workOrderData;
  const fileName = `[${wo.ref_no}] Test CE-KMUTNB`;

  const testType = resolveTestTypeForSheet(wo);
  const templatePath = SHEET_TEMPLATES[testType] || SHEET_TEMPLATES.concrete;

  const folderParent = process.env.DRIVE_FOLDER_ID;
  if (!folderParent) throw new Error('DRIVE_FOLDER_ID ยังไม่ได้ตั้งค่าใน .env');

  // 1. อัปโหลด template จริงขึ้น Drive (แปลงเป็น Google Sheet ในตัว)
  const newSpreadsheetId = await uploadTemplateAsSheet(templatePath, fileName, folderParent);

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: newSpreadsheetId, fields: 'sheets.properties' });
  const mainSheetMeta = metaRes.data.sheets.find((s) => s.properties.title === 'No 01') || metaRes.data.sheets[0];
  const mainSheetId = mainSheetMeta.properties.sheetId;

  // 2. Share with OWNER_EMAIL
  const ownerEmails = (process.env.OWNER_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
  for (const email of ownerEmails) {
    await drive.permissions.create({
      fileId: newSpreadsheetId,
      requestBody: { role: 'writer', type: 'user', emailAddress: email },
    });
  }

  // 3. เติมค่าที่เปลี่ยนต่อใบงาน (label/สูตร/dropdown มาจาก template อยู่แล้ว)
  const q = "'No 01'";
  const ranges = [
    [q + '!G3', wo.ref_no || ''],
    [q + '!G4', wo.professor || ''],
    [q + '!G5', wo.received_date || ''],
    [q + '!G6', wo.received_by || wo.created_by || ''],
    [q + '!D12', wo.customer_name || ''],
    [q + '!D13', wo.company || wo.contractor || ''],
    [q + '!D14', wo.phone || ''],
    [q + '!D17', wo.specimen_from || wo.contractor || ''],
    [q + '!D20', wo.project_name || ''],
    [q + '!D24', wo.receipt_name || wo.contractor || ''],
    [q + '!D27', wo.receipt_address || ''],
    [q + '!D30', wo.tax_id || ''],
  ];

  // Steel: เติมรายการเหล็กเส้น (ขนาด/ผู้ผลิต/จำนวน/หมายเหตุ) ลงคอลัมน์ใหม่ C/D/G/K
  // Concrete: ตาราง (วันที่หล่อ/ชนิดตัวอย่าง/กำลังที่คาดหวัง) ปล่อยว่างให้ลูกค้ากรอกเองในชีท
  if (testType === 'steel') {
    const items = (wo.test_items || []).slice(0, 10);
    items.forEach((item, i) => {
      const row = 33 + i;
      ranges.push(
        [q + `!C${row}`, item.bar_size || ''],
        [q + `!D${row}`, item.manufacturer || ''],
        [q + `!G${row}`, item.quantity != null && item.quantity !== '' ? String(item.quantity) : ''],
        [q + `!K${row}`, item.notes || ''],
      );
    });
  }

  // ข้อความแจ้งข่าวสารที่เลือกไว้ -> L14, L15, ... (พื้นที่ประกาศในชีท มีถึง L22 = สูงสุด 9 ข้อความ)
  if (wo.selected_announcements) {
    const ids = String(wo.selected_announcements).split(',').map((s) => s.trim()).filter(Boolean);
    const announcements = await getAnnouncementsByIds(ids);
    announcements.slice(0, 9).forEach((a, i) => {
      ranges.push([q + `!L${14 + i}`, a.content]);
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: newSpreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: ranges.map(([range, value]) => ({ range, values: [[value]] })),
    },
  });

  return {
    sheetId: mainSheetId,
    sheet_url: `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`,
  };
}

module.exports = {
  readSheet,
  appendSheet,
  updateSheet,
  rowsToObjects,
  createWorkOrderSheet,
  buildWorkOrderSheet,
  readWorkOrderSheet,
  getSheets,
  ensureSheetTab,
  deleteSheetRow,
  calcTotalPrice,
  getItemPrice,
};
