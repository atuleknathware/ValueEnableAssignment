import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bi_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on 401 to prevent stale session loops
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('bi_auth_token');
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

// Illustration APIs
export const illustrationAPI = {
  calculate: (params) => api.post('/illustrations/calculate', params),
  save: (data) => api.post('/illustrations/save', data),
  getHistory: (page = 1, limit = 10) => api.get(`/illustrations?page=${page}&limit=${limit}`),
  getById: (id) => api.get(`/illustrations/${id}`),
  exportCSVUrl: (id) => `/api/illustrations/${id}/export`,
  bulkUpload: (formData) =>
    api.post('/illustrations/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getBulkJobStatus: (id) => api.get(`/illustrations/bulk-jobs/${id}`),
};

export default api;

