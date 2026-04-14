import api from './axios'

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
}

export const ticketsApi = {
  list: (params) => api.get('/tickets', { params }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  update: (id, data) => api.patch(`/tickets/${id}`, data),
  addComment: (id, content) => api.post(`/tickets/${id}/comments`, { content }),
  startTime: (id) => api.post(`/tickets/${id}/time/start`),
  stopTime: (id, notes) => api.patch(`/tickets/${id}/time/stop`, { notes }),
}

export const machinesApi = {
  list: () => api.get('/machines'),
  create: (data) => api.post('/machines', data),
  update: (id, data) => api.patch(`/machines/${id}`, data),
}

export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  deactivate: (id) => api.delete(`/users/${id}`),
}

export const reportsApi = {
  get: (from, to) => api.get('/reports', { params: { from, to } }),
}
