import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// For web, use sessionStorage fallback since SecureStore is native-only
const getToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return sessionStorage.getItem('auth_token');
  }
  return SecureStore.getItemAsync('auth_token');
};

export const resolveImageUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
  const hostBase = base.replace(/\/api\/?$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (Platform.OS === 'web' && process.env.NODE_ENV === 'production') {
    return cleanPath;
  }

  return `${hostBase}${cleanPath}`;
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

// Attach Bearer token to every request.
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (Platform.OS === 'web') {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_user');
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
  createWithFiles: (formData: FormData, onUploadProgress?: (progressEvent: any) => void) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  updateWithFiles: (id: number, formData: FormData, onUploadProgress?: (progressEvent: any) => void) => {
    formData.append('_method', 'PUT');
    return api.post(`/posts/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
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
  aiCheckDraft: (data: object) => api.post(`/posts/ai-check-draft`, data),
  setFeaturedMedia: (id: number, mediaId: number) => api.post(`/posts/${id}/featured-media`, { media_id: mediaId }),
};


// ── Categories endpoints ───────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories'),
};

// ── Dashboard endpoints ────────────────────────────────────────────────────
export const dashboardApi = {
  getInitData: () => api.get('/dashboard/init'),
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
  getAnalyticsOverview: (params?: any) => api.get('/dashboard/analytics', { params }),
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
  bulkCreate: (data: { users: any[] }) => api.post('/users/bulk', data),
  update: (id: string | number, data: object) => api.put(`/users/${id}`, data),
  delete: (id: string | number, params?: any) => api.delete(`/users/${id}`, { params }),
};

// ── Departments endpoints ───────────────────────────────────────────────────
export const departmentsApi = {
  list: () => api.get('/departments'),
  // Bypass the 30s GET cache — used right after an add/delete so the UI shows
  // the freshly persisted department list without needing a page reload.
  listFresh: () => api.get('/departments'),
  create: (data: { name: string; display_name: string; description?: string; role_categories?: string[] }) =>
    api.post('/departments', data),
  update: (id: number, data: object) => api.put(`/departments/${id}`, data),
  delete: (id: number) => api.delete(`/departments/${id}`),
  // Role-scoped delete: detaches this department from the given role only.
  deleteFromRole: (id: number, roleCategory: string) =>
    api.delete(`/departments/${id}`, { params: { role_category: roleCategory } }),
  uploadLogo: (id: number, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return api.post(`/departments/${id}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeLogo: (id: number) => api.delete(`/departments/${id}/logo`),
};

// ── Chatbot endpoints ───────────────────────────────────────────────────────
export const chatbotApi = {
  sendMessage: (messages: { role: string; content: string }[]) =>
    api.post('/chatbot/message', { messages }),
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
let inFlightTokenSettingsPromise: Promise<any> | null = null;
let inFlightAiSettingsPromise: Promise<any> | null = null;

export const tokenSettingsApi = {
  getAI: () => {
    if (inFlightAiSettingsPromise) return inFlightAiSettingsPromise;
    inFlightAiSettingsPromise = api.get('/ai-settings').finally(() => {
      inFlightAiSettingsPromise = null;
    });
    return inFlightAiSettingsPromise;
  },
  updateAI: (data: { provider: string; model: string; api_key?: string }) => api.post('/ai-settings', data),
  clearAI: () => api.delete('/ai-settings'),
  get: () => {
    if (inFlightTokenSettingsPromise) return inFlightTokenSettingsPromise;
    inFlightTokenSettingsPromise = api.get('/token-settings').finally(() => {
      inFlightTokenSettingsPromise = null;
    });
    return inFlightTokenSettingsPromise;
  },
  update: (data: object) => api.post('/token-settings', data),
  validate: (data: object) => api.post('/token-settings/validate', data),
};

// ── Email Settings endpoints ────────────────────────────────────────────────
export const emailSettingsApi = {
  get: () => api.get('/email-settings'),
  update: (data: object) => api.post('/email-settings', data),
  test: (data?: object) => api.post('/email-settings/test', data || {}, { timeout: 15000 }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return api.post('/email-settings/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  removeLogo: () => api.delete('/email-settings/logo'),
};

// ── API Tokens endpoints (Developer API) ──────────────────────────────────
export const apiTokensApi = {
  list: () => api.get('/api-tokens', { cache: false } as any),
  create: (name: string) => api.post('/api-tokens', { name }),
  revoke: (tokenId: number) => api.delete(`/api-tokens/${tokenId}`),
};

// ── Notifications endpoints ────────────────────────────────────────────────
export const notificationsApi = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

export default api;
