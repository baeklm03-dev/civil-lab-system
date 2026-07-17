import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// แนบ JWT token ทุก request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// จัดการ 401 — redirect ไป login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// Work Orders
export const workorderAPI = {
  getAll: (params) => api.get('/workorders', { params }),
  getStats: (params) => api.get('/workorders/stats', { params }),
  getOne: (refNo) => api.get(`/workorders/${refNo}`),
  create: (data) => api.post('/workorders', data),
  updateStatus: (refNo, status) => api.patch(`/workorders/${refNo}/status`, { status }),
  createSheet: (refNo, extra) => api.post(`/workorders/${refNo}/create-sheet`, extra || {}),
  syncSheet: (refNo) => api.post(`/workorders/${refNo}/sync-sheet`),
  importFile: (formData) => api.post('/workorders/import-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importSheetLink: (payload) => api.post('/workorders/import-sheet-link', payload),
  getFinanceSummary: (refNo) => api.get(`/workorders/${refNo}/finance-summary`),
  updateCustomColumns: (refNo, custom_columns, custom_header_fields) =>
    api.patch(`/workorders/${refNo}/custom-columns`, { custom_columns, custom_header_fields }),
}

// Personnel
export const personnelAPI = {
  getAll: (params) => api.get('/personnel', { params }),
  create: (data) => api.post('/personnel', data),
  update: (id, data) => api.put(`/personnel/${id}`, data),
  toggleStatus: (id) => api.patch(`/personnel/${id}/status`),
}

// Reports
export const reportAPI = {
  generate: (data) => api.post('/reports/generate', data, { responseType: 'arraybuffer' }),
  generateFromHtml: (html, filename) => api.post('/reports/export-html', { html, filename }, { responseType: 'arraybuffer' }),
}

// Export
export const exportAPI = {
  dashboard: () => api.get('/export/dashboard', { responseType: 'arraybuffer', timeout: 60000 }),
  list: (params) => api.get('/export', { params, responseType: 'arraybuffer', timeout: 60000 }),
}

// Test Results
export const resultsAPI = {
  getAll: (params) => api.get('/results', { params }),
  create: (data) => api.post('/results', data),
  update: (id, data) => api.put(`/results/${id}`, data),
  remove: (id) => api.delete(`/results/${id}`),
}

// Announcements
export const announcementAPI = {
  getAll: (params) => api.get('/announcements', { params }),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  toggleStatus: (id, active) => api.patch(`/announcements/${id}/status`, { active }),
  remove: (id) => api.delete(`/announcements/${id}`),
}

// Admin — Users
export const adminUsersAPI = {
  getAll: () => api.get('/admin/users'),
  create: (data) => api.post('/admin/users', data),
  update: (id, data) => api.put(`/admin/users/${id}`, data),
  toggleStatus: (id, status) => api.patch(`/admin/users/${id}/status`, { status }),
  remove: (id) => api.delete(`/admin/users/${id}`),
  resetPassword: (id, newPassword) => api.post(`/admin/users/${id}/reset-password`, { newPassword }),
}

// Admin — Activity Log
export const adminLogsAPI = {
  getAll: (params) => api.get('/admin/logs', { params }),
  exportCsv: (params) => api.get('/admin/logs/export', { params, responseType: 'arraybuffer', timeout: 60000 }),
}

export default api
