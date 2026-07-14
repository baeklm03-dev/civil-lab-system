import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { workorderAPI, exportAPI } from '../services/api'

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
  const [exporting, setExporting] = useState(false)
  const navigate = useNavigate()

  async function handleExport() {
    setExporting(true)
    try {
      const res = await exportAPI.dashboard()
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `civil-lab-export-${today}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการ export: ' + (err.response?.data ? new TextDecoder().decode(err.response.data) : err.message))
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    workorderAPI.getStats()
      .then(({ data }) => setStats(data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60 transition-colors"
          >
            {exporting
              ? <><i className="ti ti-loader-2 animate-spin" /> กำลัง export...</>
              : <><i className="ti ti-download" /> Export Excel</>
            }
          </button>
        </div>
      </div>

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
