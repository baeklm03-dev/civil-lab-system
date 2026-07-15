import { useEffect, useState } from 'react'
import Modal from '../../components/ui/Modal'
import { announcementAPI } from '../../services/api'
import { useToast } from '../../hooks/useToast'

function AnnouncementModal({ announcement, onClose, onSaved }) {
  const isEdit = !!announcement
  const [label, setLabel] = useState(announcement?.label || '')
  const [content, setContent] = useState(announcement?.content || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!label.trim() || !content.trim()) { setError('กรุณากรอกหัวข้อและเนื้อหา'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await announcementAPI.update(announcement.announcementId, { label, content })
      } else {
        await announcementAPI.create({ label, content })
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'แก้ไขข้อความแจ้ง' : 'เพิ่มข้อความแจ้ง'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Label (หัวข้อ)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">เนื้อหา</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50 resize-none" />
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

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const { showToast } = useToast()

  const fetchItems = () => {
    setLoading(true)
    announcementAPI.getAll({ activeOnly: 'false' })
      .then(({ data }) => setItems(data.data || []))
      .catch(() => showToast('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchItems() }, [])

  const handleSaved = () => { setShowModal(false); setEditing(null); showToast('บันทึกสำเร็จ ✓'); fetchItems() }

  const handleToggle = async (a) => {
    try {
      await announcementAPI.toggleStatus(a.announcementId, a.active !== 'true')
      fetchItems()
    } catch {
      showToast('เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  const handleDelete = async (a) => {
    if (!confirm(`ยืนยันลบ "${a.label}"?`)) return
    try {
      await announcementAPI.remove(a.announcementId)
      showToast('ลบสำเร็จ ✓')
      fetchItems()
    } catch {
      showToast('ลบไม่สำเร็จ')
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-medium text-gray-800">จัดการข้อความแจ้ง</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors">
          <i className="ti ti-plus text-sm" /> เพิ่มข้อความ
        </button>
      </div>

      <div className="p-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ชื่อ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">เนื้อหา</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">สถานะ</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400 text-sm"><i className="ti ti-loader-2 animate-spin mr-2" />กำลังโหลด...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400 text-sm">ยังไม่มีข้อความแจ้ง</td></tr>
              ) : items.map((a) => (
                <tr key={a.announcementId} className="hover:bg-orange-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-medium">{a.label}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-md truncate">{a.content}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(a)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.active === 'true' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {a.active === 'true' ? '🟢 ใช้งาน' : '🔴 ระงับ'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-gray-400">
                      <button onClick={() => { setEditing(a); setShowModal(true) }} title="แก้ไข" className="hover:text-orange-500"><i className="ti ti-edit text-sm" /></button>
                      <button onClick={() => handleDelete(a)} title="ลบ" className="hover:text-red-500"><i className="ti ti-trash text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AnnouncementModal announcement={editing} onClose={() => { setShowModal(false); setEditing(null) }} onSaved={handleSaved} />
      )}
    </div>
  )
}
