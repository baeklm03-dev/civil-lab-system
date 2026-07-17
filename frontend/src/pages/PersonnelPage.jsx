import { useEffect, useState } from 'react'
import { personnelAPI } from '../services/api'
import Loader from '../components/ui/Loader'

const ROLES = [
  { value: 'tester', label: 'ผู้ทดสอบ' },
  { value: 'professor', label: 'อาจารย์/ผู้ตรวจ' },
]

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
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

function PersonnelForm({ initial, onSubmit, onClose, saving }) {
  const [form, setForm] = useState({
    fullname_th: initial?.fullname_th || '',
    fullname_en: initial?.fullname_en || '',
    role: initial?.role || 'tester',
    active: initial ? String(initial.active) === 'true' : true,
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ ...form, active: String(form.active) })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500">ชื่อ-นามสกุล (ภาษาไทย) *</label>
          <input
            required value={form.fullname_th} onChange={set('fullname_th')}
            placeholder="เช่น นายสมชาย ใจดี"
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500">ชื่อ-นามสกุล (ภาษาอังกฤษ)</label>
          <input
            value={form.fullname_en} onChange={set('fullname_en')}
            placeholder="เช่น Mr. Somchai Jaidee"
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-500">บทบาท *</label>
          <select
            value={form.role} onChange={set('role')}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50"
          >
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        {initial && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">สถานะการใช้งาน</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
        <button type="button" onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          ยกเลิก
        </button>
        <button type="submit" disabled={saving}
          className="text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2">
          <i className="ti ti-device-floppy" />
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  )
}

function PersonnelTable({ list, onEdit, onToggle }) {
  if (list.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        <i className="ti ti-users text-3xl block mb-2 text-gray-200" />
        ยังไม่มีข้อมูล
      </div>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 w-10">#</th>
          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">ชื่อ-นามสกุล (TH)</th>
          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">ชื่อ-นามสกุล (EN)</th>
          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">สถานะ</th>
          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Actions</th>
        </tr>
      </thead>
      <tbody>
        {list.map((p, i) => (
          <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td className="py-3 px-4 text-gray-400 text-xs">{i + 1}</td>
            <td className="py-3 px-4 text-gray-800 font-medium">{p.fullname_th}</td>
            <td className="py-3 px-4 text-gray-500">{p.fullname_en || '—'}</td>
            <td className="py-3 px-4 text-center">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                String(p.active) === 'true'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {String(p.active) === 'true' ? 'ใช้งาน' : 'ปิดใช้งาน'}
              </span>
            </td>
            <td className="py-3 px-4 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => onEdit(p)}
                  className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-50 rounded-lg transition-colors" title="แก้ไข">
                  <i className="ti ti-pencil text-sm" />
                </button>
                <button onClick={() => onToggle(p)}
                  className={`p-1.5 rounded-lg transition-colors text-sm ${
                    String(p.active) === 'true'
                      ? 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  }`}
                  title={String(p.active) === 'true' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                >
                  <i className={`ti ${String(p.active) === 'true' ? 'ti-toggle-right' : 'ti-toggle-left'}`} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function PersonnelPage() {
  const [activeTab, setActiveTab] = useState('tester')
  const [personnel, setPersonnel] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    personnelAPI.getAll()
      .then(({ data }) => setPersonnel(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = personnel.filter((p) => p.role === activeTab)

  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editing) {
        await personnelAPI.update(editing.id, form)
      } else {
        await personnelAPI.create(form)
      }
      load()
      setShowModal(false)
      setEditing(null)
    } catch {
      alert('บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (person) => {
    try {
      await personnelAPI.toggleStatus(person.id)
      load()
    } catch {
      alert('เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  const handleEdit = (person) => {
    setEditing(person)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditing(null)
    setShowModal(false)
    setTimeout(() => setShowModal(true), 0)
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-medium text-gray-800">จัดการบุคลากร</h1>
          <p className="text-xs text-gray-400 mt-0.5">ผู้ทดสอบและอาจารย์/ผู้ตรวจ สำหรับลงนามในรายงาน</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors"
        >
          <i className="ti ti-plus text-sm" /> เพิ่มบุคลากร
        </button>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => setActiveTab(r.value)}
                className={`px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === r.value
                    ? 'border-orange-400 text-orange-500'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {r.label}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === r.value ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {personnel.filter((p) => p.role === r.value).length}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <Loader />
          ) : (
            <PersonnelTable list={filtered} onEdit={handleEdit} onToggle={handleToggle} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal
          title={editing ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มบุคลากรใหม่'}
          onClose={() => { setShowModal(false); setEditing(null) }}
        >
          <PersonnelForm
            initial={editing}
            onSubmit={handleSave}
            onClose={() => { setShowModal(false); setEditing(null) }}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  )
}
