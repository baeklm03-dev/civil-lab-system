const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { generateCompressionHTML } = require('../templates/compressionReport');
const { generateTensionHTML } = require('../templates/tensionReport');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, '../../frontend/src/mono-logo.png');
  if (fs.existsSync(logoPath)) {
    logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  }
} catch {
  console.warn('PDF: mono-logo.png not found in frontend/src/');
}

// POST /api/reports/generate
router.post('/generate', authMiddleware, async (req, res) => {
  const { type, order, specimens, specimenGroups, remarks, tester_name, tester_name_th } = req.body;

  let html;
  try {
    if (type === 'tension') {
      html = generateTensionHTML({
        order,
        specimenGroups: specimenGroups || [{ barSize: '', specimens: specimens || [] }],
        remarks,
        tester_name,
        tester_name_th,
        logoBase64,
      });
    } else {
      html = generateCompressionHTML({ order, specimens: specimens || [], remarks, tester_name, tester_name_th, logoBase64 });
    }
  } catch (err) {
    console.error('Report template error:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้าง template' });
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    return res.status(500).json({ success: false, message: 'puppeteer ยังไม่ได้ติดตั้ง — รัน: npm install puppeteer' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    const filename = `report-${type || 'compression'}-${order?.ref_no || 'unknown'}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length,
    });
    res.send(Buffer.from(pdf));
    await logActivity(req.user.id, req.user.username, 'GENERATE_PDF', `WorkOrder: ${order?.ref_no || 'unknown'}`, req.ip);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

// POST /api/reports/export-html — สร้าง PDF จาก HTML ดิบ (ใช้กับแบบฟอร์มเปล่าสำหรับบันทึกผลด้วยลายมือ)
router.post('/export-html', authMiddleware, async (req, res) => {
  const { html, filename } = req.body;
  if (!html) {
    return res.status(400).json({ success: false, message: 'ไม่มีเนื้อหาสำหรับสร้าง PDF' });
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    return res.status(500).json({ success: false, message: 'puppeteer ยังไม่ได้ติดตั้ง — รัน: npm install puppeteer' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename || 'document'}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(Buffer.from(pdf));
    await logActivity(req.user.id, req.user.username, 'GENERATE_PDF', filename || 'document', req.ip);
  } catch (err) {
    console.error('PDF export-html error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

module.exports = router;
