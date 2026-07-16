import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logo from '../../logo.png'

const navItems = [
  { to: '/dashboard',      icon: 'ti-layout-dashboard', label: 'ภาพรวมระบบ' },
  { to: '/workorders',     icon: 'ti-file-text',        label: 'ใบงานทดสอบ' },
  { to: '/personnel',      icon: 'ti-users',            label: 'จัดการบุคลากร' },
]

const settingsItems = [
  { to: '/admin/users',         icon: 'ti-user-cog',   label: 'จัดการผู้ใช้งาน',   roles: ['superadmin'] },
  { to: '/admin/logs',          icon: 'ti-history',     label: 'ประวัติการใช้งาน',  roles: ['superadmin'] },
  { to: '/admin/announcements', icon: 'ti-speakerphone', label: 'จัดการข้อความแจ้ง', roles: ['admin', 'superadmin'] },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'US'

  const visibleSettingsItems = settingsItems.filter((item) => item.roles.includes(user?.role))

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100 flex items-center gap-3">
        <img src={logo} alt="logo" className="w-9 h-9 object-contain shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-800 leading-tight">ระบบทดสอบวัสดุ</p>
          <p className="text-xs text-gray-400">มจพ. พระนครเหนือ</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-orange-50 text-orange-400 border-r-2 border-orange-400 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`
            }
          >
            <i className={`ti ${icon} text-base`} aria-hidden="true" />
            {label}
          </NavLink>
        ))}

        {visibleSettingsItems.length > 0 && (
          <>
            <p className="px-4 pt-4 pb-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">ตั้งค่า</p>
            {visibleSettingsItems.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-orange-50 text-orange-400 border-r-2 border-orange-400 font-medium'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`
                }
              >
                <i className={`ti ${icon} text-base`} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer / User */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-400 text-xs font-medium flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">{user?.name || 'ผู้ใช้งาน'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.role || 'user'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            title="ออกจากระบบ"
          >
            <i className="ti ti-logout text-base" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}
