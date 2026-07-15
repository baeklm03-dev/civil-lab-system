import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { workorderAPI, personnelAPI, announcementAPI } from '../services/api'

const STATUSES = ['ทั้งหมด', 'รับเรื่อง', 'รอข้อมูล', 'ดำเนินการ', 'เสร็จสิ้น']

// ── สร้าง REF NO. preview ──
function genRefPreview(seq) {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}${String(seq).padStart(2, '0')}`
}

// ── Import Modal ──
const IMPORT_COLS  = ['contractor', 'project_name', 'sample_type', 'sample_count', 'test_age_days', 'received_date', 'notes']
const IMPORT_HEADS = ['ผู้รับเหมา', 'ชื่อโครงการ', 'ประเภทตัวอย่าง', 'จำนวน', 'อายุทดสอบ (วัน)', 'วันที่รับ (YYYY-MM-DD)', 'หมายเหตุ']

function ImportModal({ onClose, onImported }) {
  const [raw, setRaw] = useState('')
  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parse = (text) => {
    const rows = text.trim().split(/\r?\n/)
      .map((r) => r.split('\t').map((c) => c.trim()))
      .filter((r) => r.some((c) => c !== ''))
    // ข้ามแถวหัวตาราง ถ้าคอลัมน์ "จำนวน" ไม่ใช่ตัวเลข
    const start = (rows.length > 0 && rows[0][3] && isNaN(Number(rows[0][3]))) ? 1 : 0
    return rows.slice(start)
  }

  const handleChange = (text) => {
    setRaw(text)
    setError('')
    setPreview(parse(text).slice(0, 8))
  }

  const handleSubmit = async () => {
    setError('')
    const rows = parse(raw)
    if (!rows.length) { setError('ไม่พบข้อมูลที่จะนำเข้า'); return }

    const workOrders = rows.map((cells) => {
      const obj = {}
      IMPORT_COLS.forEach((key, ci) => { obj[key] = cells[ci] ?? '' })
      return obj
    })

    const invalid = workOrders.some((w) => !w.project_name || !w.contractor || !w.sample_type)
    if (invalid) { setError('ทุกแถวต้องมีผู้รับเหมา ชื่อโครงการ และประเภทตัวอย่าง'); return }

    setLoading(true)
    try {
      const { data } = await workorderAPI.importOrders(workOrders)
      onImported(data.data?.length || workOrders.length)
    } catch (err) {
      setError(err.response?.data?.message || 'นำเข้าไม่สำเร็จ')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-800">นำเข้าใบงาน</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              คัดลอกคอลัมน์จาก Excel ตามลำดับ:&nbsp;
              <span className="text-orange-500 font-medium">{IMPORT_HEADS.join(' → ')}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 mt-0.5">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <textarea
            autoFocus
            value={raw}
            onChange={(e) => handleChange(e.target.value)}
            onPaste={(e) => { e.preventDefault(); handleChange(e.clipboardData.getData('text')) }}
            rows={6}
            placeholder="วางข้อมูลจาก Excel ที่นี่ (Ctrl+V)..."
            className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-orange-400 font-mono resize-none"
          />

          {preview.length > 0 && (
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-gray-50">
                    {IMPORT_HEADS.map((h) => <th key={h} className="px-2 py-1.5 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.map((cells, ri) => (
                    <tr key={ri}>
                      {IMPORT_COLS.map((_, ci) => <td key={ci} className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{cells[ci] || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handleSubmit} disabled={loading || !preview.length}
            className="text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-60 transition-colors flex items-center gap-2">
            <i className="ti ti-upload" />
            {loading ? 'กำลังนำเข้า...' : `นำเข้า ${preview.length ? parse(raw).length : ''} รายการ`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Modal ──
const TEST_TYPES = [
  { v: 'concrete', label: 'คอนกรีต' },
  { v: 'steel', label: 'เหล็กเส้น' },
  { v: 'other', label: 'อื่นๆ' },
]

function CreateModal({ onClose, onCreated, nextSeq }) {
  const [form, setForm] = useState({
    project_name: '', contractor: '', sample_type: 'Cube',
    sample_type_other: '', notes: '', professor: '',
    test_type: 'concrete', custom_test_name: '',
  })
  const [customColumns, setCustomColumns] = useState([{ name: '', unit: '' }])
  const [announcements, setAnnouncements] = useState([])
  const [selectedAnnouncements, setSelectedAnnouncements] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [professors, setProfessors] = useState([])

  useEffect(() => {
    personnelAPI.getAll({ role: 'professor', active: 'true' })
      .then(({ data }) => setProfessors(data.data || []))
      .catch(() => {})
    announcementAPI.getAll({ activeOnly: 'true' })
      .then(({ data }) => setAnnouncements(data.data || []))
      .catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const toggleAnnouncement = (id) => {
    setSelectedAnnouncements((sel) => sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
  }

  const updateColumn = (idx, key, val) => {
    setCustomColumns((cols) => cols.map((c, i) => i === idx ? { ...c, [key]: val } : c))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.sample_type === 'Other' && !form.sample_type_other.trim()) {
      setError('กรุณาระบุประเภทตัวอย่าง'); return
    }
    if (form.test_type === 'other' && !form.custom_test_name.trim()) {
      setError('กรุณาระบุชื่อประเภทการทดสอบ'); return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        sample_type: form.sample_type === 'Other' ? form.sample_type_other.trim() : form.sample_type,
        selected_announcements: selectedAnnouncements.join(','),
        custom_columns: form.test_type === 'other'
          ? customColumns.filter((c) => c.name.trim())
          : [],
      }
      delete payload.sample_type_other
      const { data } = await workorderAPI.create(payload)
      onCreated(data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-base font-medium text-gray-800">สร้างใบงานทดสอบใหม่</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              REF NO. จะถูกสร้างอัตโนมัติ:{' '}
              <span className="text-orange-400 font-medium">{genRefPreview(nextSeq)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 mt-0.5">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">ผู้รับเหมา / หน่วยงาน <span className="text-xs text-gray-400">(ไม่บังคับ — รอลูกค้ากรอกใน Sheet)</span></label>
              <input value={form.contractor} onChange={set('contractor')}
                placeholder="ชื่อบริษัท / หน่วยงาน"
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">ชื่อโครงการ <span className="text-xs text-gray-400">(ไม่บังคับ — รอลูกค้ากรอกใน Sheet)</span></label>
              <input value={form.project_name} onChange={set('project_name')}
                placeholder="เช่น โครงการก่อสร้างอาคาร B"
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">ประเภทตัวอย่าง <span className="text-red-400">*</span></label>
              <select value={form.sample_type} onChange={set('sample_type')}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50">
                {['Cube', 'Coring', 'Cylinder', 'Cylinder Cap', 'Other'].map((t) => <option key={t}>{t}</option>)}
              </select>
              {form.sample_type === 'Other' && (
                <input
                  value={form.sample_type_other}
                  onChange={set('sample_type_other')}
                  placeholder="ระบุประเภทตัวอย่าง..."
                  autoFocus
                  className="px-3 py-2.5 rounded-lg border border-orange-300 text-sm focus:outline-none focus:border-orange-400 bg-orange-50"
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">ประเภทการทดสอบ <span className="text-red-400">*</span></label>
              <div className="flex gap-2">
                {TEST_TYPES.map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, test_type: v }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      form.test_type === v
                        ? 'border-orange-400 bg-orange-50 text-orange-600 font-medium'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span className={`inline-block w-3 h-3 rounded-full border ${form.test_type === v ? 'border-orange-400 bg-orange-400' : 'border-gray-300'}`} />
                    {label}
                  </button>
                ))}
              </div>
              {form.test_type === 'other' && (
                <div className="space-y-3 pt-1">
                  <input
                    value={form.custom_test_name}
                    onChange={set('custom_test_name')}
                    placeholder="ระบุชื่อประเภทการทดสอบ..."
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-lg border border-orange-300 text-sm focus:outline-none focus:border-orange-400 bg-orange-50"
                  />
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-gray-500">คอลัมน์ผลทดสอบ (ชื่อ + หน่วย)</p>
                    {customColumns.map((col, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={col.name} onChange={(e) => updateColumn(i, 'name', e.target.value)}
                          placeholder="ชื่อคอลัมน์" className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400" />
                        <input value={col.unit} onChange={(e) => updateColumn(i, 'unit', e.target.value)}
                          placeholder="หน่วย" className="w-20 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400" />
                        {customColumns.length > 1 && (
                          <button type="button" onClick={() => setCustomColumns((cols) => cols.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 px-1"><i className="ti ti-trash text-xs" /></button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setCustomColumns((cols) => [...cols, { name: '', unit: '' }])}
                      className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                      <i className="ti ti-plus text-xs" /> เพิ่มคอลัมน์
                    </button>
                  </div>
                </div>
              )}
            </div>

            {announcements.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-700">ข้อความแจ้งในใบงาน</label>
                <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {announcements.map((a) => (
                    <label key={a.announcementId} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAnnouncements.includes(a.announcementId)}
                        onChange={() => toggleAnnouncement(a.announcementId)}
                        className="accent-orange-400"
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">อาจารย์ผู้ทดสอบ</label>
              <select value={form.professor} onChange={set('professor')}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50">
                <option value="">— ไม่ระบุ —</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.fullname_th}>
                    {p.fullname_th}{p.fullname_en ? ` (${p.fullname_en})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">หมายเหตุ</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2}
                placeholder="ข้อมูลเพิ่มเติม..."
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50 resize-none" />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading}
              className="text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-60 transition-colors flex items-center gap-2">
              <i className="ti ti-circle-check" />
              {loading ? 'กำลังสร้าง...' : 'สร้างใบงาน + Google Sheet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ──
export default function WorkOrdersPage() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ทั้งหมด')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const LIMIT = 20

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await workorderAPI.getAll({
        status: filter !== 'ทั้งหมด' ? filter : undefined,
        search: search || undefined,
        page,
        limit: LIMIT,
      })
      setOrders(data.data)
      setTotal(data.total)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [filter, search, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // เปิด detail จาก URL param
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) navigate(`/workorders/${ref}`, { replace: true })
  }, [searchParams])

  const handleCreated = (newOrder) => {
    setShowCreate(false)
    navigate(`/workorders/${newOrder.ref_no}`)
  }

  const handleImported = (count) => {
    setShowImport(false)
    alert(`นำเข้าสำเร็จ ${count} รายการ`)
    fetchOrders()
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="relative">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-medium text-gray-800">ใบงานทดสอบ</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="ti ti-upload text-sm" /> นำเข้าใบงาน
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors"
          >
            <i className="ti ti-plus text-sm" /> สร้างใบงานใหม่
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-1">
          <h2 className="text-base font-medium text-gray-800">ใบงานทดสอบ</h2>
          <p className="text-xs text-gray-400 mt-0.5">ทั้งหมด {total} รายการ</p>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 mt-4 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="ค้นหา REF NO., โครงการ, ผู้รับเหมา..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white"
            />
          </div>
          <div className="flex gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setFilter(s); setPage(1) }}
                className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors ${
                  filter === s
                    ? 'bg-orange-400 text-white border-orange-400'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">แสดง {orders.length} รายการ</span>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">REF NO.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">โครงการ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ผู้รับเหมา</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ประเภทตัวอย่าง</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">วันที่รับ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Google Sheet</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                  <i className="ti ti-loader-2 animate-spin mr-2" />กำลังโหลด...
                </td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">ไม่พบรายการ</td></tr>
              ) : orders.map((o) => (
                <tr
                  key={o.ref_no + o.project_name}
                  onClick={() => navigate(`/workorders/${o.ref_no}`)}
                  className="hover:bg-orange-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-orange-400 font-medium">{o.ref_no}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-48 truncate">{o.project_name}</td>
                  <td className="px-4 py-3 text-gray-500">{o.contractor}</td>
                  <td className="px-4 py-3 text-gray-500">{o.sample_type}</td>
                  <td className="px-4 py-3 text-gray-500">{o.received_date}</td>
                  <td className="px-4 py-3">
                    {o.sheet_url
                      ? <span className="flex items-center gap-1 text-xs text-green-700"><i className="ti ti-circle-check" /> เชื่อมแล้ว</span>
                      : <span className="flex items-center gap-1 text-xs text-gray-400"><i className="ti ti-minus" /> ยังไม่มี</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge badge-${o.status}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <span className="text-xs text-gray-400">หน้า {page}/{totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              ถัดไป
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          nextSeq={(orders.length % 99) + 1}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
    </div>
  )
}
