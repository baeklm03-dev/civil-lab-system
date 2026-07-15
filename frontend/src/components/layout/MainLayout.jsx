import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ToastProvider } from '../../hooks/useToast'

export default function MainLayout() {
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </ToastProvider>
  )
}
