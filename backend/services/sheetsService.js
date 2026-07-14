const { google } = require('googleapis');
const tokenStore = require('./tokenStore');
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
  const q = "'ใบรับงาน'";

  // Cell layout matched to the actual template (Template-Sheet.xlsx)
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [
      `${q}!D12`, `${q}!D13`, `${q}!D14`,  // 0-2: customer_name, company, phone
      `${q}!D18`, `${q}!D20`,               // 3-4: specimen_from, project_name
      `${q}!D24`, `${q}!D27`, `${q}!D30`,   // 5-7: receipt_name, receipt_address, tax_id
      `${q}!F4`,  `${q}!F5`,  `${q}!F6`,   // 8-10: professor, received_date, received_by
      `${q}!B33:B42`, `${q}!C33:C42`,      // 11-12: bar_size, manufacturer
      `${q}!F33:F42`, `${q}!J33:J42`,      // 13-14: quantity, notes
    ],
  });

  const vr = res.data.valueRanges;
  const cell = (i) => vr[i]?.values?.[0]?.[0] || '';
  const col  = (i) => (vr[i]?.values || []).map((r) => r[0] || '');

  const barSizes      = col(11);
  const manufacturers = col(12);
  const quantities    = col(13);
  const itemNotes     = col(14);

  const test_items = [];
  for (let i = 0; i < 10; i++) {
    if (barSizes[i] || quantities[i]) {
      test_items.push({
        bar_size:     barSizes[i]      || '',
        manufacturer: manufacturers[i] || '',
        quantity:     quantities[i]    || '',
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
async function appendSheet(spreadsheetId, range, values) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
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
    valueInputOption: 'USER_ENTERED',
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

async function ensurePriceListSheet(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const exists = meta.data.sheets.some((s) => s.properties.title === PRICE_SHEET_NAME);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: PRICE_SHEET_NAME } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${PRICE_SHEET_NAME}'!A1:D${PRICE_DATA.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: PRICE_DATA },
  });
}

// ── Build structured work-order spreadsheet FILE ──────────
// Row layout matched to Template-Sheet.xlsx (No 01 sheet)
async function buildWorkOrderSheet(workOrderData) {
  const sheets = await getSheets();
  const drive = await getDrive();
  const wo = workOrderData;
  const fileName = `[${wo.ref_no}] Test CE-KMUTNB`;
  const ps = PRICE_SHEET_NAME;

  // 1. Create new spreadsheet file inside DRIVE_FOLDER_ID
  const folderParent = process.env.DRIVE_FOLDER_ID;
  if (!folderParent) throw new Error('DRIVE_FOLDER_ID ยังไม่ได้ตั้งค่าใน .env');
  const driveFile = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderParent],
    },
    fields: 'id',
  });
  const newSpreadsheetId = driveFile.data.id;

  // Rename default Sheet1 → 'ใบรับงาน' and add price-list sheet
  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: newSpreadsheetId, fields: 'sheets.properties' });
  const defaultSheetId = metaRes.data.sheets[0].properties.sheetId;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: newSpreadsheetId,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: defaultSheetId, title: 'ใบรับงาน' }, fields: 'title' } },
        { addSheet: { properties: { title: ps } } },
      ],
    },
  });
  const mainSheetId = defaultSheetId;

  // 2. Share with OWNER_EMAIL
  const ownerEmails = (process.env.OWNER_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
  for (const email of ownerEmails) {
    await drive.permissions.create({
      fileId: newSpreadsheetId,
      requestBody: { role: 'writer', type: 'user', emailAddress: email },
    });
  }

  // 3. Price list sheet (A:D)
  await sheets.spreadsheets.values.update({
    spreadsheetId: newSpreadsheetId,
    range: `'${ps}'!A1:D${PRICE_DATA.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: PRICE_DATA },
  });

  // 4. Main sheet content
  const q = "'ใบรับงาน'";
  const items = (wo.test_items || []).slice(0, 10);

  // Static labels + pre-filled values
  const ranges = [
    // ── Header block (rows 2-6) ──────────────────────────
    [q + '!A2', 'ใบรับงานบริการวิชาการ (อาคาร 89)'],
    [q + '!E2', 'เลขที่สั่งจ้าง'],
    [q + '!J2', 'ver 01 [updated 20220117]'],
    [q + '!M2', 'For การเงิน'],
    [q + '!A3', 'ภาควิชาวิศวกรรมโยธา คณะวิศวกรรมโยธา'],
    [q + '!E3', 'เลขที่ในระบบ'],
    [q + '!F3', wo.ref_no || ''],
    [q + '!A4', 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ'],
    [q + '!E4', 'อาจารย์ผู้ทดสอบ'],
    [q + '!F4', wo.professor || ''],
    [q + '!A5', 'ce@eng.kmutnb.ac.th'],
    [q + '!E5', 'วันที่รับงาน'],
    [q + '!F5', wo.received_date || ''],
    [q + '!A6', 'เลขประจำตัวผู้เสียภาษี 099 4000 160 534'],
    [q + '!E6', 'ผู้รับงาน'],
    [q + '!F6', wo.received_by || wo.created_by || ''],
    // ── Service type (rows 9-10) ─────────────────────────
    [q + '!A9', 'ทดสอบแรงดึงเหล็กเส้น'],
    [q + '!D9', 'กรอกเฉพาะช่องสีเหลืองเท่านั้น (กรอกให้ครบถ้วน)\nและกรอกบน Google sheet online นี้เท่านั้น'],
    [q + '!A10', 'เรียน  หัวหน้าภาควิชาวิศวกรรมโยธา'],
    // ── Customer info (rows 11-14) ───────────────────────
    [q + '!A11', 'รายละเอียดผู้ส่งตัวอย่างทดสอบ'],
    [q + '!A12', 'ชื่อ-นามสกุล (นาย/นาง/นางสาว)'],
    [q + '!D12', wo.customer_name || ''],
    [q + '!A13', 'จาก(หน่วยงาน/บริษัท/ห้างหุ้นส่วนจำกัด)'],
    [q + '!D13', wo.company || wo.contractor || ''],
    [q + '!A14', 'เบอร์ติดต่อ และ ID LINE'],
    [q + '!D14', wo.phone || ''],
    // ── Specimen / project info (rows 16-21) ────────────
    [q + '!A16', 'รายละเอียดลงในใบงาน'],
    [q + '!A17', 'ชื่อผู้จ้างให้ระบุในผล (บริษัท/ห้างหุ้นส่วนจำกัด)'],
    [q + '!A18', '(Speciment from)'],
    [q + '!D18', wo.specimen_from || wo.contractor || ''],
    [q + '!A20', 'ชื่อโครงการ'],
    [q + '!C20', 'โครงการ'],
    [q + '!D20', wo.project_name || ''],
    [q + '!A21', '(Project name)'],
    // ── Receipt info (rows 23-30) ────────────────────────
    [q + '!A23', 'รายละเอียดออกใบเสร็จรับเงิน'],
    [q + '!A24', '- ให้ออกในนาม'],
    [q + '!D24', wo.receipt_name || wo.contractor || ''],
    [q + '!A25', '(หน่วยงาน/บริษัท/ห้างหุ้นส่วนจำกัด)'],
    [q + '!J24', '1. กรุณากรอกรายละเอียดต่าง ๆ ให้ถูกต้อง ภาควิชาวิศวกรรมโยธาจะออกใบแจ้งผลการทดสอบตามข้อมูลที่ระบุนี้เท่านั้น'],
    [q + '!J25', '2. กรุณาตรวจสอบรายละเอียดที่ใช้ออกใบเสร็จรับเงินให้ถูกต้อง ใบเสร็จรับเงินเมื่อออกแล้วไม่สามารถแก้ไขได้'],
    [q + '!J26', '3. ตึก 89 ชั้น 2 รับชำระเงินโดยเจ้าหน้าที่บริษัททำการโอนเงินที่หน้าเคาเตอร์ต่อหน้าเจ้าหน้าที่เพื่อยืนยันตัวตนเท่านั้น'],
    [q + '!A27', '- ที่อยู่ (ระบุในใบเสร็จ)'],
    [q + '!D27', wo.receipt_address || ''],
    [q + '!J27', '*** หากทำการโอนนอกเหนือจากที่กำหนด ทางภาควิชาไม่สามารถทดสอบ และออกใบเสร็จได้***'],
    [q + '!A30', '- เลขประจำตัวผู้เสียภาษี'],
    [q + '!D30', wo.tax_id || ''],
    // ── Table header (rows 31-32) ────────────────────────
    [q + '!N31', 'ผลทดสอบดิบ'],
    [q + '!A32', 'ลำดับที่'],
    [q + '!B32', 'ขนาดเหล็กเส้น'],
    [q + '!C32', 'ผู้ผลิต'],
    [q + '!F32', 'จำนวน (เส้น)'],
    [q + '!J32', 'หมายเหตุ (ถ้ามี)'],
    [q + '!K32', 'ราคา/ตัวอย่าง'],
    [q + '!L32', 'ราคา'],
    [q + '!N32', 'Length (cm.)'],
    [q + '!O32', 'Weight (g)'],
    [q + '!P32', 'Yield (kN)'],
    [q + '!Q32', 'Ultimate (kN)'],
    [q + '!R32', 'Elongation (cm.)'],
    [q + '!S32', 'G.L (cm.)'],
    [q + '!T32', 'Remark'],
  ];

  // Data rows 33-42
  for (let i = 0; i < 10; i++) {
    const row = 33 + i;
    const item = items[i] || {};
    ranges.push(
      [q + `!A${row}`, String(i + 1)],
      [q + `!B${row}`, item.bar_size || 'N/A'],
      [q + `!C${row}`, item.manufacturer || ''],
      [q + `!F${row}`, item.quantity != null && item.quantity !== '' ? String(item.quantity) : '0'],
      [q + `!J${row}`, item.notes || ''],
      [q + `!K${row}`, `=IFERROR(VLOOKUP(B${row},'${ps}'!$A:$B,2,FALSE),0)`],
      [q + `!L${row}`, `=IF(F${row}=0,"",F${row}*K${row})`],
    );
  }

  // Totals (rows 43-44)
  ranges.push(
    [q + '!K43', 'รวมราคา'],
    [q + '!L43', '=SUM(L33:L42)'],
    [q + '!A44', 'รวมจำนวน'],
    [q + '!B44', '=SUM(F33:F42)'],
    [q + '!C44', 'ตัวอย่าง'],
    [q + '!D44', 'รวมราคาค่าทดสอบ'],
    [q + '!E44', '=SUM(L33:L42)'],
    [q + '!F44', 'บาท'],
    // Notes (rows 45-49)
    [q + '!A45', 'หมายเหตุ'],
    [q + '!A46', '1. กรุณากรอกรายละเอียดต่าง ๆ ให้ถูกต้อง ภาควิชาวิศวกรรมโยธาจะออกใบแจ้งผลการทดสอบตามข้อมูลที่ระบุนี้เท่านั้น'],
    [q + '!A47', '2. กรุณาตรวจสอบรายละเอียดที่ใช้ออกใบเสร็จรับเงินให้ถูกต้อง ใบเสร็จรับเงินเมื่อออกแล้วไม่สามารถแก้ไขได้'],
    [q + '!A48', '3. ห้องการเงินตึก 81 ชั้น 3 รับชำระเงินโดยเจ้าหน้าที่บริษัททำการโอนเงินที่หน้าเคาเตอร์ต่อหน้าเจ้าหน้าที่ห้องการเงินเพื่อยืนยันตัวตนเท่านั้น'],
    [q + '!A49', '*** หากทำการโอนนอกเหนือจากที่กำหนด ทางภาควิชาไม่สามารถทดสอบ และออกใบเสร็จได้***'],
    // Staff notes (rows 52-53)
    [q + '!A52', 'หมายเหตุ (สำหรับเจ้าหน้าที่)'],
    [q + '!A53', '1. เลขที่ใบเสร็จ'],
  );

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: newSpreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: ranges.map(([range, value]) => ({ range, values: [[value]] })),
    },
  });

  // 5. Formatting
  const black = { red: 0, green: 0, blue: 0, alpha: 1 };
  const yellow = { red: 1, green: 1, blue: 0 };
  const lightGray = { red: 0.85, green: 0.85, blue: 0.85 };
  const solidBorder = { style: 'SOLID', width: 1, color: black };
  const sid = mainSheetId;
  const fmt = [];

  // Bold: title rows, section headers, table header (0-indexed)
  [[1, 2], [8, 9], [10, 11], [15, 16], [22, 23], [31, 32], [44, 45], [51, 52]].forEach(([s, e]) => {
    fmt.push({ repeatCell: { range: { sheetId: sid, startRowIndex: s, endRowIndex: e, startColumnIndex: 0, endColumnIndex: 14 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } });
  });

  // Gray + bold: table column header row (row 32, 0-indexed: 31)
  fmt.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 31, endRowIndex: 32, startColumnIndex: 0, endColumnIndex: 20 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: lightGray } }, fields: 'userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor' } });

  // Yellow: header-right input cells (F4-F6 = 0-indexed rows 3,4,5, cols 5-9)
  [3, 4, 5].forEach((r) => {
    fmt.push({ repeatCell: { range: { sheetId: sid, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 5, endColumnIndex: 10 }, cell: { userEnteredFormat: { backgroundColor: yellow } }, fields: 'userEnteredFormat.backgroundColor' } });
  });

  // Yellow: main input cells in col D-I (0-indexed rows for D12,D13,D14,D18,D20,D24,D27,D30)
  [11, 12, 13, 17, 19, 23, 26, 29].forEach((r) => {
    fmt.push({ repeatCell: { range: { sheetId: sid, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 3, endColumnIndex: 9 }, cell: { userEnteredFormat: { backgroundColor: yellow } }, fields: 'userEnteredFormat.backgroundColor' } });
  });

  // Yellow: data table input columns B, C, F, J in rows 33-42 (0-indexed: 32-41)
  [1, 2, 5, 9].forEach((c) => {
    fmt.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 32, endRowIndex: 42, startColumnIndex: c, endColumnIndex: c + 1 }, cell: { userEnteredFormat: { backgroundColor: yellow } }, fields: 'userEnteredFormat.backgroundColor' } });
  });

  // Yellow: raw results columns N-T (13-19) in rows 33-42
  fmt.push({ repeatCell: { range: { sheetId: sid, startRowIndex: 32, endRowIndex: 42, startColumnIndex: 13, endColumnIndex: 20 }, cell: { userEnteredFormat: { backgroundColor: yellow } }, fields: 'userEnteredFormat.backgroundColor' } });

  // Borders on main table (rows 32-44, cols A-L = 0-11)
  fmt.push({ updateBorders: { range: { sheetId: sid, startRowIndex: 31, endRowIndex: 44, startColumnIndex: 0, endColumnIndex: 12 }, top: solidBorder, bottom: solidBorder, left: solidBorder, right: solidBorder, innerHorizontal: solidBorder, innerVertical: solidBorder } });

  // Borders on raw results block (rows 31-42, cols N-T = 13-19)
  fmt.push({ updateBorders: { range: { sheetId: sid, startRowIndex: 30, endRowIndex: 42, startColumnIndex: 13, endColumnIndex: 20 }, top: solidBorder, bottom: solidBorder, left: solidBorder, right: solidBorder, innerHorizontal: solidBorder, innerVertical: solidBorder } });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: newSpreadsheetId, requestBody: { requests: fmt } });

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
};
