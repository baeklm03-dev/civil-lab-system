const { google } = require('googleapis');
const { withRetry } = require('./googleApiRetry');
const { classifyGoogleApiError } = require('./googleApiErrors');

/**
 * Single point of contact between the app and the Google Sheets/Drive APIs.
 * Auth is Service Account (JWT) only — no interactive OAuth2 user flow, no per-user
 * token storage. Every sheet/file this touches must be shared with GOOGLE_SERVICE_ACCOUNT_EMAIL.
 */

const REQUIRED_ENV_VARS = ['GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY'];

function assertRequiredEnv() {
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      throw new Error(
        `[googleSheetsClient] Missing required env var: ${key}. ` +
        'Set it in .env (see .env.example) before starting the server.'
      );
    }
  }
}

// Fail fast at boot, not on the first request.
assertRequiredEnv();

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Hosting dashboards (Railway/Render) usually store the key with literal "\n"
    // sequences instead of real newlines — undo that here.
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    project_id: process.env.GOOGLE_PROJECT_ID,
  },
  // GoogleAuth caches and auto-refreshes the short-lived access token internally —
  // this instance is created once (module load) and reused, so that caching works.
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

/** Ready-to-use Sheets API v4 client, shared across the whole app. */
const sheetsClient = google.sheets({ version: 'v4', auth });
/** Ready-to-use Drive API v3 client, shared across the whole app. */
const driveClient = google.drive({ version: 'v3', auth });

function logCall(method, durationMs, success, retries) {
  console.log(JSON.stringify({
    scope: 'googleSheetsClient', method, durationMs, success, retries,
    ts: new Date().toISOString(),
  }));
}

/**
 * Wraps a raw googleapis call with retry + structured logging + typed-error rethrow.
 * @template T
 * @param {string} apiMethod
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function callWithLogging(apiMethod, fn) {
  const start = Date.now();
  let retries = 0;
  try {
    const result = await withRetry(fn, {
      apiMethod,
      onRetry: (attempt) => { retries = attempt; },
    });
    logCall(apiMethod, Date.now() - start, true, retries);
    return result;
  } catch (rawError) {
    logCall(apiMethod, Date.now() - start, false, retries);
    throw rawError instanceof Error && 'retryable' in rawError
      ? rawError
      : classifyGoogleApiError(rawError, apiMethod);
  }
}

/**
 * Creates a new spreadsheet with the given tab names.
 * @param {string} title
 * @param {string[]} [sheetTitles]
 * @returns {Promise<string>} the new spreadsheet's ID
 * @throws {import('./googleApiErrors').GoogleApiError}
 */
async function createSpreadsheet(title, sheetTitles = []) {
  return callWithLogging('createSpreadsheet', async () => {
    const res = await sheetsClient.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: sheetTitles.map((sheetTitle) => ({ properties: { title: sheetTitle } })),
      },
      fields: 'spreadsheetId',
    });
    return res.data.spreadsheetId;
  });
}

/**
 * Appends rows to the end of the given range.
 * @param {string} spreadsheetId
 * @param {string} range
 * @param {unknown[][]} rows
 * @returns {Promise<void>}
 * @throws {import('./googleApiErrors').GoogleApiError}
 */
async function appendRows(spreadsheetId, range, rows) {
  return callWithLogging('appendRows', async () => {
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });
  });
}

/**
 * Reads all values in the given range.
 * @param {string} spreadsheetId
 * @param {string} range
 * @returns {Promise<unknown[][]>}
 * @throws {import('./googleApiErrors').GoogleApiError}
 */
async function readRange(spreadsheetId, range) {
  return callWithLogging('readRange', async () => {
    const res = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range });
    return res.data.values || [];
  });
}

/**
 * Overwrites values in the given range.
 * @param {string} spreadsheetId
 * @param {string} range
 * @param {unknown[][]} rows
 * @returns {Promise<void>}
 * @throws {import('./googleApiErrors').GoogleApiError}
 */
async function updateRange(spreadsheetId, range, rows) {
  return callWithLogging('updateRange', async () => {
    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  });
}

/**
 * Shares a Drive file with a specific email address. Typically called right after
 * createSpreadsheet if the result must be handed to a human (e.g. a department head).
 * @param {string} fileId
 * @param {string} email
 * @param {'writer' | 'reader'} role
 * @returns {Promise<void>}
 * @throws {import('./googleApiErrors').GoogleApiError}
 */
async function shareWithEmail(fileId, email, role) {
  return callWithLogging('shareWithEmail', async () => {
    await driveClient.permissions.create({
      fileId,
      requestBody: { role, type: 'user', emailAddress: email },
    });
  });
}

module.exports = {
  sheetsClient,
  driveClient,
  createSpreadsheet,
  appendRows,
  readRange,
  updateRange,
  shareWithEmail,
};
