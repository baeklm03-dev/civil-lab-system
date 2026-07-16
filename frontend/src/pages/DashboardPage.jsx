import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { workorderAPI, exportAPI } from '../services/api'
import { useToast } from '../hooks/useToast'

const fmt = (d) => d.toISOString().slice(0, 10)
const RANGE_PRESETS = [
  { v: 'today', label: 'วันนี้' },
  { v: 'week', label: 'สัปดาห์นี้' },
  { v: 'month', label: 'เดือนนี้' },
  { v: 'year', label: 'ปีนี้' },
  { v: 'custom', label: '📅 กำหนดเอง' },
]

function computeRange(preset) {
  const now = new Date()
  const today = fmt(now)
  if (preset === 'today') return { startDate: today, endDate: today }
  if (preset === 'week') {
    const day = now.getDay() || 7 // Sunday=0 → treat as 7
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1)
    return { startDate: fmt(monday), endDate: today }
  }
  if (preset === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { startDate: fmt(first), endDate: today }
  }
  if (preset === 'year') {
    const first = new Date(now.getFullYear(), 0, 1)
    return { startDate: fmt(first), endDate: today }
  }
  return { startDate: undefined, endDate: undefined }
}

// ── Export Modal ───────────────────────────────────────────
function ExportModal({ onClose }) {
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [format, setFormat] = useState('xlsx')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = { format }
      if (startDate) params.startDate = fmt(startDate)
      if (endDate) params.endDate = fmt(endDate)
      const res = await exportAPI.list(params)
      const mime = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const blob = new Blob([res.data], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workorders-${fmt(new Date())}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการ export')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-800">⬇ Export</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><i className="ti ti-x text-lg" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">ช่วงวันที่ (ไม่บังคับ)</label>
            <div className="flex items-center gap-2">
              <DatePicker selected={startDate} onChange={setStartDate} dateFormat="yyyy-MM-dd" placeholderText="เริ่มต้น"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400" />
              <span className="text-gray-400">—</span>
              <DatePicker selected={endDate} onChange={setEndDate} dateFormat="yyyy-MM-dd" placeholderText="สิ้นสุด"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">รูปแบบไฟล์</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">ยกเลิก</button>
          <button onClick={handleExport} disabled={loading}
            className="text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-60 flex items-center gap-2">
            <i className={`ti ${loading ? 'ti-loader-2 animate-spin' : 'ti-download'}`} />
            {loading ? 'กำลัง export...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_COLORS = {
  รับเรื่อง:  { bar: '#378ADD', badge: 'badge-รับเรื่อง' },
  รอข้อมูล:  { bar: '#EF9F27', badge: 'badge-รอข้อมูล' },
  ดำเนินการ: { bar: '#E24B4A', badge: 'badge-ดำเนินการ' },
  เสร็จสิ้น:  { bar: '#639922', badge: 'badge-เสร็จสิ้น' },
}
const PIE_COLORS = ['#E8600A', '#F5A96B', '#FAEEDA', '#C4C2B8']

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <i className={`ti ${icon} text-base text-gray-300`} aria-hidden="true" />
      </div>
      <div className="text-2xl font-medium text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rangePreset, setRangePreset] = useState('month')
  const [customStart, setCustomStart] = useState(null)
  const [customEnd, setCustomEnd] = useState(null)
  const [showExport, setShowExport] = useState(false)
  const navigate = useNavigate()

  const activeRange = rangePreset === 'custom'
    ? { startDate: customStart ? fmt(customStart) : undefined, endDate: customEnd ? fmt(customEnd) : undefined }
    : computeRange(rangePreset)

  useEffect(() => {
    setLoading(true)
    workorderAPI.getStats(activeRange)
      .then(({ data }) => setStats(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [rangePreset, customStart, customEnd])

  const now = new Date()
  const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="flex items-center gap-3 text-gray-400">
          <i className="ti ti-loader-2 text-xl animate-spin" />
          <span className="text-sm">กำลังโหลดข้อมูล...</span>
        </div>
      </div>
    )
  }

  const byStatusEntries = stats ? Object.entries(stats.byStatus) : []
  const totalForBar = byStatusEntries.reduce((s, [, v]) => s + v, 0) || 1

  const pieData = stats
    ? Object.entries(stats.byType).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-medium text-gray-800">ภาพรวมระบบ</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">วันที่ {dateStr} — อัปเดตล่าสุด {timeStr} น.</span>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors"
          >
            <i className="ti ti-file-export text-sm" /> นำออกเอกสาร
          </button>
        </div>
      </div>

      {/* Date range bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-2 flex-wrap">
        {RANGE_PRESETS.map(({ v, label }) => (
          <button key={v} onClick={() => setRangePreset(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs border transition-colors ${
              rangePreset === v ? 'bg-orange-400 text-white border-orange-400' : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-400'
            }`}>
            {label}
          </button>
        ))}
        {rangePreset === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <DatePicker selected={customStart} onChange={setCustomStart} dateFormat="yyyy-MM-dd" placeholderText="วันที่เริ่มต้น"
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 w-32" />
            <span className="text-gray-400 text-xs">—</span>
            <DatePicker selected={customEnd} onChange={setCustomEnd} dateFormat="yyyy-MM-dd" placeholderText="วันที่สิ้นสุด"
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 w-32" />
          </div>
        )}
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      <div className="p-6 space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="งานเดือนนี้"     value={stats?.thisMonth ?? '—'}  sub="+12 จากเดือนที่แล้ว"      icon="ti-calendar" />
          <StatCard label="รอดำเนินการ"     value={stats?.pending ?? '—'}    sub="3 รอข้อมูลลูกค้า"         icon="ti-clock" />
          <StatCard label="เสร็จสิ้น"       value={stats?.completed ?? '—'}  sub="รายงานฉบับสมบูรณ์"        icon="ti-circle-check" />
          <StatCard label="ตัวอย่างทั้งหมด" value={stats?.total ?? '—'}      sub="Cube / Coring / Cylinder" icon="ti-test-pipe" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-3 gap-3">
          {/* Line chart */}
          <div className="card col-span-2">
            <h3 className="text-sm font-medium text-gray-700 mb-4">งานแต่ละเดือน</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={stats?.monthlyTrend || []}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #e5e7eb' }}
                  formatter={(v) => [v, 'งาน']}
                />
                <Line type="monotone" dataKey="count" stroke="#E8600A" strokeWidth={2} dot={{ r: 3, fill: '#E8600A' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-700 mb-3">ประเภทตัวอย่าง</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'ชิ้น']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status + Recent */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status bars */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <h3 className="text-sm font-medium text-gray-700">สถานะงานทั้งหมด</h3>
            </div>
            <div className="space-y-3">
              {byStatusEntries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[status]?.bar }} />
                  <span className="text-xs text-gray-500 w-16 shrink-0">{status}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(count / totalForBar) * 100}%`, background: STATUS_COLORS[status]?.bar }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent jobs */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="text-sm font-medium text-gray-700">งานล่าสุด</h3>
              </div>
              <button
                onClick={() => navigate('/workorders')}
                className="text-xs text-orange-400 hover:underline"
              >
                ดูทั้งหมด →
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left pb-2 text-gray-400 font-normal">ID</th>
                  <th className="text-left pb-2 text-gray-400 font-normal">โครงการ</th>
                  <th className="text-left pb-2 text-gray-400 font-normal">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(stats?.recent || []).map((o) => (
                  <tr
                    key={o.ref_no}
                    className="hover:bg-orange-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/workorders?ref=${o.ref_no}`)}
                  >
                    <td className="py-2 text-orange-400 font-medium">{o.ref_no}</td>
                    <td className="py-2 text-gray-600 max-w-32 truncate">{o.project_name}</td>
                    <td className="py-2">
                      <span className={`badge badge-${o.status}`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
