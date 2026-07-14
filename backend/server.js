require('dotenv').config();
const express = require('express');
const cors = require('cors');

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
const { router: googleAuthRoutes } = require('./routes/googleAuth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] ${req.method} ${req.path}`);
    next();
  });
}

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
app.use('/api/google-auth', googleAuthRoutes);

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

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Civil Lab Backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
});
