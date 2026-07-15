import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import MainLayout from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import WorkOrdersPage from './pages/WorkOrdersPage'
import WorkOrderDetailPage from './pages/WorkOrderDetailPage'
import PersonnelPage from './pages/PersonnelPage'
import RecordResultsPage from './pages/RecordResultsPage'
import PrintFormPage from './pages/PrintFormPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminLogsPage from './pages/admin/AdminLogsPage'
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <i className="ti ti-loader-2 animate-spin text-orange-400 text-2xl" />
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return !user ? children : <Navigate to="/dashboard" replace />
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user?.role) ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"  element={<DashboardPage />} />
            <Route path="workorders" element={<WorkOrdersPage />} />
            <Route path="workorders/:refNo" element={<WorkOrderDetailPage />} />
            <Route path="personnel"  element={<PersonnelPage />} />
            <Route path="record-results" element={<RecordResultsPage />} />
            <Route path="workorders/:refNo/print-form" element={<PrintFormPage />} />
            <Route path="admin/users" element={<RoleRoute roles={['superadmin']}><AdminUsersPage /></RoleRoute>} />
            <Route path="admin/logs" element={<RoleRoute roles={['superadmin']}><AdminLogsPage /></RoleRoute>} />
            <Route path="admin/announcements" element={<RoleRoute roles={['admin', 'superadmin']}><AdminAnnouncementsPage /></RoleRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
