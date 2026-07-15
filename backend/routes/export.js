const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');
const localStore = require('../services/localStore');
const localResults = require('../services/localResults');
const { readSheet, rowsToObjects, calcTotalPrice } = require('../services/sheetsService');
const workorderRoutes = require('./workorders');
const { logActivity } = require('../services/activityLog');

const useSheets = () => !!process.env.WORKORDERS_SHEET_ID;

async function getAllOrders() {
  if (useSheets()) {
    const rows = await readSheet(process.env.WORKORDERS_SHEET_ID, 'WorkOrders!A:T');
    return rowsToObjects(rows);
  }
  return localStore.getAll();
}

// workOrderId (ref_no) → วันที่บันทึกผลทดสอบล่าสุด (จาก TestResults)
async function getLatestTestDates() {
  let results = [];
  if (process.env.SPREADSHEET_ID) {
    try {
      const rows = await readSheet(process.env.SPREADSHEET_ID, 'TestResults!A:Q');
      results = rowsToObjects(rows);
    } catch { results = []; }
  } else {
    results = localResults.getAll();
  }
  const latest = {};
  results.forEach((r) => {
    if (!r.workOrderId || !r.createdAt) return;
    if (!latest[r.workOrderId] || r.createdAt > latest[r.workOrderId]) latest[r.workOrderId] = r.createdAt;
  });
  return latest;
}

function testTypeLabel(order) {
  const t = workorderRoutes.resolveTestType(order);
  if (t === 'concrete') return 'คอนกรีต (Compression Test)';
  if (t === 'steel') return 'เหล็กเส้น (Tension Test)';
  return order.custom_test_name || 'อื่นๆ';
}

// Load Chart.js UMD bundle once at startup so Puppeteer doesn't need CDN
const CHARTJS_SRC = (() => {
  try {
    return fs.readFileSync(
      path.join(__dirname, '../node_modules/chart.js/dist/chart.umd.min.js'),
      'utf8'
    );
  } catch { return null; }
})();

const router = express.Router();

// ── helpers ───────────────────────────────────────────────

function getLast6Months(orders) {
  const thaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return {
      month: thaiMonths[d.getMonth()],
      count: orders.filter((o) => o.received_date?.startsWith(key)).length,
    };
  });
}

// Render chart PNG via puppeteer
async function renderChartPNG(chartConfig, width = 560, height = 280) {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch { return null; }

  const html = `<!DOCTYPE html><html><head>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;width:${width}px;height:${height}px;}canvas{display:block;}</style>
    <script>${CHARTJS_SRC || ''}</script>
  </head><body>
    <canvas id="c" width="${width}" height="${height}"></canvas>
    <script>
      new Chart(document.getElementById('c'), ${JSON.stringify(chartConfig)});
    </script>
  </body></html>`;

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 400));
    const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return png;
  } catch { return null; }
  finally { if (browser) await browser.close().catch(() => {}); }
}

// GET /api/export/dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const orders = await getAllOrders();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // byType: group by sample_type dynamically
    const typeMap = {};
    orders.forEach((o) => {
      const t = o.sample_type || 'ไม่ระบุ';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });

    const stats = {
      total:     orders.length,
      thisMonth: orders.filter((o) => o.received_date?.startsWith(thisMonth)).length,
      pending:   orders.filter((o) => ['รับเรื่อง', 'รอข้อมูล', 'ดำเนินการ'].includes(o.status)).length,
      completed: orders.filter((o) => o.status === 'เสร็จสิ้น').length,
      byStatus: {
        'รับเรื่อง':  orders.filter((o) => o.status === 'รับเรื่อง').length,
        'รอข้อมูล':  orders.filter((o) => o.status === 'รอข้อมูล').length,
        'ดำเนินการ': orders.filter((o) => o.status === 'ดำเนินการ').length,
        'เสร็จสิ้น':  orders.filter((o) => o.status === 'เสร็จสิ้น').length,
      },
      byType: typeMap,
      monthlyTrend: getLast6Months(orders),
    };

    const totalSamples = orders.reduce((sum, o) => sum + (parseInt(o.sample_count) || 0), 0);

    // ── Render charts ─────────────────────────────────────
    const lineChartConfig = {
      type: 'line',
      data: {
        labels: stats.monthlyTrend.map((m) => m.month),
        datasets: [{
          label: 'จำนวนงาน',
          data: stats.monthlyTrend.map((m) => m.count),
          borderColor: '#fb923c',
          backgroundColor: 'rgba(251,146,60,0.15)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointBackgroundColor: '#fb923c',
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false }, title: { display: true, text: 'แนวโน้มงาน 6 เดือนล่าสุด', font: { size: 13 } } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    };

    const pieLabels = Object.keys(stats.byType);
    const pieValues = Object.values(stats.byType);
    const PIE_COLORS = ['#E8600A', '#F5A96B', '#FAEEDA', '#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa'];
    const pieChartConfig = {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieValues,
          backgroundColor: PIE_COLORS.slice(0, pieLabels.length),
          borderWidth: 1,
        }],
      },
      options: {
        responsive: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 12 } } },
          title: { display: true, text: 'สัดส่วนประเภทตัวอย่าง', font: { size: 13 } },
        },
      },
    };

    const [linePng, piePng] = await Promise.all([
      renderChartPNG(lineChartConfig, 560, 260),
      renderChartPNG(pieChartConfig, 480, 260),
    ]);

    // ── Build workbook ────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Civil Lab System';
    wb.created = new Date();

    // ── Sheet 1: ภาพรวม ───────────────────────────────────
    const ws1 = wb.addWorksheet('ภาพรวมระบบ');
    ws1.properties.defaultColWidth = 20;

    const exportDateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    // Title
    ws1.mergeCells('A1:D1');
    const titleCell = ws1.getCell('A1');
    titleCell.value = `รายงานภาพรวมระบบ — ส่งออกวันที่ ${exportDateStr}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    ws1.getRow(1).height = 28;

    ws1.getRow(2).height = 10;

    // Summary table header
    const hRow = ws1.getRow(3);
    ['รายการ', 'จำนวน'].forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    hRow.height = 22;

    const summaryRows = [
      ['งานทั้งหมด',     stats.total],
      ['งานเดือนนี้',    stats.thisMonth],
      ['รอดำเนินการ',   stats.pending],
      ['เสร็จสิ้น',      stats.completed],
      ['ตัวอย่างทั้งหมด (ชิ้น)', totalSamples],
    ];

    summaryRows.forEach((row, idx) => {
      const r = ws1.getRow(4 + idx);
      r.getCell(1).value = row[0];
      r.getCell(2).value = row[1];
      [1, 2].forEach((c) => {
        const cell = r.getCell(c);
        cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'center' : 'left' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
      });
      r.height = 20;
    });

    ws1.getColumn(1).width = 26;
    ws1.getColumn(2).width = 14;

    // Status breakdown
    const statusStartRow = 11;
    ws1.getRow(statusStartRow - 1).height = 12;
    const shRow = ws1.getRow(statusStartRow);
    ['สถานะ', 'จำนวนงาน'].forEach((h, i) => {
      const cell = shRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    shRow.height = 22;

    const statusColors = { 'รับเรื่อง': 'FFdbeafe', 'รอข้อมูล': 'FFfef9c3', 'ดำเนินการ': 'FFfee2e2', 'เสร็จสิ้น': 'FFdcfce7' };
    Object.entries(stats.byStatus).forEach(([status, count], idx) => {
      const r = ws1.getRow(statusStartRow + 1 + idx);
      r.getCell(1).value = status;
      r.getCell(2).value = count;
      [1, 2].forEach((c) => {
        const cell = r.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[status] || 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'center' : 'left' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      r.height = 20;
    });

    // Embed chart images
    let chartRow = 17;
    ws1.getRow(chartRow - 1).height = 14;

    if (linePng) {
      const lineImgId = wb.addImage({ buffer: linePng, extension: 'png' });
      ws1.addImage(lineImgId, { tl: { col: 0, row: chartRow - 1 }, ext: { width: 560, height: 260 } });
      chartRow += 17;
    }

    if (piePng) {
      const pieImgId = wb.addImage({ buffer: piePng, extension: 'png' });
      ws1.addImage(pieImgId, { tl: { col: 0, row: chartRow }, ext: { width: 480, height: 260 } });
    }

    // ── Sheet 2: ใบงานทดสอบ ──────────────────────────────
    const ws2 = wb.addWorksheet('ใบงานทดสอบ');

    const headers = ['REF NO.', 'โครงการ', 'ผู้รับเหมา', 'ประเภทตัวอย่าง', 'วันที่รับ', 'Google Sheet', 'สถานะ'];
    const colWidths = [16, 36, 28, 20, 14, 40, 14];

    const headerRow = ws2.getRow(1);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      ws2.getColumn(i + 1).width = colWidths[i];
    });
    headerRow.height = 24;

    const statusFill = {
      'รับเรื่อง':  { argb: 'FFdbeafe' },
      'รอข้อมูล':  { argb: 'FFfef9c3' },
      'ดำเนินการ': { argb: 'FFfee2e2' },
      'เสร็จสิ้น':  { argb: 'FFdcfce7' },
    };

    orders.forEach((o, idx) => {
      const r = ws2.getRow(2 + idx);
      const rowFill = idx % 2 === 0 ? null : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

      const vals = [o.ref_no, o.project_name || '', o.contractor || '', o.sample_type || '', o.received_date || '', null, o.status || ''];
      vals.forEach((v, ci) => {
        const cell = r.getCell(ci + 1);
        if (ci === 5) {
          // Google Sheet link
          if (o.sheet_url) {
            cell.value = { text: 'เปิด Sheet', hyperlink: o.sheet_url };
            cell.font = { color: { argb: 'FF0563C1' }, underline: true };
          } else {
            cell.value = '—';
            cell.font = { color: { argb: 'FF9CA3AF' } };
          }
        } else {
          cell.value = v;
          if (ci === 6 && statusFill[v]) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: statusFill[v] };
            cell.font = { bold: true };
          } else if (rowFill) {
            cell.fill = rowFill;
          }
        }
        cell.alignment = { vertical: 'middle', horizontal: ci === 5 ? 'center' : 'left' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      r.height = 20;
    });

    // Freeze header row
    ws2.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Send file ─────────────────────────────────────────
    const dateTag = now.toISOString().slice(0, 10);
    const filename = `civil-lab-export-${dateTag}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการ export: ' + err.message });
  }
});

// GET /api/export — รายการใบงาน filter ตามช่วงวันที่/ประเภทการทดสอบ, ไฟล์ xlsx หรือ csv
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, testType, format = 'xlsx' } = req.query;

    let orders = await getAllOrders();
    orders = workorderRoutes.filterByDateRange(orders, startDate, endDate);
    if (testType) orders = orders.filter((o) => workorderRoutes.resolveTestType(o) === testType);

    const testedDates = await getLatestTestDates();
    const headers = ['REF NO.', 'ประเภทการทดสอบ', 'ชื่อลูกค้า', 'บริษัท', 'ชื่อโครงการ', 'จำนวนตัวอย่าง', 'ราคารวม', 'วันที่รับงาน', 'วันที่ทดสอบ', 'สถานะ'];
    const rows = orders.map((o) => ([
      o.ref_no || '',
      testTypeLabel(o),
      o.customer_name || '',
      o.company || '',
      o.project_name || '',
      o.sample_count || '',
      calcTotalPrice(o.test_items),
      o.received_date || '',
      testedDates[o.ref_no] ? testedDates[o.ref_no].slice(0, 10) : '',
      o.status || '',
    ]));

    const dateTag = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const csvBody = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="workorders-${dateTag}.csv"`);
      res.send('﻿' + csvBody);
      await logActivity(req.user.id, req.user.username, 'EXPORT_DATA', `Format: csv, Range: ${startDate || ''}–${endDate || ''}`, req.ip);
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Civil Lab System';
    wb.created = new Date();
    const ws = wb.addWorksheet('ใบงานทดสอบ');

    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 22;
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => { c.width = 18; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="workorders-${dateTag}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
    await logActivity(req.user.id, req.user.username, 'EXPORT_DATA', `Format: ${format}, Range: ${startDate || ''}–${endDate || ''}`, req.ip);
  } catch (err) {
    console.error('Export list error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการ export: ' + err.message });
  }
});

module.exports = router;
