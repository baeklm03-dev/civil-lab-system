import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import logo from '../logo.png'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username || !password) { setError('กรุณากรอกข้อมูลให้ครบ'); return }
    setLoading(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex w-full max-w-2xl shadow-sm">
        {/* Left */}
        <div className="flex-1 p-10 border-r border-gray-100 flex flex-col items-center justify-center gap-4">
          <img src={logo} alt="logo" className="w-24 h-24 object-contain" />
          <div className="text-center">
            <h2 className="font-medium text-gray-800">ระบบทดสอบวัสดุ</h2>
            <p className="text-xs text-gray-400 mt-0.5">มจพ. พระนครเหนือ</p>
          </div>
          <hr className="w-full border-gray-100" />
          <ul className="space-y-2 w-full">
            {[
              'จัดทำโครงการและกรอกผลทดสอบ',
              'ออกใบรับรองผลทดสอบ (Certificate)',
              'ออกใบเสร็จรับเงินอัตโนมัติ',
              'รองรับ คอนกรีต และ เหล็ก',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-500">
                <span className="text-orange-400">•</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Right */}
        <div className="flex-1 p-10 flex flex-col justify-center gap-5">
          <div className="text-center">
            <h1 className="text-xl font-medium text-gray-800">เข้าสู่ระบบ</h1>
            <p className="text-sm text-gray-400 mt-1">กรุณากรอกชื่อผู้ใช้และรหัสผ่านเพื่อดำเนินการต่อ</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">ชื่อผู้ใช้งาน</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-gray-700">รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-orange-400 bg-gray-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} text-base`} aria-hidden="true" />
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-orange-400 hover:bg-orange-500 disabled:opacity-60 text-white font-medium py-3 rounded-lg transition-colors text-sm mt-1"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
