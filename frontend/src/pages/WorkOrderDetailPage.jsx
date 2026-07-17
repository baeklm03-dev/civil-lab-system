import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workorderAPI, personnelAPI, reportAPI, resultsAPI } from '../services/api'
import { useToast } from '../hooks/useToast'
import Loader from '../components/ui/Loader'
import logo from '../logo.png'

const STATUSES = ['รับเรื่อง', 'รอข้อมูล', 'ดำเนินการ', 'เสร็จสิ้น']

const STATUS_COLOR = {
  รับเรื่อง:  'bg-blue-100 text-blue-700',
  รอข้อมูล:  'bg-yellow-100 text-yellow-700',
  ดำเนินการ: 'bg-red-100 text-red-700',
  เสร็จสิ้น:  'bg-green-100 text-green-700',
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-800">{value || '—'}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-medium text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

// ── Finance Summary Card ───────────────────────────────────
function FinanceSummaryCard({ refNo }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    workorderAPI.getFinanceSummary(refNo)
      .then(({ data }) => setText(data.summary || ''))
      .catch(() => setText(''))
      .finally(() => setLoading(false))
  }, [refNo])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('คัดลอกแล้ว ✓')
    } catch {
      showToast('คัดลอกไม่สำเร็จ')
    }
  }

  return (
    <Section title="📢 ข้อความแจ้งการเงิน (สำหรับส่งไลน์)">
      {loading ? (
        <p className="text-xs text-gray-400">กำลังโหลด...</p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-orange-400 bg-gray-50 resize-y"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors"
          >
            <i className="ti ti-clipboard text-sm" /> 📋 Copy
          </button>
        </>
      )}
    </Section>
  )
}

// ── Modal wrapper ──────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh] ${wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'}`}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-medium text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <i className="ti ti-x text-lg" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}


// ── ออกเอกสาร ─────────────────────────────────────────────
function DocumentModal({ order, onClose, onPrintReport }) {
  const navigate = useNavigate()

  return (
    <Modal title="ออกเอกสาร" onClose={onClose}>
      <div className="px-6 py-5 space-y-3">
        <button
          onClick={() => { onClose(); navigate(`/workorders/${order.ref_no}/print-form`) }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <i className="ti ti-printer text-xl text-gray-500" />
          <div>
            <p className="text-sm font-medium text-gray-800">แบบฟอร์มสำหรับบันทึกผล</p>
            <p className="text-xs text-gray-400 mt-0.5">แบบฟอร์มเปล่าสำหรับบันทึกผลด้วยลายมือ</p>
          </div>
          <i className="ti ti-chevron-right text-gray-300 ml-auto" />
        </button>

        <button
          onClick={() => { onClose(); navigate(`/workorders/${order.ref_no}/record-results`) }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        >
          <i className="ti ti-clipboard-check text-xl text-gray-500" />
          <div>
            <p className="text-sm font-medium text-gray-800">บันทึกผลการทดสอบ</p>
            <p className="text-xs text-gray-400 mt-0.5">กรอกผลทดสอบ เพิ่มแถวได้ บันทึกและสร้าง PDF ได้ทันที</p>
          </div>
          <i className="ti ti-chevron-right text-gray-300 ml-auto" />
        </button>

        <button
          onClick={() => { onClose(); onPrintReport() }}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-left"
        >
          <i className="ti ti-file-description text-xl text-orange-400" />
          <div>
            <p className="text-sm font-medium text-gray-800">ใบรายงานผลการทดสอบ</p>
            <p className="text-xs text-gray-400 mt-0.5">พิมพ์หรือ Export เป็น PDF</p>
          </div>
          <i className="ti ti-chevron-right text-gray-300 ml-auto" />
        </button>
      </div>
    </Modal>
  )
}

// ── helpers ────────────────────────────────────────────────
function detectReportType(sampleType) {
  if (!sampleType) return 'compression'
  const t = sampleType.toLowerCase()
  if (['steel', 'rebar', 'tension', 'db', 'rb', 'bar'].some((k) => t.includes(k))) return 'tension'
  return 'compression'
}

function mkCompRow(overrides = {}) {
  return { spec_no: '', area_cm2: '', volume_cm3: '', weight_kg: '', density: '', load_kn: '', ultimate_stress: '', ksc: '', ...overrides }
}

function mkTensionRow(overrides = {}) {
  return { spec_no: '', nominal_size: '', weight_kg_m: '', tested_dia: '', nominal_area: '', yield_kn: '', ultimate_kn: '', yield_mpa: '', ultimate_mpa: '', elongation_pct: '', gauge_length: '', ...overrides }
}

// ── Paste Panel ────────────────────────────────────────────
function PastePanel({ mode, onPaste, onClose }) {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState([])

  const COMP_COLS  = ['spec_no','area_cm2','volume_cm3','weight_kg','load_kn']
  const TENS_COLS  = ['spec_no','nominal_size','weight_kg_m','tested_dia','nominal_area','yield_kn','ultimate_kn','elongation_pct','gauge_length']
  const COMP_HEADS = ['No.', 'Area (cm²)', 'Vol (cm³)', 'Wt (kg)', 'Load (kN)']
  const TENS_HEADS = ['No.', 'Nom.Size', 'Wt/m', 'Tested Dia', 'Nom.Area', 'Yield kN', 'Ult. kN', 'Elong %', 'GL']
  const cols  = mode === 'compression' ? COMP_COLS  : TENS_COLS
  const heads = mode === 'compression' ? COMP_HEADS : TENS_HEADS

  const parse = (text) => {
    const rows = text.trim().split(/\r?\n/)
      .map((r) => r.split('\t').map((c) => c.trim()))
      .filter((r) => r.some((c) => c !== ''))
    // skip header row if first cell is non-numeric text
    const start = (rows.length > 0 && isNaN(Number(rows[0][0])) && rows[0][0] !== '') ? 1 : 0
    return rows.slice(start)
  }

  const handleChange = (text) => {
    setRaw(text)
    setPreview(parse(text).slice(0, 6))
  }

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
        onPaste={(e) => { e.preventDefault(); const text = e.clipboardData.getData('text'); handleChange(text) }}
        rows={5}
        placeholder="วางข้อมูลจาก Excel ที่นี่ (Ctrl+V)..."
        className="w-full px-3 py-2 text-xs border border-orange-200 rounded-lg bg-white focus:outline-none focus:border-orange-400 font-mono resize-none"
      />
      {preview.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr className="bg-orange-100">
                {heads.map((h) => <th key={h} className="border border-orange-200 px-2 py-1 text-orange-700 font-medium whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="bg-white">
                  {cols.map((_, ci) => <td key={ci} className="border border-orange-100 px-2 py-1 text-gray-600">{row[ci] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length < parse(raw).length && (
            <p className="text-xs text-gray-400 mt-1">...และอีก {parse(raw).length - preview.length} แถว</p>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">ยกเลิก</button>
        <button onClick={handleApply} disabled={!raw.trim()}
          className="text-xs px-3 py-1.5 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-1">
          <i className="ti ti-table-import" /> นำเข้า {parse(raw).length > 0 ? `(${parse(raw).length} แถว)` : ''}
        </button>
      </div>
    </div>
  )
}

// ── PDF Report Modal ───────────────────────────────────────
function ReportModal({ order, onClose }) {
  const [reportType, setReportType] = useState(() => detectReportType(order.sample_type))
  const [testers, setTesters] = useState([])
  const [selectedTesterId, setSelectedTesterId] = useState('')
  const [remarks, setRemarks] = useState(order.result_notes || '')
  const [generating, setGenerating] = useState(false)
  const [loadingTesters, setLoadingTesters] = useState(true)
  const [showPaste, setShowPaste] = useState(false)

  const [compRows, setCompRows] = useState(() => [
    mkCompRow({ spec_no: '1', area_cm2: order.area_cm2 || '', weight_kg: order.weight_kg || '', load_kn: order.load_kn || '', ultimate_stress: order.compressive_strength || '' }),
    mkCompRow({ spec_no: '2' }),
    mkCompRow({ spec_no: '3' }),
  ])

  const [tensionRows, setTensionRows] = useState(() => [mkTensionRow({ spec_no: '1' })])

  useEffect(() => {
    personnelAPI.getAll({ role: 'tester', active: 'true' })
      .then(({ data }) => setTesters(data.data || []))
      .catch(() => {})
      .finally(() => setLoadingTesters(false))
  }, [])

  // ดึงผลที่บันทึกไว้แล้วจากหน้า "บันทึกผลการทดสอบ" มาเติมให้อัตโนมัติ (ถ้ามี) แทนแถวว่างเริ่มต้น
  useEffect(() => {
    resultsAPI.getAll({ workOrderId: order.ref_no }).then(({ data }) => {
      const saved = data.data || []
      const concreteSaved = saved.filter((r) => r.testType === 'concrete')
      const steelSaved = saved.filter((r) => r.testType === 'steel')

      if (concreteSaved.length) {
        setCompRows(concreteSaved.map((r) => mkCompRow({
          spec_no: r.specNo, area_cm2: r.col8 || '', volume_cm3: r.col9 || '',
          weight_kg: r.col5 || '', density: r.col10 || '', load_kn: r.col6 || '',
          ultimate_stress: r.col11 || '', ksc: r.col11 ? (parseFloat(r.col11) * 10.197).toFixed(0) : '',
        })))
      }
      if (steelSaved.length) {
        setTensionRows(steelSaved.map((r) => {
          const area = parseFloat(r.col9)
          const elong = (r.col6 && r.col7) ? ((parseFloat(r.col6) / parseFloat(r.col7)) * 100).toFixed(1) : ''
          return mkTensionRow({
            spec_no: r.specNo, nominal_size: r.col1 || '',
            weight_kg_m: !isNaN(area) ? (area * 0.785).toFixed(3) : '',
            tested_dia: (String(r.col1 || '').match(/(\d+(\.\d+)?)/) || [])[1] || '',
            nominal_area: r.col9 || '', yield_kn: r.col4 || '', ultimate_kn: r.col5 || '',
            yield_mpa: r.col10 || '', ultimate_mpa: r.col11 || '', elongation_pct: elong, gauge_length: r.col7 || '',
          })
        }))
      }
      // สลับแท็บให้ตรงกับข้อมูลที่บันทึกไว้จริง ถ้ามีแค่ประเภทเดียว (กัน sample_type เดาผิดตอน detectReportType)
      if (steelSaved.length && !concreteSaved.length) setReportType('tension')
      else if (concreteSaved.length && !steelSaved.length) setReportType('compression')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePasteComp = (mapped) => {
    setCompRows(mapped.map((m, i) => {
      const row = mkCompRow({ spec_no: m.spec_no || String(i + 1), area_cm2: m.area_cm2, volume_cm3: m.volume_cm3, weight_kg: m.weight_kg, load_kn: m.load_kn })
      const kn   = parseFloat(row.load_kn)
      const area = parseFloat(row.area_cm2)
      const wt   = parseFloat(row.weight_kg)
      const vol  = parseFloat(row.volume_cm3)
      if (!isNaN(kn) && !isNaN(area) && area > 0) {
        const mpa = (kn * 10 / area).toFixed(2)
        row.ultimate_stress = mpa
        row.ksc = (parseFloat(mpa) * 10.197).toFixed(0)
      }
      if (!isNaN(wt) && !isNaN(vol) && vol > 0) row.density = (wt * 1000 / vol).toFixed(2)
      return row
    }))
  }

  const handlePasteTension = (mapped) => {
    setTensionRows(mapped.map((m, i) => {
      const row = mkTensionRow({ spec_no: m.spec_no || String(i + 1), nominal_size: m.nominal_size, weight_kg_m: m.weight_kg_m, tested_dia: m.tested_dia, nominal_area: m.nominal_area, yield_kn: m.yield_kn, ultimate_kn: m.ultimate_kn, elongation_pct: m.elongation_pct, gauge_length: m.gauge_length })
      const area = parseFloat(row.nominal_area)
      if (!isNaN(area) && area > 0) {
        const yk = parseFloat(row.yield_kn)
        const uk = parseFloat(row.ultimate_kn)
        if (!isNaN(yk)) row.yield_mpa    = (yk * 10 / area).toFixed(1)
        if (!isNaN(uk)) row.ultimate_mpa = (uk * 10 / area).toFixed(1)
      }
      return row
    }))
  }

  const updateCompRow = (idx, key, val) => {
    setCompRows((rows) => {
      const next = rows.map((r, i) => i === idx ? { ...r, [key]: val } : r)
      const row = next[idx]
      const wt = parseFloat(key === 'weight_kg' ? val : row.weight_kg)
      const vol = parseFloat(key === 'volume_cm3' ? val : row.volume_cm3)
      if (!isNaN(wt) && !isNaN(vol) && vol > 0) next[idx].density = (wt * 1000 / vol).toFixed(2)
      const kn = parseFloat(key === 'load_kn' ? val : row.load_kn)
      const area = parseFloat(key === 'area_cm2' ? val : row.area_cm2)
      if (!isNaN(kn) && !isNaN(area) && area > 0) {
        const mpa = (kn * 10 / area).toFixed(2)
        next[idx].ultimate_stress = mpa
        next[idx].ksc = (parseFloat(mpa) * 10.197).toFixed(0)
      }
      return next
    })
  }

  const updateTensionRow = (idx, key, val) => {
    setTensionRows((rows) => {
      const next = rows.map((r, i) => i === idx ? { ...r, [key]: val } : r)
      const row = next[idx]
      const area = parseFloat(key === 'nominal_area' ? val : row.nominal_area)
      if (!isNaN(area) && area > 0) {
        const yk = parseFloat(key === 'yield_kn' ? val : row.yield_kn)
        if (!isNaN(yk)) next[idx].yield_mpa = (yk * 10 / area).toFixed(1)
        const uk = parseFloat(key === 'ultimate_kn' ? val : row.ultimate_kn)
        if (!isNaN(uk)) next[idx].ultimate_mpa = (uk * 10 / area).toFixed(1)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    const tester = testers.find((t) => t.id === selectedTesterId)
    const payload = {
      type: reportType,
      order: {
        ref_no: order.ref_no,
        project_name: order.project_name,
        contractor: order.contractor,
        sample_type: order.sample_type,
        received_date: order.received_date,
        casting_date: order.casting_date || '',
      },
      remarks,
      tester_name: tester?.fullname_en || '',
      tester_name_th: tester?.fullname_th || '',
    }

    if (reportType === 'compression') {
      payload.specimens = compRows.filter((r) => r.spec_no || r.load_kn || r.area_cm2)
    } else {
      const groups = {}
      const orderedKeys = []
      tensionRows.forEach((row) => {
        const key = row.nominal_size || 'Other'
        if (!groups[key]) { groups[key] = { barSize: key, specimens: [] }; orderedKeys.push(key) }
        groups[key].specimens.push(row)
      })
      payload.specimenGroups = orderedKeys.map((k) => groups[k])
    }

    setGenerating(true)
    try {
      const response = await reportAPI.generate(payload)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${reportType}-${order.ref_no}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('เกิดข้อผิดพลาดในการสร้าง PDF — ตรวจสอบว่า Backend รันอยู่')
    } finally {
      setGenerating(false)
    }
  }

  const inputCls = 'w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-orange-400 bg-white'
  const readonlyCls = 'w-full px-2 py-1.5 text-xs border border-orange-200 rounded bg-orange-50 text-orange-700 font-medium'

  return (
    <Modal title="สร้างรายงาน PDF" wide onClose={onClose}>
      <div className="px-6 py-5 space-y-5">

        {/* Report type */}
        <div className="flex gap-2">
          {[{ v: 'compression', label: 'Compression Test', icon: 'ti-box' }, { v: 'tension', label: 'Tension Test', icon: 'ti-reorder' }].map(({ v, label, icon }) => (
            <button key={v} onClick={() => { setReportType(v); setShowPaste(false) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                reportType === v ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <i className={`ti ${icon}`} /> {label}
            </button>
          ))}
        </div>

        {/* Customer info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-gray-500 mb-3">ข้อมูลโครงการ (Job ID: {order.ref_no})</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {[
              ['SPECIMEN FROM', order.contractor],
              ['PROJECT NAME', order.project_name],
              ['TYPE OF SPECIMEN', order.sample_type],
              ['DATE OF TESTING', order.received_date],
            ].map(([l, v]) => (
              <div key={l} className="flex gap-2">
                <span className="text-gray-400 w-36 shrink-0">{l}</span>
                <span className="text-gray-700 font-medium">{v || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compression table */}
        {reportType === 'compression' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">ตารางผลการทดสอบ (Compression)</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPaste((v) => !v)}
                  className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${showPaste ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500'}`}>
                  <i className="ti ti-clipboard-text text-xs" /> วางข้อมูล
                </button>
                <button onClick={() => setCompRows((r) => [...r, mkCompRow({ spec_no: String(r.length + 1) })])}
                  className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                  <i className="ti ti-plus text-xs" /> เพิ่มแถว
                </button>
              </div>
            </div>
            {showPaste && <PastePanel mode="compression" onPaste={handlePasteComp} onClose={() => setShowPaste(false)} />}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {['No.', 'Area (cm²)', 'Vol (cm³)', 'Wt (kg)', 'Density', 'Load (kN)', 'Stress (MPa)', 'ksc', ''].map((h) => (
                      <th key={h} className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-gray-200 p-1"><input value={row.spec_no} onChange={(e) => updateCompRow(i, 'spec_no', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.area_cm2} onChange={(e) => updateCompRow(i, 'area_cm2', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.volume_cm3} onChange={(e) => updateCompRow(i, 'volume_cm3', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.weight_kg} onChange={(e) => updateCompRow(i, 'weight_kg', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input readOnly value={row.density} className={readonlyCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.load_kn} onChange={(e) => updateCompRow(i, 'load_kn', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input readOnly value={row.ultimate_stress} className={readonlyCls} /></td>
                      <td className="border border-gray-200 p-1"><input readOnly value={row.ksc} className={readonlyCls} /></td>
                      <td className="border border-gray-200 p-1 text-center">
                        {compRows.length > 1 && (
                          <button onClick={() => setCompRows((r) => r.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                            <i className="ti ti-trash text-xs" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tension table */}
        {reportType === 'tension' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600">ตารางผลการทดสอบ (Tension) — กลุ่มตาม Nominal Size = 1 หน้า</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPaste((v) => !v)}
                  className={`text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${showPaste ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-500'}`}>
                  <i className="ti ti-clipboard-text text-xs" /> วางข้อมูล
                </button>
                <button onClick={() => setTensionRows((r) => [...r, mkTensionRow({ spec_no: String(r.length + 1) })])}
                  className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                  <i className="ti ti-plus text-xs" /> เพิ่มแถว
                </button>
              </div>
            </div>
            {showPaste && <PastePanel mode="tension" onPaste={handlePasteTension} onClose={() => setShowPaste(false)} />}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-gray-100">
                    {['No.', 'Nom. Size (mm)', 'Wt/m (kg/m)', 'Tested Dia (mm)', 'Nom. Area (cm²)', 'Yield (kN)', 'Ult. (kN)', 'Yield MPa', 'Ult. MPa', 'Elong (%)', 'GL (cm)', ''].map((h) => (
                      <th key={h} className="border border-gray-200 px-1.5 py-1.5 text-center font-medium text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tensionRows.map((row, i) => (
                    <tr key={i}>
                      <td className="border border-gray-200 p-1"><input value={row.spec_no} onChange={(e) => updateTensionRow(i, 'spec_no', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input value={row.nominal_size} onChange={(e) => updateTensionRow(i, 'nominal_size', e.target.value)} placeholder="e.g. 12" className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.weight_kg_m} onChange={(e) => updateTensionRow(i, 'weight_kg_m', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.tested_dia} onChange={(e) => updateTensionRow(i, 'tested_dia', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.nominal_area} onChange={(e) => updateTensionRow(i, 'nominal_area', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.yield_kn} onChange={(e) => updateTensionRow(i, 'yield_kn', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.ultimate_kn} onChange={(e) => updateTensionRow(i, 'ultimate_kn', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input readOnly value={row.yield_mpa} className={readonlyCls} /></td>
                      <td className="border border-gray-200 p-1"><input readOnly value={row.ultimate_mpa} className={readonlyCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.elongation_pct} onChange={(e) => updateTensionRow(i, 'elongation_pct', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1"><input type="number" value={row.gauge_length} onChange={(e) => updateTensionRow(i, 'gauge_length', e.target.value)} className={inputCls} /></td>
                      <td className="border border-gray-200 p-1 text-center">
                        {tensionRows.length > 1 && (
                          <button onClick={() => setTensionRows((r) => r.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">
                            <i className="ti ti-trash text-xs" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400">* Stress MPa คำนวณอัตโนมัติจาก Load และ Nominal Area | แถวที่มี Nominal Size เดียวกันจะอยู่ในหน้าเดียวกัน</p>
          </div>
        )}

        {/* Remarks */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">
            {reportType === 'compression' ? 'โครงสร้าง/บริเวณที่เท' : 'REMARKS'}
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="หมายเหตุเพิ่มเติม..."
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50 resize-none"
          />
        </div>

        {/* Tester */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Tested by (ผู้ทดสอบ)</label>
          {loadingTesters ? (
            <p className="text-xs text-gray-400">กำลังโหลด...</p>
          ) : testers.length === 0 ? (
            <p className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
              ยังไม่มีผู้ทดสอบ — ไปที่เมนู "จัดการบุคลากร" เพื่อเพิ่ม
            </p>
          ) : (
            <select
              value={selectedTesterId}
              onChange={(e) => setSelectedTesterId(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50"
            >
              <option value="">— เลือกผู้ทดสอบ —</option>
              {testers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullname_th}{t.fullname_en ? ` (${t.fullname_en})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
        <button onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          ยกเลิก
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2"
        >
          <i className={`ti ${generating ? 'ti-loader-2 animate-spin' : 'ti-file-type-pdf'}`} />
          {generating ? 'กำลังสร้าง PDF...' : 'สร้าง PDF'}
        </button>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function WorkOrderDetailPage() {
  const { refNo } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [newStatus, setNewStatus] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const [showDoc, setShowDoc]       = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [creatingSheet, setCreatingSheet] = useState(false)
  const [syncingSheet, setSyncingSheet]   = useState(false)

  useEffect(() => {
    workorderAPI.getOne(refNo)
      .then(({ data }) => { setOrder(data.data); setNewStatus(data.data.status) })
      .catch((err) => { if (err.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [refNo])

  const handleStatusSave = async () => {
    if (!newStatus || newStatus === order.status) return
    setSavingStatus(true)
    try {
      await workorderAPI.updateStatus(refNo, newStatus)
      setOrder((o) => ({ ...o, status: newStatus }))
    } catch { alert('อัปเดตสถานะไม่สำเร็จ') }
    finally { setSavingStatus(false) }
  }

  const handleSyncSheet = async () => {
    setSyncingSheet(true)
    try {
      const { data } = await workorderAPI.syncSheet(refNo)
      setOrder((o) => ({ ...o, ...data.data }))
      alert('ซิงค์ข้อมูลสำเร็จ')
    } catch (err) {
      if (err.response?.data?.message === 'GOOGLE_AUTH_REQUIRED') {
        window.open('http://localhost:5000/api/google-auth/connect', '_blank', 'width=500,height=600')
      } else {
        alert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการซิงค์')
      }
    } finally {
      setSyncingSheet(false)
    }
  }

  const handleCreateSheet = async () => {
    setCreatingSheet(true)
    try {
      const { data } = await workorderAPI.createSheet(refNo)
      setOrder((o) => ({ ...o, sheet_url: data.sheet_url }))
    } catch (err) {
      if (err.response?.data?.message === 'GOOGLE_AUTH_REQUIRED') {
        window.open('http://localhost:5000/api/google-auth/connect', '_blank', 'width=500,height=600')
      } else {
        alert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้าง Sheet')
      }
    } finally {
      setCreatingSheet(false)
    }
  }

  if (loading) return <Loader />

  if (notFound) return (
    <div className="flex flex-col items-center justify-center h-full min-h-96 gap-3">
      <i className="ti ti-file-off text-4xl text-gray-200" />
      <p className="text-gray-400 text-sm">ไม่พบใบงาน {refNo}</p>
      <button onClick={() => navigate('/workorders')} className="text-sm text-orange-400 hover:underline">← กลับหน้ารายการ</button>
    </div>
  )

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/workorders')}
          className="text-gray-400 hover:text-gray-700 transition-colors p-1 -ml-1">
          <i className="ti ti-arrow-left text-lg" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-medium text-gray-800">{order.ref_no}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-600'}`}>
              {order.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{order.project_name}</p>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowDoc(true)}
            className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors">
            <i className="ti ti-file-export text-sm" /> ออกเอกสาร
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-3 gap-4">
        {/* LEFT */}
        <div className="col-span-2 space-y-4">
          <Section title="ข้อมูลทั่วไป">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InfoRow label="REF NO."                  value={order.ref_no} />
              <InfoRow label="วันที่รับตัวอย่าง"         value={order.received_date} />
              <InfoRow label="ชื่อโครงการ"               value={order.project_name} />
              <InfoRow label="ผู้รับเหมา / หน่วยงาน"    value={order.contractor} />
              <InfoRow label="ประเภทตัวอย่าง"            value={order.sample_type} />
              <InfoRow label="จำนวนตัวอย่าง (ชิ้น)"     value={order.sample_count} />
              <InfoRow label="อายุทดสอบ (วัน)"           value={order.test_age_days} />
              <InfoRow label="บันทึกโดย"                 value={order.created_by} />
            </div>
            {order.notes && (
              <div className="pt-2 border-t border-gray-100">
                <InfoRow label="หมายเหตุ" value={order.notes} />
              </div>
            )}
          </Section>

          {/* ข้อมูลจาก Sheet */}
          {order.sheet_url && (
            <Section title="ข้อมูลจากใบรับงาน (ซิงค์จาก Google Sheet)">
              {!(order.customer_name || order.company || order.specimen_from || order.receipt_name) ? (
                <p className="text-xs text-gray-400 italic">ยังไม่มีข้อมูล — กด "ซิงค์ข้อมูลจาก Sheet" เมื่อลูกค้ากรอกแบบฟอร์มแล้ว</p>
              ) : (
                <div className="space-y-5">

                  {/* ทดสอบอะไร */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">ทดสอบอะไร</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <InfoRow label="ประเภทตัวอย่าง"   value={order.sample_type} />
                      <InfoRow label="อาจารย์ผู้ทดสอบ"  value={order.professor} />
                      <InfoRow label="วันที่รับตัวอย่าง" value={order.received_date} />
                      <InfoRow label="ผู้รับตัวอย่าง"   value={order.received_by} />
                    </div>
                  </div>

                  {/* รายละเอียดผู้ส่งตัวอย่าง */}
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">รายละเอียดผู้ส่งตัวอย่างทดสอบ</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <InfoRow label="ชื่อ-นามสกุล"        value={order.customer_name} />
                      <InfoRow label="หน่วยงาน / บริษัท"   value={order.company} />
                      <InfoRow label="เบอร์ติดต่อ / LINE"  value={order.phone} />
                    </div>
                  </div>

                  {/* รายละเอียดลงในใบงาน */}
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">รายละเอียดลงในใบงาน</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <InfoRow label="ชื่อผู้จ้าง (Specimen from)" value={order.specimen_from} />
                      <InfoRow label="ชื่อโครงการ"                 value={order.project_name} />
                    </div>
                  </div>

                  {/* รายละเอียดออกใบเสร็จ */}
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">รายละเอียดออกใบเสร็จรับเงิน</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <InfoRow label="ออกในนาม"                     value={order.receipt_name} />
                      <InfoRow label="เลขประจำตัวผู้เสียภาษี"       value={order.tax_id} />
                      <div className="col-span-2">
                        <InfoRow label="ที่อยู่"                     value={order.receipt_address} />
                      </div>
                    </div>
                  </div>

                  {/* รายการทดสอบ */}
                  {order.test_items && order.test_items.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">รายการทดสอบ</p>
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">ขนาด / รายการ</th>
                            <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">ผู้ผลิต</th>
                            <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">จำนวน (เส้น)</th>
                            <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.test_items.map((item, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border border-gray-200 px-2 py-1.5 font-medium">{item.bar_size || '—'}</td>
                              <td className="border border-gray-200 px-2 py-1.5">{item.manufacturer || '—'}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-center">{item.quantity || '—'}</td>
                              <td className="border border-gray-200 px-2 py-1.5 text-gray-400">{item.notes || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}
            </Section>
          )}

          {/* ข้อมูลที่นำเข้าจากไฟล์/ลิงก์ (ประเภทการทดสอบ "อื่นๆ") */}
          {order.imported_headers && order.imported_headers.length > 0 && (
            <Section title="ข้อมูลที่นำเข้า">
              {order.import_source && (
                <p className="text-xs text-gray-400 -mt-2">จาก: {order.import_source}</p>
              )}
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      {order.imported_headers.map((h, i) => (
                        <th key={i} className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">{h || '—'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(order.imported_rows || []).map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {order.imported_headers.map((_, ci) => (
                          <td key={ci} className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">{row[ci] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ผลที่บันทึกไว้ */}
          {order.compressive_strength && (
            <Section title="ผลการทดสอบที่บันทึกไว้">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="แรงกด (kN)"           value={order.load_kn} />
                <InfoRow label="น้ำหนักตัวอย่าง (kg)" value={order.weight_kg} />
                <InfoRow label="พื้นที่หน้าตัด (cm²)" value={order.area_cm2} />
                <InfoRow label="กำลังอัด (MPa)"        value={order.compressive_strength} />
              </div>
              {order.result_notes && (
                <div className="pt-2 border-t border-gray-100">
                  <InfoRow label="หมายเหตุ" value={order.result_notes} />
                </div>
              )}
            </Section>
          )}

          <FinanceSummaryCard refNo={order.ref_no} />
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <Section title="อัปเดตสถานะ">
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setNewStatus(s)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                    newStatus === s
                      ? 'border-orange-400 bg-orange-50 text-orange-600 font-medium'
                      : 'border-gray-100 hover:border-gray-200 text-gray-500'
                  }`}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    { รับเรื่อง: 'bg-blue-400', รอข้อมูล: 'bg-yellow-400', ดำเนินการ: 'bg-red-400', เสร็จสิ้น: 'bg-green-500' }[s]
                  }`} />
                  {s}
                </button>
              ))}
            </div>
            <button onClick={handleStatusSave}
              disabled={savingStatus || newStatus === order.status}
              className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white text-sm py-2.5 rounded-lg transition-colors">
              {savingStatus ? 'กำลังบันทึก...' : 'บันทึกสถานะ'}
            </button>
          </Section>

          <Section title="Google Sheet">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                {order.sheet_url && (
                  <a href={order.sheet_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm text-orange-400 hover:underline">
                    <i className="ti ti-table-export text-base" /> เปิด →
                  </a>
                )}
                <button
                  onClick={handleCreateSheet}
                  disabled={creatingSheet}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-orange-400 disabled:opacity-40 transition-colors"
                >
                  <i className={`ti ${creatingSheet ? 'ti-loader-2 animate-spin' : 'ti-table-plus'} text-base`} />
                  {creatingSheet ? 'กำลังสร้าง...' : order.sheet_url ? 'สร้างใหม่' : 'สร้าง Google Sheet'}
                </button>
              </div>
              {order.sheet_url && (
                <button
                  onClick={handleSyncSheet}
                  disabled={syncingSheet}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 border border-green-200 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-40 transition-colors"
                >
                  <i className={`ti ${syncingSheet ? 'ti-loader-2 animate-spin' : 'ti-refresh'} text-base`} />
                  {syncingSheet ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลจาก Sheet'}
                </button>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Modals */}
      {showDoc && (
        <DocumentModal order={order} onClose={() => setShowDoc(false)} onPrintReport={() => setShowReport(true)} />
      )}
      {showReport && (
        <ReportModal order={order} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}
