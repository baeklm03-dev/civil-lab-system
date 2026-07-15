import { useState } from 'react'
import WorkOrderSelector from '../components/WorkOrderSelector'
import { workorderAPI } from '../services/api'
import { useToast } from '../hooks/useToast'
import monoLogo from '../mono-logo.png'

function detectTestType(order) {
  if (!order) return 'concrete'
  if (order.test_type) return order.test_type
  const t = (order.sample_type || '').toLowerCase()
  if (['steel', 'rebar', 'db', 'rb', 'bar'].some((k) => t.includes(k))) return 'steel'
  return 'concrete'
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
  table.print-results { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 14px; }
  table.print-results th, table.print-results td { border: 1px solid #000; padding: 4px 5px; text-align: center; height: 24px; }
  table.print-results th { font-weight: bold; background: #e8e8e8; }
  .print-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 36px; }
  .print-sig-block { text-align: center; font-size: 10.5pt; }
  .print-sig-line { border-bottom: 1px solid #000; height: 32px; margin-bottom: 4px; }
  .print-sig-center { text-align: center; margin-top: 24px; font-size: 10.5pt; }
  .print-sig-center-inner { display: inline-block; min-width: 220px; text-align: center; }
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
          <div className="print-dept">Department of Civil Engineering, Faculty of Engineering</div>
          <div className="print-dept">King Mongkut's University of Technology North Bangkok</div>
          <div className="print-dept">1518 Pracharat 1 Road, Bangsue, Bangkok 10800, Thailand</div>
          <div className="print-dept">Tel.: 0-2555-2000 Ext. 8628,8625 &nbsp;&nbsp;&nbsp; Fax.: 0-2587-4337</div>
        </div>
        <div style={{ width: 0, flexShrink: 0 }} />
      </div>
      <div className="print-title">{title}</div>
    </>
  )
}

function SignatureBlock() {
  return (
    <>
      <div className="print-signatures">
        <div className="print-sig-block"><div className="print-sig-line" /><div>Tested by</div><div>(..................................)</div></div>
        <div className="print-sig-block"><div className="print-sig-line" /><div>Checked by</div><div>(Nuttawut Thanasisathit)</div></div>
      </div>
      <div className="print-sig-center">
        <div className="print-sig-center-inner"><div className="print-sig-line" /><div>Department Head</div><div>(Nuttawut Thanasisathit)</div></div>
      </div>
    </>
  )
}

function CompressionForm({ order }) {
  const rows = Array.from({ length: 10 })
  return (
    <div className="print-report">
      <ReportHeader title="COMPRESSION TEST" />
      <table className="print-info-table"><tbody>
        <tr><td className="label">SPECIMEN FROM</td><td>: {order.contractor || ''}</td></tr>
        <tr><td className="label">PROJECT NAME</td><td>: {order.project_name || ''}</td></tr>
        <tr><td className="label">TYPE OF SPECIMEN</td><td>: {order.sample_type || ''}</td></tr>
        <tr><td className="label">DATE OF CASTING</td><td>: {order.casting_date || ''}</td></tr>
        <tr><td className="label">DATE OF TESTING</td><td>: {order.received_date || ''}</td></tr>
      </tbody></table>
      <table className="print-results">
        <thead><tr>
          <th>SPEC.<br />NO</th><th>CROSS SECTIONAL<br />AREA (cm²)</th><th>VOLUME<br />(cm³)</th>
          <th>WEIGHT<br />(kg)</th><th>DENSITY<br />(gm/cm³)</th><th>TOTAL LOAD<br />(kN)</th>
          <th>ULTIMATE STRESS<br />(MPa)</th><th>REMARKS<br />(ksc)</th>
        </tr></thead>
        <tbody>{rows.map((_, i) => <tr key={i}>{Array.from({ length: 8 }).map((__, c) => <td key={c}>&nbsp;</td>)}</tr>)}</tbody>
      </table>
      <SignatureBlock />
    </div>
  )
}

function TensionForm({ order }) {
  const rows = Array.from({ length: 10 })
  return (
    <div className="print-report">
      <ReportHeader title="TENSION TEST" />
      <table className="print-info-table"><tbody>
        <tr><td className="label">SPECIMEN FROM</td><td>: {order.contractor || ''}</td></tr>
        <tr><td className="label">PROJECT NAME</td><td>: {order.project_name || ''}</td></tr>
        <tr><td className="label">TYPE OF SPECIMEN</td><td>: {order.sample_type || ''}</td></tr>
        <tr><td className="label">DATE OF TESTING</td><td>: {order.received_date || ''}</td></tr>
      </tbody></table>
      <table className="print-results">
        <thead><tr>
          <th>SPEC.<br />NO</th><th>NOMINAL<br />SIZE (mm)</th><th>WEIGHT<br />(kg/m)</th>
          <th>TESTED<br />DIA. (mm)</th><th>NOMINAL<br />AREA (cm²)</th><th>LOAD<br />YIELD (kN)</th>
          <th>LOAD<br />ULT. (kN)</th><th>STRESS<br />YIELD (MPa)</th><th>STRESS<br />ULT. (MPa)</th>
          <th>ELONG.<br />(%)</th><th>GAUGE<br />LEN. (cm)</th>
        </tr></thead>
        <tbody>{rows.map((_, i) => <tr key={i}>{Array.from({ length: 11 }).map((__, c) => <td key={c}>&nbsp;</td>)}</tr>)}</tbody>
      </table>
      <SignatureBlock />
    </div>
  )
}

function OtherForm({ order, columns, setColumns, title, setTitle, onSaveColumns }) {
  const rows = Array.from({ length: 10 })
  const updateColumn = (idx, key, val) => setColumns((cols) => cols.map((c, i) => i === idx ? { ...c, [key]: val } : c))

  return (
    <div>
      <div className="no-print bg-white border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-gray-700">ชื่อหัวข้อทดสอบ</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">คอลัมน์ (ชื่อ + หน่วย)</p>
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
            <button onClick={onSaveColumns} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
              <i className="ti ti-device-floppy text-xs" /> บันทึกคอลัมน์ลงใบงาน
            </button>
          </div>
        </div>
      </div>

      <div className="print-report">
        <ReportHeader title={title || 'TEST'} />
        <table className="print-info-table"><tbody>
          <tr><td className="label">SPECIMEN FROM</td><td>: {order.contractor || ''}</td></tr>
          <tr><td className="label">PROJECT NAME</td><td>: {order.project_name || ''}</td></tr>
          <tr><td className="label">DATE OF TESTING</td><td>: {order.received_date || ''}</td></tr>
        </tbody></table>
        <table className="print-results">
          <thead><tr>
            <th>SPEC.<br />NO</th>
            {columns.map((c, i) => <th key={i}>{c.name || `Col ${i + 1}`}{c.unit ? <><br />({c.unit})</> : ''}</th>)}
          </tr></thead>
          <tbody>{rows.map((_, i) => <tr key={i}><td>&nbsp;</td>{columns.map((_, c) => <td key={c}>&nbsp;</td>)}</tr>)}</tbody>
        </table>
        <SignatureBlock />
      </div>
    </div>
  )
}

export default function PrintFormPage() {
  const [order, setOrder] = useState(null)
  const [testType, setTestType] = useState('concrete')
  const [customTitle, setCustomTitle] = useState('')
  const [customColumns, setCustomColumns] = useState([{ name: '', unit: '' }])
  const { showToast } = useToast()

  const handleSelectOrder = (o) => {
    setOrder(o)
    setTestType(detectTestType(o))
    setCustomTitle(o.custom_test_name || '')
    setCustomColumns(o.custom_columns && o.custom_columns.length ? o.custom_columns : [{ name: '', unit: '' }])
  }

  const handleSaveColumns = async () => {
    if (!order) return
    try {
      await workorderAPI.updateCustomColumns(order.ref_no, customColumns.filter((c) => c.name.trim()))
      showToast('บันทึกคอลัมน์สำเร็จ ✓')
    } catch {
      showToast('บันทึกไม่สำเร็จ')
    }
  }

  return (
    <div>
      <style>{PRINT_STYLE}</style>
      <div className="no-print bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-base font-medium text-gray-800">พิมพ์แบบฟอร์ม</h1>
        {order && (
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors">
            <i className="ti ti-printer text-sm" /> 🖨 พิมพ์
          </button>
        )}
      </div>

      <div className="p-6 space-y-5">
        <div className="no-print space-y-3">
          <WorkOrderSelector value={order} onSelect={handleSelectOrder} />
          {order && (
            <div className="flex gap-2">
              {[{ v: 'concrete', label: 'คอนกรีต' }, { v: 'steel', label: 'เหล็กเส้น' }, { v: 'other', label: 'อื่นๆ' }].map(({ v, label }) => (
                <button key={v} onClick={() => setTestType(v)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    testType === v ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!order ? (
          <p className="text-sm text-gray-400">เลือกใบงานเพื่อแสดงแบบฟอร์ม</p>
        ) : (
          <div id="print-root" className="bg-white border border-gray-200 rounded-xl p-8 max-w-3xl mx-auto">
            {testType === 'concrete' && <CompressionForm order={order} />}
            {testType === 'steel' && <TensionForm order={order} />}
            {testType === 'other' && (
              <OtherForm order={order} columns={customColumns} setColumns={setCustomColumns}
                title={customTitle} setTitle={setCustomTitle} onSaveColumns={handleSaveColumns} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
