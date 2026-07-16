import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workorderAPI, reportAPI } from '../services/api'
import { useToast } from '../hooks/useToast'
import monoLogo from '../mono-logo.png'

function detectTestType(order) {
  if (!order) return 'concrete'
  if (order.test_type) return order.test_type
  const t = (order.sample_type || '').toLowerCase()
  if (['steel', 'rebar', 'db', 'rb', 'bar'].some((k) => t.includes(k))) return 'steel'
  return 'concrete'
}

// ค่าว่าง -> เส้นประให้กรอกด้วยลายมือ, มีข้อมูล -> แสดงค่าจริง
const BLANK = '..........................................'
function fv(value) {
  const s = value == null ? '' : String(value).trim()
  return s || BLANK
}

// เดาชนิด/ขนาดเหล็กเส้นจาก test_items ถ้ามีรายการเดียวที่ระบุชัดเจน (ไม่เดาถ้ามีหลายขนาดปนกัน)
function detectBarType(order) {
  const items = order.test_items || []
  if (items.length !== 1 || !items[0].bar_size) return { type: '', size: '' }
  const m = String(items[0].bar_size).match(/^(PC|DB|RB)\s*(\d+(?:\.\d+)?)/i)
  if (!m) return { type: '', size: '' }
  return { type: m[1].toUpperCase(), size: m[2] }
}

const PRINT_STYLE = `
  .print-report { font-family: "Sarabun", "Times New Roman", serif; font-size: 11pt; color: #000; background: #fff; width: 100%; }
  .print-header { display: flex; align-items: flex-start; gap: 8px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
  .print-header-logo { width: 100px; flex-shrink: 0; }
  .print-header-title { flex: 1; text-align: center; }
  .print-lab-name { font-size: 13pt; font-weight: bold; }
  .print-dept { font-size: 9.5pt; line-height: 1.4; }
  .print-title { text-align: center; font-size: 13pt; font-weight: bold; text-decoration: underline; margin: 10px 0; }
  .print-info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .print-info-table td { padding: 2px 4px; font-size: 10.5pt; }
  .print-info-table td.label { width: 175px; font-weight: bold; white-space: nowrap; }
  .print-checkboxes { display: flex; gap: 24px; align-items: center; font-size: 10.5pt; margin: 6px 0 12px; flex-wrap: wrap; }
  .print-checkbox { display: flex; align-items: center; gap: 6px; }
  .print-checkbox-box { width: 13px; height: 13px; border: 1px solid #000; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  table.print-results { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 14px; }
  table.print-results th, table.print-results td { border: 1px solid #000; padding: 4px 5px; text-align: center; height: 24px; }
  table.print-results th { font-weight: bold; background: #e8e8e8; }
  @media print {
    body * { visibility: hidden; }
    #print-root, #print-root * { visibility: visible; }
    #print-root { position: absolute; top: 0; left: 0; width: 100%; }
    #print-root .no-print, #print-root .no-print * { display: none !important; visibility: hidden !important; }
    @page { size: A4; margin: 15mm; }
  }
`

function ReportHeader({ title }) {
  return (
    <>
      <div className="print-header">
        <div className="print-header-logo"><img src={monoLogo} alt="logo" style={{ width: '100%', objectFit: 'contain' }} /></div>
        <div className="print-header-title">
          <div className="print-lab-name">CIVIL ENGINEERING LABORATORY</div>
          <div className="print-dept">Department of Civil Engineering</div>
          <div className="print-dept">Faculty of Engineering</div>
          <div className="print-dept">King Mongkut's University of Technology North Bangkok</div>
          <div className="print-dept">1518 Pracharat 1 Road, Bangsue, Bangkok 10800, Thailand</div>
          <div className="print-dept">Tel.: 02-555-2000 Ext. 8628 - 26 ต่อ 10 - 13 &nbsp;&nbsp;&nbsp; Fax.: 02-587-4337</div>
        </div>
        <div style={{ width: 0, flexShrink: 0 }} />
      </div>
      <div className="print-title">{title}</div>
    </>
  )
}

function Checkbox({ checked, label }) {
  return (
    <span className="print-checkbox">
      <span className="print-checkbox-box">{checked ? '✓' : ''}</span>
      {label}
    </span>
  )
}

function CompressionForm({ order }) {
  const rows = Array.from({ length: 20 })
  const shape = (order.sample_type || '').toLowerCase()
  const isCube = shape === 'cube'
  const isCylinder = shape === 'cylinder' || shape === 'cylinder cap'
  const isCoring = shape === 'coring'
  const isOther = order.sample_type && !isCube && !isCylinder && !isCoring

  return (
    <div className="print-report">
      <ReportHeader title="COMPRESSION TEST" />
      <table className="print-info-table"><tbody>
        <tr><td className="label">SPECIMEN FROM</td><td>: {fv(order.contractor)}</td></tr>
        <tr><td className="label">PROJECT NAME</td><td>: {fv(order.project_name)}</td></tr>
        <tr><td className="label">COMPANY</td><td>: {fv(order.company)}</td></tr>
        <tr><td className="label">TEST DATE</td><td>: {BLANK}</td></tr>
      </tbody></table>
      <div className="print-checkboxes">
        <Checkbox checked={isCube} label="CUBE" />
        <Checkbox checked={isCylinder} label="CYLINDER" />
        <Checkbox checked={isCoring} label="CORING" />
        <Checkbox checked={isOther} label={`OTHER: ${isOther ? order.sample_type : BLANK}`} />
      </div>
      <table className="print-results">
        <thead>
          <tr>
            <th rowSpan={2}>SPEC.<br />No.</th>
            <th rowSpan={2}>CASTING<br />DATE</th>
            <th colSpan={3}>DIMENSION</th>
            <th rowSpan={2}>WEIGHT<br />(KG)</th>
            <th rowSpan={2}>ULTIMATE LOAD<br />(KN)</th>
            <th rowSpan={2}>REMARK</th>
          </tr>
          <tr><th>1</th><th>2</th><th>3</th></tr>
        </thead>
        <tbody>{rows.map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((__, c) => <td key={c}>&nbsp;</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function TensionForm({ order }) {
  const rows = Array.from({ length: 20 })
  const { type, size } = detectBarType(order)

  return (
    <div className="print-report">
      <ReportHeader title="TENSION TEST" />
      <table className="print-info-table"><tbody>
        <tr><td className="label">SPECIMEN FROM</td><td>: {fv(order.contractor)}</td></tr>
        <tr><td className="label">PRODUCTION COMPANY</td><td>: {BLANK}</td></tr>
        <tr><td className="label">PROJECT NAME</td><td>: {fv(order.project_name)}</td></tr>
      </tbody></table>
      <div className="print-checkboxes">
        <span style={{ fontWeight: 'bold' }}>TYPE OF SPECIMEN:</span>
        <Checkbox checked={type === 'PC'} label="PC" />
        <Checkbox checked={type === 'DB'} label="DB" />
        <Checkbox checked={type === 'RB'} label="RB" />
        <span>NOMINAL SIZED {size || BLANK} mm.</span>
      </div>
      <table className="print-info-table"><tbody>
        <tr><td className="label">DATE OF TESTING</td><td>: {BLANK}</td><td className="label" style={{ width: 100 }}>TESTED BY</td><td>: {BLANK}</td></tr>
      </tbody></table>
      <table className="print-results">
        <thead><tr>
          <th>SPEC.<br />No.</th><th>LENGTH<br />(cm.)</th><th>WEIGHT<br />(g)</th>
          <th>YIELD<br />(kN)</th><th>ULTIMATE<br />(kN)</th><th>ELONGATION<br />(cm.)</th>
          <th>G.L<br />(cm.)</th><th>REMARK</th>
        </tr></thead>
        <tbody>{rows.map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((__, c) => <td key={c}>&nbsp;</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function OtherForm({ order, columns, setColumns, headerFields, setHeaderFields, title, setTitle, onSave }) {
  const rows = Array.from({ length: 20 })
  const updateColumn = (idx, key, val) => setColumns((cols) => cols.map((c, i) => i === idx ? { ...c, [key]: val } : c))
  const updateHeaderField = (idx, val) => setHeaderFields((fs) => fs.map((f, i) => i === idx ? val : f))

  return (
    <div>
      <div className="no-print bg-white border border-gray-200 rounded-xl p-4 space-y-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-gray-700">ชื่อหัวข้อทดสอบ</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500">หัวข้อบนที่ต้องกรอก (แสดงเป็นเส้นให้กรอกด้วยลายมือ)</p>
          {headerFields.map((f, i) => (
            <div key={i} className="flex gap-2">
              <input value={f} onChange={(e) => updateHeaderField(i, e.target.value)} placeholder="เช่น SPECIMEN FROM"
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400" />
              {headerFields.length > 1 && (
                <button onClick={() => setHeaderFields((fs) => fs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 px-1">
                  <i className="ti ti-trash text-xs" />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setHeaderFields((fs) => [...fs, ''])} className="text-xs text-orange-400 hover:underline flex items-center gap-1">
            <i className="ti ti-plus text-xs" /> เพิ่มหัวข้อ
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500">คอลัมน์ในตาราง (ชื่อ + หน่วย)</p>
          {columns.map((col, i) => (
            <div key={i} className="flex gap-2">
              <input value={col.name} onChange={(e) => updateColumn(i, 'name', e.target.value)} placeholder="ชื่อคอลัมน์"
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400" />
              <input value={col.unit} onChange={(e) => updateColumn(i, 'unit', e.target.value)} placeholder="หน่วย"
                className="w-24 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400" />
              {columns.length > 1 && (
                <button onClick={() => setColumns((cols) => cols.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 px-1">
                  <i className="ti ti-trash text-xs" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button onClick={() => setColumns((cols) => [...cols, { name: '', unit: '' }])} className="text-xs text-orange-400 hover:underline flex items-center gap-1">
              <i className="ti ti-plus text-xs" /> เพิ่มคอลัมน์
            </button>
            <button onClick={onSave} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
              <i className="ti ti-device-floppy text-xs" /> บันทึกลงใบงาน
            </button>
          </div>
        </div>
      </div>

      <div className="print-report">
        <ReportHeader title={title || 'TEST'} />
        <table className="print-info-table"><tbody>
          {headerFields.filter((f) => f.trim()).map((f, i) => (
            <tr key={i}><td className="label">{f}</td><td>: {BLANK}</td></tr>
          ))}
        </tbody></table>
        <table className="print-results">
          <thead><tr>
            <th>SPEC.<br />NO</th>
            {columns.map((c, i) => <th key={i}>{c.name || `Col ${i + 1}`}{c.unit ? <><br />({c.unit})</> : ''}</th>)}
          </tr></thead>
          <tbody>{rows.map((_, i) => <tr key={i}><td>&nbsp;</td>{columns.map((_, c) => <td key={c}>&nbsp;</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

export default function PrintFormPage() {
  const { refNo } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testType, setTestType] = useState('concrete')
  const [customTitle, setCustomTitle] = useState('')
  const [customColumns, setCustomColumns] = useState([{ name: '', unit: '' }])
  const [headerFields, setHeaderFields] = useState([''])
  const [generating, setGenerating] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    workorderAPI.getOne(refNo)
      .then(({ data }) => {
        const o = data.data
        setOrder(o)
        setTestType(detectTestType(o))
        setCustomTitle(o.custom_test_name || '')
        setCustomColumns(o.custom_columns && o.custom_columns.length ? o.custom_columns : [{ name: '', unit: '' }])
        setHeaderFields(o.custom_header_fields && o.custom_header_fields.length ? o.custom_header_fields : [''])
      })
      .catch(() => showToast('ไม่พบใบงานนี้'))
      .finally(() => setLoading(false))
  }, [refNo])

  const handleSave = async () => {
    try {
      await workorderAPI.updateCustomColumns(
        refNo,
        customColumns.filter((c) => c.name.trim()),
        headerFields.filter((f) => f.trim()),
      )
      showToast('บันทึกสำเร็จ ✓')
    } catch {
      showToast('บันทึกไม่สำเร็จ')
    }
  }

  const handleExportPDF = async () => {
    const rootEl = document.getElementById('print-root')
    if (!rootEl) return
    setGenerating(true)
    try {
      // clone แล้วแปลง src ของรูปภาพให้เป็น absolute URL ก่อน serialize
      // เพราะ HTML จะถูกส่งไป render ที่ puppeteer ฝั่ง backend ซึ่งไม่มี base URL ของหน้านี้
      const clone = rootEl.cloneNode(true)
      clone.removeAttribute('id')
      clone.querySelectorAll('img').forEach((img) => {
        img.src = new URL(img.getAttribute('src'), window.location.href).href
      })
      clone.style.padding = '24px'
      clone.style.background = '#fff'
      clone.style.maxWidth = '800px'
      clone.style.margin = '0 auto'

      // PRINT_STYLE มีกฎ @media print ที่ซ่อนทุกอย่างยกเว้น #print-root ไว้สำหรับหน้าเว็บจริง
      // (ที่มี UI อื่นล้อมรอบต้องซ่อนตอนสั่งพิมพ์) — เอกสารที่ส่งไปสร้าง PDF มีแค่ฟอร์มอย่างเดียว
      // ไม่ต้องใช้กฎนี้ จึงตัดออกแล้วใช้แค่ @page เพื่อกำหนดขนาดกระดาษ A4
      const pdfStyle = PRINT_STYLE.replace(/@media print[\s\S]*$/, '@page { size: A4; margin: 15mm; }')
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${pdfStyle}</style></head><body>${clone.outerHTML}</body></html>`
      const filename = `print-form-${testType}-${refNo}`
      const response = await reportAPI.generateFromHtml(fullHtml, filename)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('สร้าง PDF สำเร็จ ✓')
    } catch {
      showToast('เกิดข้อผิดพลาดในการสร้าง PDF')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-96"><i className="ti ti-loader-2 animate-spin text-orange-400 text-2xl" /></div>
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-96 gap-3">
        <i className="ti ti-file-off text-4xl text-gray-200" />
        <p className="text-gray-400 text-sm">ไม่พบใบงานนี้</p>
      </div>
    )
  }

  return (
    <div>
      <style>{PRINT_STYLE}</style>
      <div className="no-print bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/workorders/${refNo}`)} className="text-gray-400 hover:text-gray-700 p-1 -ml-1">
            <i className="ti ti-arrow-left text-lg" />
          </button>
          <div>
            <h1 className="text-base font-medium text-gray-800">แบบฟอร์มสำหรับบันทึกผล</h1>
            <p className="text-xs text-gray-400">{order.ref_no} — {order.project_name || '—'} — สำหรับพิมพ์ให้ช่างบันทึกผลด้วยลายมือ</p>
          </div>
        </div>
        <button onClick={handleExportPDF} disabled={generating}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 transition-colors">
          <i className={`ti ${generating ? 'ti-loader-2 animate-spin' : 'ti-file-export'} text-sm`} />
          {generating ? 'กำลังสร้าง PDF...' : 'นำออกเอกสาร'}
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div className="no-print flex gap-2">
          {[{ v: 'concrete', label: 'คอนกรีต' }, { v: 'steel', label: 'เหล็กเส้น' }, { v: 'other', label: 'อื่นๆ' }].map(({ v, label }) => (
            <button key={v} onClick={() => setTestType(v)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                testType === v ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div id="print-root" className="bg-white border border-gray-200 rounded-xl p-8 max-w-3xl mx-auto">
          {testType === 'concrete' && <CompressionForm order={order} />}
          {testType === 'steel' && <TensionForm order={order} />}
          {testType === 'other' && (
            <OtherForm order={order} columns={customColumns} setColumns={setCustomColumns}
              headerFields={headerFields} setHeaderFields={setHeaderFields}
              title={customTitle} setTitle={setCustomTitle} onSave={handleSave} />
          )}
        </div>
      </div>
    </div>
  )
}
