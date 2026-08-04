const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyGoogleApiError,
  GoogleRateLimitError,
  GooglePermissionError,
  GoogleNotFoundError,
} = require('./googleApiErrors');
const { withRetry } = require('./googleApiRetry');

const CLIENT_MODULE_PATH = require.resolve('./googleSheetsClient');

function setFakeEnv() {
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'fake-sa@example-project.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nFAKEFAKEFAKE\\n-----END PRIVATE KEY-----\\n';
  process.env.GOOGLE_PROJECT_ID = 'example-project';
}

// googleSheetsClient.js validates env + builds its auth singleton at module-load time,
// so each test that needs a fresh instance (different env, fresh mocks) must clear the
// require cache and re-require it.
function loadClientModule() {
  delete require.cache[CLIENT_MODULE_PATH];
  return require('./googleSheetsClient');
}

// ── googleApiErrors ──────────────────────────────────────────────

test('classifyGoogleApiError maps a 429 to GoogleRateLimitError', () => {
  const raw = { code: 429, message: 'Too many requests' };
  const classified = classifyGoogleApiError(raw);
  assert.ok(classified instanceof GoogleRateLimitError);
  assert.equal(classified.retryable, true);
});

test('classifyGoogleApiError maps a 403 permission-denied body to GooglePermissionError', () => {
  const raw = {
    code: 403,
    message: 'The caller does not have permission',
    errors: [{ reason: 'forbidden', message: 'The caller does not have permission' }],
  };
  const classified = classifyGoogleApiError(raw);
  assert.ok(classified instanceof GooglePermissionError);
  assert.equal(classified.retryable, false);
});

test('classifyGoogleApiError maps a 403 rate-limit reason to GoogleRateLimitError, not GooglePermissionError', () => {
  const raw = {
    code: 403,
    message: 'User rate limit exceeded',
    errors: [{ reason: 'userRateLimitExceeded', message: 'User rate limit exceeded' }],
  };
  assert.ok(classifyGoogleApiError(raw) instanceof GoogleRateLimitError);
});

test('classifyGoogleApiError maps a 404 to GoogleNotFoundError', () => {
  const raw = { code: 404, message: 'Requested entity was not found.' };
  const classified = classifyGoogleApiError(raw);
  assert.ok(classified instanceof GoogleNotFoundError);
  assert.equal(classified.retryable, false);
});

// ── googleApiRetry ───────────────────────────────────────────────

test('withRetry retries a GoogleRateLimitError up to maxRetries then throws', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    throw new GoogleRateLimitError('rate limited');
  };

  await assert.rejects(
    () => withRetry(fn, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2 }),
    GoogleRateLimitError,
  );
  assert.equal(calls, 4); // initial attempt + 3 retries
});

test('withRetry does NOT retry a GooglePermissionError', async () => {
  let calls = 0;
  const fn = async () => {
    calls++;
    throw new GooglePermissionError('sheet not shared with service account');
  };

  await assert.rejects(
    () => withRetry(fn, { maxRetries: 5, baseDelayMs: 1 }),
    GooglePermissionError,
  );
  assert.equal(calls, 1); // no retries spent on a non-retryable error
});

// ── googleSheetsClient ───────────────────────────────────────────

test('throws at load time if GOOGLE_SERVICE_ACCOUNT_EMAIL is missing', () => {
  setFakeEnv();
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  assert.throws(() => loadClientModule(), /GOOGLE_SERVICE_ACCOUNT_EMAIL/);
});

test('createSpreadsheet returns the new spreadsheet ID on success', async (t) => {
  setFakeEnv();
  const { sheetsClient, createSpreadsheet } = loadClientModule();

  t.mock.method(sheetsClient.spreadsheets, 'create', async () => ({
    data: { spreadsheetId: 'sheet-123' },
  }));

  const id = await createSpreadsheet('Work Order Sheet', ['No 01']);
  assert.equal(id, 'sheet-123');
});
