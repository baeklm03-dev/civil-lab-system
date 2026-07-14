const express = require('express');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { generateCompressionHTML } = require('../templates/compressionReport');
const { generateTensionHTML } = require('../templates/tensionReport');

const router = express.Router();

let logoBase64 = '';
try {
  const logoPath = path.join(__dirname, '../assets/logo.png');
  if (fs.existsSync(logoPath)) {
    logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  }
} catch {
  console.warn('PDF: logo.png not found in backend/assets/');
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
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

module.exports = router;
