import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// For web, use localStorage fallback since SecureStore is native-only
const getToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('auth_token');
  }
  return SecureStore.getItemAsync('auth_token');
};

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

// Attach Bearer token to every request
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — clear storage and redirect
      if (Platform.OS === 'web') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth endpoints ─────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getUser: () => api.get('/auth/user'),
};

// ── Posts endpoints ────────────────────────────────────────────────────────
export const postsApi = {
  list: (params?: object) => api.get('/posts', { params }),
  create: (data: object) => api.post('/posts', data),
  get: (id: number) => api.get(`/posts/${id}`),
  update: (id: number, data: object) => api.put(`/posts/${id}`, data),
  delete: (id: number) => api.delete(`/posts/${id}`),
  submit: (id: number) => api.post(`/posts/${id}/submit`),
  approve: (id: number, data: object) => api.post(`/posts/${id}/approve`, data),
  reject: (id: number, data: object) => api.post(`/posts/${id}/reject`, data),
  returnRevision: (id: number, data: object) => api.post(`/posts/${id}/return-revision`, data),
  aiCheck: (id: number) => api.post(`/posts/${id}/ai-check`),
};

// ── Dashboard endpoints ────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
};

// ── Publishing endpoints ───────────────────────────────────────────────────
export const publishingApi = {
  list: () => api.get('/publishing'),
  schedule: (id: number, data: object) => api.post(`/publishing/${id}/schedule`, data),
  publish: (id: number) => api.post(`/publishing/${id}/publish`),
  cancel: (id: number) => api.post(`/publishing/${id}/cancel`),
};

export default api;
