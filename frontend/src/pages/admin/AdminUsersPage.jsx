import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { adminUsersAPI } from '../../services/api'
import { useToast } from '../../hooks/useToast'

const ROLES = ['superadmin', 'admin', 'user']

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    username: user?.username || '',
    fullName: user?.fullName || '',
    password: '',
    confirmPassword: '',
    role: user?.role || 'user',
    status: user?.status || 'active',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isEdit) {
      if (!form.username.trim() || !form.password) { setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return }
      if (form.password !== form.confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }
    }
    if (!form.fullName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return }

    setSaving(true)
    try {
      if (isEdit) {
        await adminUsersAPI.update(user.userId, { fullName: form.fullName, role: form.role, status: form.status })
      } else {
        await adminUsersAPI.create({ username: form.username, password: form.password, fullName: form.fullName, role: form.role, status: form.status })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'แก้ไขผู้ใช้งาน' : 'เพิ่ม User'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">ชื่อผู้ใช้ (username)</label>
            <input value={form.username} onChange={set('username')} disabled={isEdit}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50 disabled:opacity-60" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">ชื่อ-นามสกุล</label>
            <input value={form.fullName} onChange={set('fullName')}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
          </div>
          {!isEdit && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-700">รหัสผ่าน</label>
                <input type="password" value={form.password} onChange={set('password')}
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-700">ยืนยันรหัสผ่าน</label>
                <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')}
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Role</label>
            <select value={form.role} onChange={set('role')}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">สถานะ</label>
            <button type="button" onClick={() => setForm((f) => ({ ...f, status: f.status === 'active' ? 'inactive' : 'active' }))}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${form.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {form.status === 'active' ? '🟢 ใช้งาน' : '🔴 ระงับ'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">ยกเลิก</button>
          <button type="submit" disabled={saving}
            className="text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-60">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ทั้งหมด')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const { showToast } = useToast()

  const fetchUsers = () => {
    setLoading(true)
    adminUsersAPI.getAll()
      .then(({ data }) => setUsers(data.data || []))
      .catch(() => showToast('โหลดข้อมูลผู้ใช้ไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = users.filter((u) => {
    if (roleFilter !== 'ทั้งหมด' && u.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!u.username?.toLowerCase().includes(q) && !u.fullName?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const handleSaved = () => { setShowModal(false); setEditingUser(null); showToast('บันทึกสำเร็จ ✓'); fetchUsers() }

  const handleResetPassword = async (u) => {
    const newPassword = prompt(`ตั้งรหัสผ่านชั่วคราวใหม่สำหรับ ${u.username}`)
    if (!newPassword) return
    try {
      await adminUsersAPI.resetPassword(u.userId, newPassword)
      showToast('รีเซ็ตรหัสผ่านสำเร็จ ✓')
    } catch {
      showToast('รีเซ็ตรหัสผ่านไม่สำเร็จ')
    }
  }

  const handleToggleStatus = async (u) => {
    try {
      await adminUsersAPI.toggleStatus(u.userId, u.status === 'active' ? 'inactive' : 'active')
      fetchUsers()
    } catch {
      showToast('เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  const handleDelete = async (u) => {
    if (!confirm(`ยืนยันลบผู้ใช้ ${u.username}?`)) return
    try {
      await adminUsersAPI.remove(u.userId)
      showToast('ลบสำเร็จ ✓')
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.message || 'ลบไม่สำเร็จ')
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-medium text-gray-800">จัดการผู้ใช้งาน</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors">
          <i className="ti ti-plus text-sm" /> เพิ่ม User
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / username..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-400 bg-white" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400">
            {['ทั้งหมด', ...ROLES].map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ชื่อผู้ใช้</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ชื่อ-นามสกุล</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">สถานะ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">วันที่สร้าง</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm"><i className="ti ti-loader-2 animate-spin mr-2" />กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">ไม่พบผู้ใช้</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.userId} className="hover:bg-orange-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-600">{u.fullName}</td>
                  <td className="px-4 py-3 text-gray-500">{u.role}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleStatus(u)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.status === 'active' ? '🟢 ใช้งาน' : '🔴 ระงับ'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.createdAt ? u.createdAt.slice(0, 10) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      <button onClick={() => { setEditingUser(u); setShowModal(true) }} title="แก้ไข" className="hover:text-orange-500"><i className="ti ti-edit text-sm" /></button>
                      <button onClick={() => handleResetPassword(u)} title="Reset Password" className="hover:text-orange-500"><i className="ti ti-key text-sm" /></button>
                      <button onClick={() => handleDelete(u)} title="ลบ" className="hover:text-red-500"><i className="ti ti-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <UserModal user={editingUser} onClose={() => { setShowModal(false); setEditingUser(null) }} onSaved={handleSaved} />
      )}
    </div>
  )
}
