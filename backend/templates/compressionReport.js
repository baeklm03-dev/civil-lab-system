function generateCompressionHTML({ order, specimens, remarks, tester_name, tester_name_th, logoBase64 }) {
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" style="width:96px;height:96px;object-fit:contain;" />`
    : '';

  const rows = (specimens || []).map((s, i) => {
    const ksc = s.ksc || (s.ultimate_stress ? (parseFloat(s.ultimate_stress) * 10.197).toFixed(0) : '');
    return `
      <tr>
        <td>${s.spec_no || i + 1}</td>
        <td>${s.area_cm2 || ''}</td>
        <td>${s.volume_cm3 || ''}</td>
        <td>${s.weight_kg || ''}</td>
        <td>${s.density || ''}</td>
        <td>${s.load_kn || ''}</td>
        <td>${s.ultimate_stress || ''}</td>
        <td>${ksc}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 18mm 15mm 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
  body { font-family: "Sarabun", "Sarabun New", "Times New Roman", serif; font-size: 11pt; color: #000; background: #fff; }
  .header { display: flex; align-items: flex-start; gap: 8px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
  .header-logo { width: 100px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .header-title { flex: 1; text-align: center; }
  .lab-name { font-size: 13pt; font-weight: bold; }
  .dept { font-size: 9.5pt; line-height: 1.4; }
  .header-ref { width: 0; flex-shrink: 0; }
  .report-title { text-align: center; font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 10px 0 10px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .info-table td { padding: 2px 4px; font-size: 10.5pt; }
  .info-table td.label { width: 175px; font-weight: bold; white-space: nowrap; }
  table.results { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 14px; }
  table.results th, table.results td { border: 1px solid #000; padding: 4px 5px; text-align: center; }
  table.results th { font-weight: bold; background: #e8e8e8; }
  table.results tbody td:first-child { font-weight: bold; }
  .remarks-section { font-size: 10.5pt; margin-bottom: 30px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 36px; }
  .sig-block { text-align: center; font-size: 10.5pt; }
  .sig-line { border-bottom: 1px solid #000; height: 32px; margin-bottom: 4px; }
  .sig-center { text-align: center; margin-top: 24px; font-size: 10.5pt; }
  .sig-center-inner { display: inline-block; min-width: 220px; text-align: center; }
  .sig-center-inner .sig-line { border-bottom: 1px solid #000; height: 32px; margin-bottom: 4px; }
  .footer { margin-top: 24px; border-top: 1px solid #000; padding-top: 8px; font-size: 9pt; }
  .footer-notes p { margin: 1px 0; }
  .page-row { display: flex; justify-content: space-between; margin-top: 6px; font-size: 9pt; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-logo">${logoImg}</div>
    <div class="header-title">
      <div class="lab-name">CIVIL ENGINEERING LABORATORY</div>
      <div class="dept">Department of Civil Engineering, Faculty of Engineering</div>
      <div class="dept">King Mongkut's University of Technology North Bangkok</div>
      <div class="dept">1518 Pracharat 1 Road, Bangsue, Bangkok 10800, Thailand</div>
      <div class="dept">Tel.: 0-2555-2000 Ext. 8628,8625 &nbsp;&nbsp;&nbsp; Fax.: 0-2587-4337</div>
    </div>
    <div class="header-ref"></div>
  </div>

  <div class="report-title">COMPRESSION TEST</div>

  <table class="info-table">
    <tr><td class="label">SPECIMEN FROM</td><td>: ${order.contractor || ''}</td></tr>
    <tr><td class="label">PROJECT NAME</td><td>: ${order.project_name || ''}</td></tr>
    <tr><td class="label">TYPE OF SPECIMEN</td><td>: ${order.sample_type || ''}</td></tr>
    <tr><td class="label">DATE OF CASTING</td><td>: ${order.casting_date || ''}</td></tr>
    <tr><td class="label">DATE OF TESTING</td><td>: ${order.received_date || ''}</td></tr>
  </table>

  <table class="results">
    <thead>
      <tr>
        <th>SPEC.<br>NO</th>
        <th>CROSS SECTIONAL<br>AREA (cm²)</th>
        <th>VOLUME<br>(cm³)</th>
        <th>WEIGHT<br>(kg)</th>
        <th>DENSITY<br>(gm/cm³)</th>
        <th>TOTAL LOAD<br>(kN)</th>
        <th>ULTIMATE STRESS<br>(MPa)</th>
        <th>REMARKS<br>(ksc)</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="remarks-section">
    <strong>โครงสร้าง/บริเวณที่เท :</strong> ${remarks ? ' ' + remarks : ''}
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div>Tested by</div>
      <div>(${tester_name_th || tester_name || '..................................'})</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div>Checked by</div>
      <div>(Nuttawut Thanasisathit)</div>
    </div>
  </div>

  <div class="sig-center">
    <div class="sig-center-inner">
      <div class="sig-line"></div>
      <div>Department Head</div>
      <div>(Nuttawut Thanasisathit)</div>
    </div>
  </div>

  <div class="footer">
    <div class="footer-notes">
      <strong>Remarks</strong>
      <p>1. The testing results are good only for those specimens tested.</p>
      <p>2. Not valid unless signed and sealed.</p>
    </div>
    <div class="page-row">
      <span>Job ID : ${order.ref_no || ''}</span>
      <span>1/1</span>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { generateCompressionHTML };
