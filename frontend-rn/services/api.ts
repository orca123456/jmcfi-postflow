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

const API_BASE_URL = Platform.OS === 'web' && process.env.NODE_ENV === 'production' 
  ? '/api' 
  : (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 60000,
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
  updateProfile: (data: object) => api.put('/auth/profile', data),
  changePassword: (current_password: string, new_password: string, new_password_confirmation: string) =>
    api.put('/auth/password', { current_password, new_password, new_password_confirmation }),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post('/auth/profile-photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removePhoto: () => api.delete('/auth/profile-photo'),
};

// ── Posts endpoints ────────────────────────────────────────────────────────
export const postsApi = {
  list: (params?: object) => api.get('/posts', { params }),
  create: (data: object) => api.post('/posts', data),
  createWithFiles: (formData: FormData) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateWithFiles: (id: number, formData: FormData) => {
    formData.append('_method', 'PUT');
    return api.post(`/posts/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: (id: number) => api.get(`/posts/${id}`),
  update: (id: number, data: object) => api.put(`/posts/${id}`, data),
  delete: (id: number) => api.delete(`/posts/${id}`),
  submit: (id: number) => api.post(`/posts/${id}/submit`),
  approve: (id: number, data: object) => api.post(`/posts/${id}/approve`, data),
  reject: (id: number, data: object) => api.post(`/posts/${id}/reject`, data),
  returnRevision: (id: number, data: object) => api.post(`/posts/${id}/return-revision`, data),
  aiCheck: (id: number) => api.post(`/posts/${id}/ai-check`),
};

// ── Categories endpoints ───────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories'),
};

// ── Dashboard endpoints ────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/posts/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
  getAnalyticsOverview: () => api.get('/dashboard/analytics'),
};

// ── Publishing endpoints ───────────────────────────────────────────────────
export const publishingApi = {
  list: () => api.get('/publishing'),
  schedule: (id: number, data: object) => api.post(`/publishing/${id}/schedule`, data),
  publish: (id: number) => api.post(`/publishing/${id}/publish`),
  cancel: (id: number) => api.post(`/publishing/${id}/cancel`),
};

// ── Policy Settings endpoints ──────────────────────────────────────────────
export const policyApi = {
  get: () => api.get('/policy-settings'),
  update: (data: object) => api.post('/policy-settings', data),
};

// ── Users endpoints ────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: object) => api.post('/users', data),
  update: (id: string | number, data: object) => api.put(`/users/${id}`, data),
  delete: (id: string | number) => api.delete(`/users/${id}`),
};

// ── Departments endpoints ───────────────────────────────────────────────────
export const departmentsApi = {
  list: () => api.get('/departments'),
  create: (data: { name: string; display_name: string; description?: string }) =>
    api.post('/departments', data),
  update: (id: number, data: object) => api.put(`/departments/${id}`, data),
  delete: (id: number) => api.delete(`/departments/${id}`),
  uploadLogo: (id: number, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return api.post(`/departments/${id}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeLogo: (id: number) => api.delete(`/departments/${id}/logo`),
};

// ── Roles management endpoints ──────────────────────────────────────────────
export const rolesApi = {
  list: () => api.get('/roles/list'),
  create: (data: { name: string; display_name: string; description?: string }) =>
    api.post('/roles/list', data),
  delete: (id: number | string) => api.delete(`/roles/list/${id}`),
};

// ── Audit Logs endpoints ────────────────────────────────────────────────────
export const auditLogsApi = {
  list: (params?: object) => api.get('/audit-logs', { params }),
};

// ── Token Settings endpoints ────────────────────────────────────────────────
export const tokenSettingsApi = {
  get: () => api.get('/token-settings'),
  update: (data: object) => api.post('/token-settings', data),
};

export default api;
