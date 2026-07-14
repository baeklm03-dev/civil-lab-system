function pageHTML({ order, specimens, barSize, pageNum, totalPages, remarks, tester_name, tester_name_th, logoBase64, isLast }) {
  const logoImg = logoBase64
    ? `<img src="${logoBase64}" style="width:96px;height:96px;object-fit:contain;" />`
    : '';

  const rows = (specimens || []).map((s, i) => `
    <tr>
      <td>${s.spec_no || i + 1}</td>
      <td>${s.nominal_size || ''}</td>
      <td>${s.weight_kg_m || ''}</td>
      <td>${s.tested_dia || ''}</td>
      <td>${s.nominal_area || ''}</td>
      <td>${s.yield_kn || ''}</td>
      <td>${s.ultimate_kn || ''}</td>
      <td>${s.yield_mpa || ''}</td>
      <td>${s.ultimate_mpa || ''}</td>
      <td>${s.elongation_pct || ''}</td>
      <td>${s.gauge_length || ''}</td>
    </tr>`).join('');

  const sigSection = isLast ? `
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
    </div>` : '';

  return `
  <div class="page${!isLast ? ' page-break' : ''}">
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

    <div class="report-title">TENSION TEST</div>

    <table class="info-table">
      <tr><td class="label">SPECIMEN FROM</td><td>: ${order.contractor || ''}</td></tr>
      <tr><td class="label">PROJECT NAME</td><td>: ${order.project_name || ''}</td></tr>
      <tr><td class="label">TYPE OF SPECIMEN</td><td>: ${order.sample_type || ''}${barSize ? ' — ' + barSize : ''}</td></tr>
      <tr><td class="label">DATE OF TESTING</td><td>: ${order.received_date || ''}</td></tr>
    </table>

    <table class="results">
      <thead>
        <tr>
          <th>SPEC.<br>NO</th>
          <th>NOMINAL<br>SIZE (mm)</th>
          <th>WEIGHT<br>(kg/m)</th>
          <th>TESTED<br>DIA. (mm)</th>
          <th>NOMINAL<br>AREA (cm²)</th>
          <th>LOAD<br>YIELD (kN)</th>
          <th>LOAD<br>ULT. (kN)</th>
          <th>STRESS<br>YIELD (MPa)</th>
          <th>STRESS<br>ULT. (MPa)</th>
          <th>ELONG.<br>(%)</th>
          <th>GAUGE<br>LEN. (cm)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="remarks-section">
      <strong>REMARKS :</strong>${remarks && isLast ? ' ' + remarks : ''}
    </div>

    ${sigSection}

    <div class="footer">
      <div class="footer-notes">
        <strong>Remarks</strong>
        <p>1. The testing results are good only for those specimens tested.</p>
        <p>2. Not valid unless signed and sealed.</p>
      </div>
      <div class="page-row">
        <span>Job ID : ${order.ref_no || ''}</span>
        <span>${pageNum}/${totalPages}</span>
      </div>
    </div>
  </div>`;
}

function generateTensionHTML({ order, specimenGroups, remarks, tester_name, tester_name_th, logoBase64 }) {
  const groups = specimenGroups || [];
  const totalPages = groups.length || 1;

  const pages = groups.map((group, idx) =>
    pageHTML({
      order,
      specimens: group.specimens || [],
      barSize: group.barSize || '',
      pageNum: idx + 1,
      totalPages,
      remarks,
      tester_name,
      tester_name_th,
      logoBase64,
      isLast: idx === groups.length - 1,
    })
  ).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 18mm 15mm 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
  body { font-family: "Sarabun", "Sarabun New", "Times New Roman", serif; font-size: 10pt; color: #000; background: #fff; }
  .page-break { page-break-after: always; }
  .header { display: flex; align-items: flex-start; gap: 8px; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .header-logo { width: 100px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .header-title { flex: 1; text-align: center; }
  .lab-name { font-size: 12pt; font-weight: bold; }
  .dept { font-size: 9pt; line-height: 1.4; }
  .header-ref { width: 0; flex-shrink: 0; }
  .report-title { text-align: center; font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 8px 0; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .info-table td { padding: 2px 4px; font-size: 10pt; }
  .info-table td.label { width: 170px; font-weight: bold; white-space: nowrap; }
  table.results { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 12px; }
  table.results th, table.results td { border: 1px solid #000; padding: 3px 2px; text-align: center; }
  table.results th { font-weight: bold; background: #e8e8e8; }
  .remarks-section { font-size: 10pt; margin-bottom: 24px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 28px; }
  .sig-block { text-align: center; font-size: 10pt; }
  .sig-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 4px; }
  .sig-center { text-align: center; margin-top: 20px; font-size: 10pt; }
  .sig-center-inner { display: inline-block; min-width: 220px; text-align: center; }
  .sig-center-inner .sig-line { border-bottom: 1px solid #000; height: 30px; margin-bottom: 4px; }
  .footer { margin-top: 20px; border-top: 1px solid #000; padding-top: 6px; font-size: 9pt; }
  .footer-notes p { margin: 1px 0; }
  .page-row { display: flex; justify-content: space-between; margin-top: 4px; font-size: 9pt; }
</style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

module.exports = { generateTensionHTML };
