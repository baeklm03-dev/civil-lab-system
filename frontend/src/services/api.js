import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
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
  getStats: () => api.get('/workorders/stats'),
  getOne: (refNo) => api.get(`/workorders/${refNo}`),
  create: (data) => api.post('/workorders', data),
  updateStatus: (refNo, status) => api.patch(`/workorders/${refNo}/status`, { status }),
  saveResult: (refNo, data) => api.patch(`/workorders/${refNo}/result`, data),
  createSheet: (refNo, extra) => api.post(`/workorders/${refNo}/create-sheet`, extra || {}),
  syncSheet: (refNo) => api.post(`/workorders/${refNo}/sync-sheet`),
  importOrders: (workOrders) => api.post('/workorders/import', { workOrders }),
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
}

// Export
export const exportAPI = {
  dashboard: () => api.get('/export/dashboard', { responseType: 'arraybuffer', timeout: 60000 }),
}

export default api
