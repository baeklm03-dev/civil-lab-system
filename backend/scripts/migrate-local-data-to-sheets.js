/**
 * One-off / re-runnable migration: copies backend/data/{workorders,users,personnel}.json
 * into tabs on the "master" spreadsheet (SPREADSHEET_ID — the same one already used for
 * Announcements/SystemLog/TestResults), then prints the env vars to flip storage mode on.
 *
 * Why this exists: WorkOrders/Users/Personnel routes never auto-create their sheet tab the
 * way Announcements/SystemLog/TestResults do, and local JSON files are the only place this
 * data lives until WORKORDERS_SHEET_ID/USERS_SHEET_ID/PERSONNEL_SHEET_ID are set — which is
 * a problem on hosts with an ephemeral filesystem (e.g. Render free tier wipes it on redeploy).
 *
 * Safe to re-run: skips any tab that already has data rows beyond the header.
 * Usage: node scripts/migrate-local-data-to-sheets.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSheets, ensureSheetTab, readSheet, appendSheet } = require('../services/sheetsService');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DATA_DIR = path.join(__dirname, '../data');

const WORKORDERS_HEADER = [
  'ref_no', 'project_name', 'contractor', 'sample_type', 'sample_count', 'test_age_days',
  'received_date', 'status', 'sheet_id', 'sheet_url', 'notes', 'created_by', 'created_at',
  'compressive_strength', 'result_notes', 'result_measurements',
  'test_type', 'custom_test_name', 'selected_announcements',
  'custom_columns', 'custom_header_fields', 'imported_headers', 'imported_rows', 'import_source',
];
const USERS_HEADER = ['userId', 'username', 'passwordHash', 'fullName', 'role', 'status', 'createdAt', 'lastLogin'];
const PERSONNEL_HEADER = ['id', 'fullname_en', 'fullname_th', 'role', 'active'];

function loadJson(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return []; }
}

// Mirrors routes/workorders.js:rowFromRecord, but reads from the local-JSON record shape
// (which keeps weight_kg/area_cm2/load_kn as separate fields; Sheets mode packs them into
// one pipe-delimited column P, matching the existing PATCH /:refNo/result convention).
function workOrderRow(r) {
  const measurements = [r.weight_kg, r.area_cm2, r.load_kn];
  const result_measurements = measurements.some(Boolean) ? measurements.map((v) => v || '').join('|') : '';
  return [
    r.ref_no, r.project_name || '', r.contractor || '', r.sample_type || '',
    r.sample_count || '', r.test_age_days || '',
    r.received_date || '', r.status || 'รับเรื่อง',
    r.sheet_id || '', r.sheet_url || '', r.notes || '',
    r.created_by || '', r.created_at || '',
    r.compressive_strength || '', r.result_notes || '', result_measurements,
    r.test_type || '', r.custom_test_name || '', r.selected_announcements || '',
    JSON.stringify(r.custom_columns || []),
    JSON.stringify(r.custom_header_fields || []),
    JSON.stringify(r.imported_headers || []),
    JSON.stringify(r.imported_rows || []),
    r.import_source || '',
  ];
}

function userRow(u) {
  return [u.userId, u.username, u.passwordHash, u.fullName || '', u.role || '', u.status || 'active', u.createdAt || '', u.lastLogin || ''];
}

function personnelRow(p) {
  return [p.id, p.fullname_en || '', p.fullname_th || '', p.role || '', p.active ?? 'true'];
}

async function migrateTab({ sheets, tabName, header, records, toRow }) {
  await ensureSheetTab(sheets, SPREADSHEET_ID, tabName, [header]);

  const range = `${tabName}!A:${String.fromCharCode(64 + header.length)}`;
  const existingRows = await readSheet(SPREADSHEET_ID, range);
  if (existingRows.length > 1) {
    console.log(`[skip] "${tabName}" already has ${existingRows.length - 1} data row(s) — not re-migrating.`);
    return;
  }

  if (!records.length) {
    console.log(`[ok]   "${tabName}" tab ready, no local records to migrate.`);
    return;
  }

  await appendSheet(SPREADSHEET_ID, range, records.map(toRow));
  console.log(`[done] "${tabName}": migrated ${records.length} record(s).`);
}

async function main() {
  if (!SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID is not set in .env — set it first (this is the target "master" spreadsheet).');
  }

  const sheets = await getSheets();

  await migrateTab({ sheets, tabName: 'WorkOrders', header: WORKORDERS_HEADER, records: loadJson('workorders.json'), toRow: workOrderRow });
  await migrateTab({ sheets, tabName: 'Users', header: USERS_HEADER, records: loadJson('users.json'), toRow: userRow });
  await migrateTab({ sheets, tabName: 'Personnel', header: PERSONNEL_HEADER, records: loadJson('personnel.json'), toRow: personnelRow });

  console.log('\nDone. Now set these in backend/.env (and in the Render dashboard for production):\n');
  console.log(`  WORKORDERS_SHEET_ID=${SPREADSHEET_ID}`);
  console.log(`  USERS_SHEET_ID=${SPREADSHEET_ID}`);
  console.log(`  PERSONNEL_SHEET_ID=${SPREADSHEET_ID}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
