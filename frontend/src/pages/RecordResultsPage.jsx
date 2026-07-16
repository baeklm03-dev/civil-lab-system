import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workorderAPI, resultsAPI, personnelAPI, reportAPI } from '../services/api'
import { useToast } from '../hooks/useToast'
import { nominalAreaFromSize, stressMPa, mpaToKsc, compressionAreaVolume, densityGcm3, fmt } from '../utils/testCalc'

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

function mkConcreteRow(specNo, overrides = {}) {
  return { specNo: String(specNo), casting_date: '', dim1: '', dim2: '', dim3: '', weight_kg: '', ultimate_load_kn: '', remark: '', ...overrides }
}
function mkTensionRow(specNo, overrides = {}) {
  return { specNo: String(specNo), nominal_size: '', length_cm: '', weight_g: '', yield_kn: '', ultimate_kn: '', elongation_cm: '', gauge_length_cm: '', remark: '', ...overrides }
}
function mkOtherRow(specNo) {
  return { specNo: String(specNo) }
}

// แปลงแถวคำนวณ (พื้นที่/ปริมาตร/ความหนาแน่น/stress) สำหรับแสดงผล — ไม่ persist ค่าที่ derive ซ้ำ คำนวณสดทุกครั้ง
function withConcreteCalc(row, sampleType) {
  const { area, volume } = compressionAreaVolume(sampleType, row.dim1, row.dim2, row.dim3)
  const density = densityGcm3(row.weight_kg, volume)
  const mpa = stressMPa(row.ultimate_load_kn, area)
  return { area, volume, density, mpa, ksc: mpaToKsc(mpa) }
}
function withTensionCalc(row) {
  const area = nominalAreaFromSize(row.nominal_size)
  const yieldMpa = area ? stressMPa(row.yield_kn, area) : null
  const ultimateMpa = area ? stressMPa(row.ultimate_kn, area) : null
  const elongPct = row.elongation_cm && row.gauge_length_cm
    ? (parseFloat(row.elongation_cm) / parseFloat(row.gauge_length_cm)) * 100
    : null
  return { area, yieldMpa, ultimateMpa, elongPct }
}

// ── Concrete Table (Compression Test) ───────────────────────
function ConcreteTable({ rows, setRows, sampleType }) {
  const update = (idx, key, val) => setRows((rs) => rs.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[1100px]">
        <thead><tr className="bg-gray-100">
          {['SPEC.NO', 'CASTING DATE', 'DIM 1', 'DIM 2', 'DIM 3', 'WEIGHT (KG)', 'ULT. LOAD (KN)', 'AREA (cm²)', 'DENSITY (g/cm³)', 'STRESS (MPa)', 'ksc', 'REMARK', ''].map((h) => (
            <th key={h} className="border border-gray-200 px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const calc = withConcreteCalc(row, sampleType)
            return (
              <tr key={i}>
                <td className="border border-gray-200 p-1"><input value={row.specNo} onChange={(e) => update(i, 'specNo', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="date" value={row.casting_date} onChange={(e) => update(i, 'casting_date', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.dim1} onChange={(e) => update(i, 'dim1', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.dim2} onChange={(e) => update(i, 'dim2', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.dim3} onChange={(e) => update(i, 'dim3', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.weight_kg} onChange={(e) => update(i, 'weight_kg', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.ultimate_load_kn} onChange={(e) => update(i, 'ultimate_load_kn', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.area)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.density)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.mpa)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.ksc, 0)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input value={row.remark} onChange={(e) => update(i, 'remark', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1 text-center">
                  {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><i className="ti ti-trash text-xs" /></button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-1">* พื้นที่/ความหนาแน่น/stress คำนวณอัตโนมัติจาก DIM 1-3 ตามรูปทรงตัวอย่าง (ทรงกลม: DIM1=เส้นผ่านศก., DIM2=สูง / สี่เหลี่ยม: DIM1×DIM2=หน้าตัด, DIM3=สูง)</p>
    </div>
  )
}

// ── Tension Table (steel) ───────────────────────────────────
function TensionTable({ rows, setRows }) {
  const update = (idx, key, val) => setRows((rs) => rs.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[1300px]">
        <thead><tr className="bg-gray-100">
          {['SPEC.NO', 'NOMINAL SIZE', 'LENGTH (cm)', 'WEIGHT (g)', 'YIELD (kN)', 'ULTIMATE (kN)', 'ELONG. (cm)', 'G.L (cm)', 'AREA (cm²)', 'YIELD (MPa)', 'ULT. (MPa)', 'ELONG. (%)', 'REMARK', ''].map((h) => (
            <th key={h} className="border border-gray-200 px-1.5 py-1.5 font-medium text-gray-600 whitespace-nowrap">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const calc = withTensionCalc(row)
            return (
              <tr key={i}>
                <td className="border border-gray-200 p-1"><input value={row.specNo} onChange={(e) => update(i, 'specNo', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input value={row.nominal_size} onChange={(e) => update(i, 'nominal_size', e.target.value)} placeholder="e.g. DB12" className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.length_cm} onChange={(e) => update(i, 'length_cm', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.weight_g} onChange={(e) => update(i, 'weight_g', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.yield_kn} onChange={(e) => update(i, 'yield_kn', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.ultimate_kn} onChange={(e) => update(i, 'ultimate_kn', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.elongation_cm} onChange={(e) => update(i, 'elongation_cm', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input type="number" value={row.gauge_length_cm} onChange={(e) => update(i, 'gauge_length_cm', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.area, 3)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.yieldMpa, 1)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.ultimateMpa, 1)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input readOnly value={fmt(calc.elongPct, 1)} className={readonlyCls} /></td>
                <td className="border border-gray-200 p-1"><input value={row.remark} onChange={(e) => update(i, 'remark', e.target.value)} className={inputCls} /></td>
                <td className="border border-gray-200 p-1 text-center">
                  {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><i className="ti ti-trash text-xs" /></button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-1">* พื้นที่หน้าตัดคำนวณจากขนาดระบุ (NOMINAL SIZE เช่น DB12, RB9) ส่วน stress และ %ELONGATION คำนวณอัตโนมัติ</p>
    </div>
  )
}

// ── Other Table ────────────────────────────────────────────
function OtherTable({ rows, setRows, customColumns }) {
  if (!customColumns || customColumns.length === 0) {
    return <p className="text-xs text-gray-400 italic">ใบงานนี้ยังไม่ได้กำหนดคอลัมน์ผลทดสอบ (custom columns) — ไปกำหนดที่ตอนสร้างใบงาน หรือหน้า "อื่นๆ" ก่อน</p>
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

// ── Paste Panel ──────────────────────────────────────────────
function PastePanel({ mode, onPaste, onClose }) {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState([])

  const COMP_COLS  = ['specNo', 'casting_date', 'dim1', 'dim2', 'dim3', 'weight_kg', 'ultimate_load_kn', 'remark']
  const TENS_COLS  = ['specNo', 'nominal_size', 'length_cm', 'weight_g', 'yield_kn', 'ultimate_kn', 'elongation_cm', 'gauge_length_cm', 'remark']
  const COMP_HEADS = ['No.', 'Casting Date', 'Dim1', 'Dim2', 'Dim3', 'Weight (kg)', 'Ult. Load (kN)', 'Remark']
  const TENS_HEADS = ['No.', 'Nominal Size', 'Length (cm)', 'Weight (g)', 'Yield (kN)', 'Ultimate (kN)', 'Elong (cm)', 'GL (cm)', 'Remark']
  const cols  = mode === 'concrete' ? COMP_COLS  : TENS_COLS
  const heads = mode === 'concrete' ? COMP_HEADS : TENS_HEADS

  const parse = (text) => {
    const rows = text.trim().split(/\r?\n/)
      .map((r) => r.split('\t').map((c) => c.trim()))
      .filter((r) => r.some((c) => c !== ''))
    const start = (rows.length > 0 && isNaN(Number(rows[0][0])) && rows[0][0] !== '') ? 1 : 0
    return rows.slice(start)
  }

  const handleChange = (text) => { setRaw(text); setPreview(parse(text).slice(0, 6)) }

  const handleApply = () => {
    const rows = parse(raw)
    if (!rows.length) return
    const mapped = rows.map((cells) => {
      const obj = {}
      cols.forEach((key, ci) => { obj[key] = cells[ci] ?? '' })
      return obj
    })
    onPaste(mapped)
    onClose()
  }

  return (
    <div className="border border-orange-200 rounded-xl bg-orange-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-orange-700">วางข้อมูลจาก Excel</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x text-sm" /></button>
      </div>
      <p className="text-xs text-gray-400">
        คัดลอกคอลัมน์จาก Excel ตามลำดับ:&nbsp;
        <span className="text-orange-600 font-medium">{heads.join(' → ')}</span>
      </p>
      <textarea
        autoFocus
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        onPaste={(e) => { e.preventDefault(); handleChange(e.clipboardData.getData('text')) }}
        rows={5}
        placeholder="วางข้อมูลจาก Excel ที่นี่ (Ctrl+V)..."
        className="w-full px-3 py-2 text-xs border border-orange-200 rounded-lg bg-white focus:outline-none focus:border-orange-400 font-mono resize-none"
      />
      {preview.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead><tr className="bg-orange-100">{heads.map((h) => <th key={h} className="border border-orange-200 px-2 py-1 text-orange-700 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="bg-white">{cols.map((_, ci) => <td key={ci} className="border border-orange-100 px-2 py-1 text-gray-600">{row[ci] ?? ''}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">ยกเลิก</button>
        <button onClick={handleApply} disabled={!raw.trim()}
          className="text-xs px-3 py-1.5 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-1">
          <i className="ti ti-table-import" /> นำเข้า
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function RecordResultsPage() {
  const { refNo } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('concrete')
  const [compRows, setCompRows] = useState([mkConcreteRow(1)])
  const [tensionRows, setTensionRows] = useState([mkTensionRow(1)])
  const [otherRows, setOtherRows] = useState([mkOtherRow(1)])
  const [showPaste, setShowPaste] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [testers, setTesters] = useState([])
  const [selectedTesterId, setSelectedTesterId] = useState('')
  const [remarks, setRemarks] = useState('')

  useEffect(() => {
    personnelAPI.getAll({ role: 'tester', active: 'true' }).then(({ data }) => setTesters(data.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      workorderAPI.getOne(refNo),
      resultsAPI.getAll({ workOrderId: refNo }),
    ]).then(([orderRes, resultsRes]) => {
      const o = orderRes.data.data
      setOrder(o)
      const type = detectTestType(o)
      setActiveTab(type)

      const saved = resultsRes.data.data || []
      if (type === 'concrete') {
        const rows = saved.filter((r) => r.testType === 'concrete').map((r) => ({
          specNo: r.specNo, casting_date: r.col1 || '', dim1: r.col2 || '', dim2: r.col3 || '',
          dim3: r.col4 || '', weight_kg: r.col5 || '', ultimate_load_kn: r.col6 || '', remark: r.col7 || '',
        }))
        if (rows.length) setCompRows(rows)
      } else if (type === 'steel') {
        const rows = saved.filter((r) => r.testType === 'steel').map((r) => ({
          specNo: r.specNo, nominal_size: r.col1 || '', length_cm: r.col2 || '', weight_g: r.col3 || '',
          yield_kn: r.col4 || '', ultimate_kn: r.col5 || '', elongation_cm: r.col6 || '', gauge_length_cm: r.col7 || '', remark: r.col8 || '',
        }))
        if (rows.length) setTensionRows(rows)
      } else {
        const rows = saved.filter((r) => r.testType === 'other')
        if (rows.length) setOtherRows(rows)
      }
    }).catch(() => showToast('ไม่พบใบงานนี้'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refNo])

  const mkRow = activeTab === 'concrete' ? mkConcreteRow : activeTab === 'steel' ? mkTensionRow : mkOtherRow
  const rows = activeTab === 'concrete' ? compRows : activeTab === 'steel' ? tensionRows : otherRows
  const setRows = activeTab === 'concrete' ? setCompRows : activeTab === 'steel' ? setTensionRows : setOtherRows

  const handleAddRow = () => setRows((rs) => [...rs, mkRow(rs.length + 1)])
  const handlePaste = (mapped) => setRows(mapped.map((m, i) => mkRow(i + 1, m)))

  const buildSpecimensForSave = () => {
    if (activeTab === 'concrete') {
      return compRows.filter((r) => r.specNo).map((r) => {
        const calc = withConcreteCalc(r, order.sample_type)
        return {
          specNo: r.specNo, col1: r.casting_date, col2: r.dim1, col3: r.dim2, col4: r.dim3,
          col5: r.weight_kg, col6: r.ultimate_load_kn, col7: r.remark,
          col8: fmt(calc.area), col9: fmt(calc.volume), col10: fmt(calc.density), col11: fmt(calc.mpa),
        }
      })
    }
    if (activeTab === 'steel') {
      return tensionRows.filter((r) => r.specNo).map((r) => {
        const calc = withTensionCalc(r)
        return {
          specNo: r.specNo, col1: r.nominal_size, col2: r.length_cm, col3: r.weight_g,
          col4: r.yield_kn, col5: r.ultimate_kn, col6: r.elongation_cm, col7: r.gauge_length_cm, col8: r.remark,
          col9: fmt(calc.area, 3), col10: fmt(calc.yieldMpa, 1), col11: fmt(calc.ultimateMpa, 1),
        }
      })
    }
    return otherRows.filter((r) => r.specNo).map((r) => { const { specNo, ...cols } = r; return { specNo, ...cols } })
  }

  const handleSave = async () => {
    if (!order) return
    const specimens = buildSpecimensForSave()
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

  const handleGeneratePDF = async () => {
    if (!order) return
    const tester = testers.find((t) => t.id === selectedTesterId)
    const payload = {
      type: activeTab === 'steel' ? 'tension' : 'compression',
      order: {
        ref_no: order.ref_no, project_name: order.project_name, contractor: order.contractor,
        sample_type: order.sample_type, received_date: order.received_date, casting_date: order.casting_date || '',
      },
      remarks,
      tester_name: tester?.fullname_en || '',
      tester_name_th: tester?.fullname_th || '',
    }

    if (activeTab === 'concrete') {
      payload.specimens = compRows.filter((r) => r.specNo || r.ultimate_load_kn).map((r) => {
        const calc = withConcreteCalc(r, order.sample_type)
        return {
          spec_no: r.specNo, area_cm2: fmt(calc.area), volume_cm3: fmt(calc.volume), weight_kg: r.weight_kg,
          density: fmt(calc.density), load_kn: r.ultimate_load_kn, ultimate_stress: fmt(calc.mpa), ksc: fmt(calc.ksc, 0),
        }
      })
    } else if (activeTab === 'steel') {
      const groups = {}
      const order_keys = []
      tensionRows.forEach((row) => {
        const calc = withTensionCalc(row)
        const key = row.nominal_size || 'Other'
        if (!groups[key]) { groups[key] = { barSize: key, specimens: [] }; order_keys.push(key) }
        groups[key].specimens.push({
          spec_no: row.specNo, nominal_size: row.nominal_size, weight_kg_m: fmt(calc.area ? calc.area * 0.785 : null, 3),
          tested_dia: row.nominal_size?.match(/(\d+(\.\d+)?)/)?.[1] || '', nominal_area: fmt(calc.area, 3),
          yield_kn: row.yield_kn, ultimate_kn: row.ultimate_kn, yield_mpa: fmt(calc.yieldMpa, 1), ultimate_mpa: fmt(calc.ultimateMpa, 1),
          elongation_pct: fmt(calc.elongPct, 1), gauge_length: row.gauge_length_cm,
        })
      })
      payload.specimenGroups = order_keys.map((k) => groups[k])
    } else {
      showToast('ประเภท "อื่นๆ" ยังไม่รองรับการสร้าง PDF')
      return
    }

    setGenerating(true)
    try {
      const response = await reportAPI.generate(payload)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${payload.type}-${order.ref_no}.pdf`
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
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(`/workorders/${refNo}`)} className="text-gray-400 hover:text-gray-700 p-1 -ml-1">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <div>
          <h1 className="text-base font-medium text-gray-800">บันทึกผลการทดสอบ</h1>
          <p className="text-xs text-gray-400">{order.ref_no} — {order.project_name || '—'}</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex gap-2">
          {TABS.map(({ v, label }) => (
            <button key={v} onClick={() => { setActiveTab(v); setShowPaste(false) }}
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
            <div className="flex items-center gap-2">
              {activeTab !== 'other' && (
                <button onClick={() => setShowPaste((v) => !v)}
                  className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${showPaste ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500'}`}>
                  <i className="ti ti-clipboard-text text-xs" /> วางข้อมูล
                </button>
              )}
              <button onClick={handleAddRow} className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                <i className="ti ti-plus text-xs" /> เพิ่มแถว
              </button>
            </div>
          </div>

          {showPaste && activeTab !== 'other' && <PastePanel mode={activeTab} onPaste={handlePaste} onClose={() => setShowPaste(false)} />}

          {activeTab === 'concrete' && <ConcreteTable rows={compRows} setRows={setCompRows} sampleType={order.sample_type} />}
          {activeTab === 'steel' && <TensionTable rows={tensionRows} setRows={setTensionRows} />}
          {activeTab === 'other' && <OtherTable rows={otherRows} setRows={setOtherRows} customColumns={order.custom_columns} />}
        </div>

        {activeTab !== 'other' && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Tested by (ผู้ทดสอบ)</label>
                <select value={selectedTesterId} onChange={(e) => setSelectedTesterId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50">
                  <option value="">— เลือกผู้ทดสอบ —</option>
                  {testers.map((t) => <option key={t.id} value={t.id}>{t.fullname_th}{t.fullname_en ? ` (${t.fullname_en})` : ''}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">หมายเหตุ (สำหรับ PDF)</label>
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 border border-orange-300 text-orange-500 rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors">
            <i className={`ti ${saving ? 'ti-loader-2 animate-spin' : 'ti-device-floppy'}`} />
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
          {activeTab !== 'other' && (
            <button onClick={handleGeneratePDF} disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 transition-colors">
              <i className={`ti ${generating ? 'ti-loader-2 animate-spin' : 'ti-file-type-pdf'}`} />
              {generating ? 'กำลังสร้าง PDF...' : 'สร้าง PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
