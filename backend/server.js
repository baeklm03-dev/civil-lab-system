require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const workorderRoutes = require('./routes/workorders');
const personnelRoutes = require('./routes/personnel');
const reportRoutes = require('./routes/reports');
const exportRoutes = require('./routes/export');
const resultsRoutes = require('./routes/results');
const adminUsersRoutes = require('./routes/adminUsers');
const adminLogsRoutes = require('./routes/adminLogs');
const announcementsRoutes = require('./routes/announcements');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// crossOriginResourcePolicy ต้องเป็น cross-origin เพราะ frontend อยู่คนละ origin เสมอ
// (localhost:5173 -> :5000 ตอน dev, Vercel -> Render ตอน prod) ค่า default ของ helmet
// (same-origin) จะโดนเบราว์เซอร์บล็อก fetch ทั้งที่ CORS header ถูกต้องแล้วก็ตาม
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit ทุก /api/* route กันการยิงถล่ม — endpoint ที่ไวกว่านี้ (เช่น login) มี limiter เข้มกว่านี้ซ้อนอยู่อีกชั้น
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'มีการเรียกใช้งานถี่เกินไป กรุณาลองใหม่อีกครั้งภายหลัง' },
}));

// Request logger — always on (not just dev) so Render's log viewer has something to grep
// in production. Human-readable locally; structured JSON in production since a raw stdout
// stream with no log UI is only searchable as text.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, durationMs, ts: new Date().toISOString() }));
    } else {
      console.log(`[${new Date().toLocaleTimeString('th-TH')}] ${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`);
    }
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workorders', workorderRoutes);
app.use('/api/personnel', personnelRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/logs', adminLogsRoutes);
app.use('/api/announcements', announcementsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Alias for the literal path named in the dashboard spec — same data as /api/workorders/stats
app.get('/api/dashboard/summary', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await workorderRoutes.getDashboardSummary(startDate, endDate);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงสถิติ' });
  }
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'ไม่พบ endpoint นี้' });
});

// Global error handler — logged as structured JSON so it's greppable in Render's log viewer
app.use((err, req, res, _next) => {
  console.error(JSON.stringify({
    level: 'error', method: req.method, path: req.path,
    message: err.message, stack: err.stack, ts: new Date().toISOString(),
  }));
  res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
});

// Local JSON fallback (backend/data/*.json) lives on disk next to the process — fine for a
// persistent host, but wiped on every restart/redeploy on an ephemeral filesystem (e.g. Render
// free tier). Report which mode each module is actually in at boot so a misconfigured
// production env var (Sheet ID set locally but never copied to the host dashboard) shows up
// immediately in the log viewer instead of silently losing data on the next restart.
function reportStorageMode() {
  const modules = [
    ['WorkOrders', 'WORKORDERS_SHEET_ID'],
    ['Users', 'USERS_SHEET_ID'],
    ['Personnel', 'PERSONNEL_SHEET_ID'],
    ['Results / Announcements / ActivityLog', 'SPREADSHEET_ID'],
  ];
  const usingLocalFile = modules.filter(([, envVar]) => !process.env[envVar]);

  console.log('   Storage mode:');
  for (const [name, envVar] of modules) {
    const onSheets = !!process.env[envVar];
    console.log(`     - ${name}: ${onSheets ? `Google Sheets (${envVar})` : 'local JSON file (backend/data/)'}`);
  }

  if (process.env.NODE_ENV === 'production' && usingLocalFile.length) {
    console.warn(
      `\n   ⚠️  WARNING: running in production with ${usingLocalFile.length} module(s) on local JSON storage.\n` +
      '      If this host has an ephemeral filesystem (e.g. Render free tier), that data will be\n' +
      '      LOST on every restart/redeploy. Set the env var(s) above in the host dashboard to\n' +
      '      switch those modules to Google Sheets.\n'
    );
  }
}

app.listen(PORT, () => {
  console.log(`\n🚀 Civil Lab Backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  reportStorageMode();
  console.log('');
});
