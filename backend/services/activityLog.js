const { appendSheet, ensureSheetTab, getSheets } = require('./sheetsService');

const SHEET_NAME = 'SystemLog';
const HEADER = ['timestamp', 'userId', 'username', 'action', 'detail', 'ipAddress'];
const RANGE = `${SHEET_NAME}!A:F`;

async function logActivity(userId, username, action, detail, ip) {
  if (!process.env.SPREADSHEET_ID) return; // logging only meaningful once a master spreadsheet is configured
  try {
    const sheets = await getSheets();
    await ensureSheetTab(sheets, process.env.SPREADSHEET_ID, SHEET_NAME, [HEADER]);
    const timestamp = new Date().toISOString();
    const row = [timestamp, userId || '', username || '', action, detail || '', ip || ''];
    await appendSheet(process.env.SPREADSHEET_ID, RANGE, [row]);
  } catch (err) {
    console.error('Log error:', err.message); // fail silently, never block the main action
  }
}

module.exports = { logActivity, SHEET_NAME, RANGE, HEADER };
