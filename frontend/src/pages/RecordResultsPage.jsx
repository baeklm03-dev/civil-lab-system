import { useState } from 'react'
import WorkOrderSelector from '../components/WorkOrderSelector'
import { resultsAPI } from '../services/api'
import { useToast } from '../hooks/useToast'

const TABS = [
  { v: 'concrete', label: 'คอนกรีต' },
  { v: 'steel', label: 'เหล็กเส้น' },
  { v: 'other', label: 'อื่นๆ' },
]

function detectTestType(order) {
  if (!order) return 'concrete'
  if (order.test_type) return order.test_type
  const t = (order.sample_type || '').toLowerCase()
  if (['steel', 'rebar', 'db', 'rb', 'bar'].some((k) => t.includes(k))) return 'steel'
  return 'concrete'
}

const inputCls = 'w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-orange-400 bg-white'
const readonlyCls = 'w-full px-2 py-1.5 text-xs border border-orange-200 rounded bg-orange-50 text-orange-700 font-medium'

function mkConcreteRow(specNo) {
  return { specNo: String(specNo), col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col7: '' }
}
function mkSteelRow(specNo) {
  return { specNo: String(specNo), col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col7: '', col8: '', col9: '', col10: '' }
}
function mkOtherRow(specNo) {
  return { specNo: String(specNo) }
}

// ── Concrete Table ─────────────────────────────────────────
function ConcreteTable({ rows, setRows }) {
  const update = (idx, key, val) => {
    setRows((rs) => {
      const next = rs.map((r, i) => i === idx ? { ...r, [key]: val } : r)
      const row = next[idx]
      const wt = parseFloat(key === 'col3' ? val : row.col3)
      const vol = parseFloat(key === 'col2' ? val : row.col2)
      if (!isNaN(wt) && !isNaN(vol) && vol > 0) row.col4 = (wt * 1000 / vol).toFixed(2)
      const load = parseFloat(key === 'col5' ? val : row.col5)
      const area = parseFloat(key === 'col1' ? val : row.col1)
      if (!isNaN(load) && !isNaN(area) && area > 0) {
        const mpa = (load * 10 / area).toFixed(2)
        row.col6 = mpa
        row.col7 = (parseFloat(mpa) * 10.197).toFixed(0)
      }
      return next
    })
  }
  const heads = ['SPEC.NO', 'AREA (cm²)', 'VOLUME (cm³)', 'WEIGHT (kg)', 'DENSITY (gm/cm³)', 'TOTAL LOAD (kN)', 'ULT. STRESS (MPa)', 'REMARKS (ksc)', '']
  const cols = ['col1', 'col2', 'col3', 'col4', 'col5', 'col6', 'col7']
  const readonly = { col4: true, col6: true, col7: true }
  return (
    <table className="w-full text-xs border-collapse">
      <thead><tr className="bg-gray-100">{heads.map((h) => <th key={h} className="border border-gray-200 px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td className="border border-gray-200 p-1"><input value={row.specNo} onChange={(e) => update(i, 'specNo', e.target.value)} className={inputCls} /></td>
            {cols.map((c) => (
              <td key={c} className="border border-gray-200 p-1">
                <input type="number" readOnly={readonly[c]} value={row[c]} onChange={(e) => update(i, c, e.target.value)}
                  className={readonly[c] ? readonlyCls : inputCls} />
              </td>
            ))}
            <td className="border border-gray-200 p-1 text-center">
              {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><i className="ti ti-trash text-xs" /></button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Steel Table ────────────────────────────────────────────
function SteelTable({ rows, setRows }) {
  const update = (idx, key, val) => {
    setRows((rs) => {
      const next = rs.map((r, i) => i === idx ? { ...r, [key]: val } : r)
      const row = next[idx]
      const area = parseFloat(key === 'col4' ? val : row.col4)
      if (!isNaN(area) && area > 0) {
        const yk = parseFloat(key === 'col5' ? val : row.col5)
        if (!isNaN(yk)) row.col7 = (yk * 10 / area).toFixed(1)
        const uk = parseFloat(key === 'col6' ? val : row.col6)
        if (!isNaN(uk)) row.col8 = (uk * 10 / area).toFixed(1)
      }
      return next
    })
  }
  const heads = ['SPEC.NO', 'NOM.SIZE (mm)', 'WEIGHT (kg/m)', 'TESTED DIA (mm)', 'NOM.AREA (cm²)', 'LOAD YIELD (kN)', 'LOAD ULT. (kN)', 'STRESS YIELD (MPa)', 'STRESS ULT. (MPa)', 'ELONG. (%)', 'GAUGE LEN. (cm)', '']
  const cols = ['col1', 'col2', 'col3', 'col4', 'col5', 'col6', 'col7', 'col8', 'col9', 'col10']
  const readonly = { col7: true, col8: true }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[1000px]">
        <thead><tr className="bg-gray-100">{heads.map((h) => <th key={h} className="border border-gray-200 px-1.5 py-1.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="border border-gray-200 p-1"><input value={row.specNo} onChange={(e) => update(i, 'specNo', e.target.value)} className={inputCls} /></td>
              {cols.map((c) => (
                <td key={c} className="border border-gray-200 p-1">
                  <input type={c === 'col1' ? 'text' : 'number'} readOnly={readonly[c]} value={row[c]} onChange={(e) => update(i, c, e.target.value)}
                    className={readonly[c] ? readonlyCls : inputCls} />
                </td>
              ))}
              <td className="border border-gray-200 p-1 text-center">
                {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><i className="ti ti-trash text-xs" /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Other Table ────────────────────────────────────────────
function OtherTable({ rows, setRows, customColumns }) {
  if (!customColumns || customColumns.length === 0) {
    return <p className="text-xs text-gray-400 italic">ใบงานนี้ยังไม่ได้กำหนดคอลัมน์ผลทดสอบ (custom columns)</p>
  }
  const update = (idx, key, val) => setRows((rs) => rs.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-200 px-2 py-1.5 font-medium text-gray-600">SPEC.NO</th>
          {customColumns.map((c, i) => <th key={i} className="border border-gray-200 px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">{c.name}{c.unit ? ` (${c.unit})` : ''}</th>)}
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td className="border border-gray-200 p-1"><input value={row.specNo} onChange={(e) => update(i, 'specNo', e.target.value)} className={inputCls} /></td>
            {customColumns.map((_, ci) => (
              <td key={ci} className="border border-gray-200 p-1">
                <input value={row[`col${ci + 1}`] || ''} onChange={(e) => update(i, `col${ci + 1}`, e.target.value)} className={inputCls} />
              </td>
            ))}
            <td className="border border-gray-200 p-1 text-center">
              {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><i className="ti ti-trash text-xs" /></button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function RecordResultsPage() {
  const [order, setOrder] = useState(null)
  const [activeTab, setActiveTab] = useState('concrete')
  const [compRows, setCompRows] = useState([mkConcreteRow(1)])
  const [steelRows, setSteelRows] = useState([mkSteelRow(1)])
  const [otherRows, setOtherRows] = useState([mkOtherRow(1)])
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  const handleSelectOrder = (o) => {
    setOrder(o)
    setActiveTab(detectTestType(o))
  }

  const mkRow = activeTab === 'concrete' ? mkConcreteRow : activeTab === 'steel' ? mkSteelRow : mkOtherRow
  const rows = activeTab === 'concrete' ? compRows : activeTab === 'steel' ? steelRows : otherRows
  const setRows = activeTab === 'concrete' ? setCompRows : activeTab === 'steel' ? setSteelRows : setOtherRows

  const handleAddRow = () => setRows((rs) => [...rs, mkRow(rs.length + 1)])

  const handleSave = async () => {
    if (!order) { showToast('กรุณาเลือกใบงานก่อน'); return }
    const specimens = rows.filter((r) => r.specNo).map((r) => {
      const { specNo, ...cols } = r
      return { specNo, ...cols }
    })
    if (!specimens.length) { showToast('ไม่มีข้อมูลที่จะบันทึก'); return }

    setSaving(true)
    try {
      await resultsAPI.create({ workOrderId: order.ref_no, testType: activeTab, specimens })
      showToast('บันทึกผลทดสอบสำเร็จ ✓')
    } catch {
      showToast('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <h1 className="text-base font-medium text-gray-800">บันทึกผลการทดสอบ</h1>
      </div>

      <div className="p-6 space-y-5">
        <WorkOrderSelector value={order} onSelect={handleSelectOrder} />

        {order && (
          <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5 text-sm text-orange-700">
            <span className="font-medium">{order.ref_no}</span> — {order.project_name || '—'}
          </div>
        )}

        <div className="flex gap-2">
          {TABS.map(({ v, label }) => (
            <button key={v} onClick={() => setActiveTab(v)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activeTab === v ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600">ตารางผลการทดสอบ</p>
            <button onClick={handleAddRow} className="text-xs text-orange-400 hover:underline flex items-center gap-1">
              <i className="ti ti-plus text-xs" /> เพิ่มแถว
            </button>
          </div>

          {activeTab === 'concrete' && <ConcreteTable rows={compRows} setRows={setCompRows} />}
          {activeTab === 'steel' && <SteelTable rows={steelRows} setRows={setSteelRows} />}
          {activeTab === 'other' && <OtherTable rows={otherRows} setRows={setOtherRows} customColumns={order?.custom_columns} />}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 transition-colors">
          <i className={`ti ${saving ? 'ti-loader-2 animate-spin' : 'ti-device-floppy'}`} />
          {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
      </div>
    </div>
  )
}
