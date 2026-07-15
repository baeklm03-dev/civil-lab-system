import { useEffect, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { adminLogsAPI, adminUsersAPI } from '../../services/api'
import { useToast } from '../../hooks/useToast'

const ACTIONS = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'CREATE_WORKORDER', 'GENERATE_PDF',
  'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'EXPORT_DATA',
]
const LIMIT = 50
const fmt = (d) => d.toISOString().slice(0, 10)

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    adminUsersAPI.getAll().then(({ data }) => setUsers(data.data || [])).catch(() => {})
  }, [])

  const buildParams = () => {
    const params = { page, limit: LIMIT }
    if (startDate) params.startDate = fmt(startDate)
    if (endDate) params.endDate = fmt(endDate)
    if (userId) params.userId = userId
    if (action) params.action = action
    return params
  }

  useEffect(() => {
    setLoading(true)
    adminLogsAPI.getAll(buildParams())
      .then(({ data }) => { setLogs(data.data || []); setTotal(data.total || 0) })
      .catch(() => showToast('โหลด log ไม่สำเร็จ'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, userId, action])

  const handleExport = async () => {
    try {
      const params = buildParams()
      delete params.page
      delete params.limit
      const res = await adminLogsAPI.exportCsv(params)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `system-log-${fmt(new Date())}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Export ไม่สำเร็จ')
    }
  }

  const totalPages = Math.ceil(total / LIMIT) || 1

  return (
    <div>
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-medium text-gray-800">ประวัติการใช้งาน</h1>
        <button onClick={handleExport}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <i className="ti ti-download text-sm" /> ⬇ Export CSV
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <DatePicker selected={startDate} onChange={(d) => { setStartDate(d); setPage(1) }} dateFormat="yyyy-MM-dd" placeholderText="วันที่เริ่มต้น"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 w-36" />
          <span className="text-gray-400 text-sm">—</span>
          <DatePicker selected={endDate} onChange={(d) => { setEndDate(d); setPage(1) }} dateFormat="yyyy-MM-dd" placeholderText="วันที่สิ้นสุด"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 w-36" />
          <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400">
            <option value="">ผู้ใช้ทั้งหมด</option>
            {users.map((u) => <option key={u.userId} value={u.userId}>{u.username}</option>)}
          </select>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400">
            <option value="">Action ทั้งหมด</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">เวลา</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ผู้ใช้</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">รายละเอียด</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm"><i className="ti ti-loader-2 animate-spin mr-2" />กำลังโหลด...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">ไม่พบข้อมูล</td></tr>
              ) : logs.map((l, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{l.timestamp?.replace('T', ' ').slice(0, 19)}</td>
                  <td className="px-4 py-3 text-gray-700">{l.username || '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l.action}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.detail || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{l.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="text-xs px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">ก่อนหน้า</button>
            <span className="text-xs text-gray-400">หน้า {page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
              className="text-xs px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">ถัดไป</button>
          </div>
        )}
      </div>
    </div>
  )
}
