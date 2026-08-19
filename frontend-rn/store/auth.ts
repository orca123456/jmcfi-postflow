import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/api';

export interface AuthUser {
  id: number;
  name: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  photo_url?: string;
  department_logo_url?: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  lockUntil: number | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearError: () => void;
  setUser: (user: AuthUser) => Promise<void>;
  setLockUntil: (time: number | null) => void;
}

// Cross-platform storage helpers
const storage = {
  set: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      sessionStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return sessionStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  remove: async (key: string) => {
    if (Platform.OS === 'web') {
      sessionStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  lockUntil: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(email, password);
      let { token, user } = response.data;

      if (user) {
        if (user.roles && user.roles.length > 0) {
          // Normalize role names from DB to frontend expectations
          const roleMap: Record<string, string> = {
            'content_requestor': 'requestor',
            'it_admin': 'admin',
            'it_publisher': 'admin',
            'office_head': 'approver',
            'vice_president': 'approver',
            'imc_qa_checker': 'approver',
          };
          const rawRole = user.roles[0];
          user.role = roleMap[rawRole] ?? rawRole;
        } else if (!user.role) {
          user.role = 'requestor';
        }
        if (!user.name && user.first_name) {
          user.name = `${user.first_name} ${user.last_name}`;
        }
      }

      await storage.set('auth_token', token);
      await storage.set('auth_user', JSON.stringify(user));

      set({ user, token, isLoading: false });
      return true;
    } catch (err: any) {
      if (err.response?.status === 429 && err.response?.data?.retry_after) {
        const seconds = parseInt(err.response.data.retry_after, 10);
        set({
          error: err.response.data.message || `Too many login attempts. Please try again in ${seconds} seconds.`,
          isLoading: false,
          lockUntil: Date.now() + seconds * 1000
        });
        return false;
      }
      
      const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (_) {}
    await storage.remove('auth_token');
    await storage.remove('auth_user');
    set({ user: null, token: null });
  },

  loadFromStorage: async () => {
    const token = await storage.get('auth_token');
    const userStr = await storage.get('auth_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        // Normalize role names for backward compatibility with stored data
        const roleMap: Record<string, string> = {
          'content_requestor': 'requestor',
          'it_admin': 'admin',
          'it_publisher': 'admin',
          'office_head': 'approver',
          'vice_president': 'approver',
          'imc_qa_checker': 'approver',
        };
        if (user.role) {
          user.role = roleMap[user.role] ?? user.role;
        }
        set({ user, token });
      } catch (_) {}
    }
  },

  clearError: () => set({ error: null }),

  setUser: async (user: AuthUser) => {
    await storage.set('auth_user', JSON.stringify(user));
    set({ user });
  },

  setLockUntil: (time: number | null) => set({ lockUntil: time }),
}));

// Role helper
export const getRoleDashboardPath = (role: string): string => {
  const map: Record<string, string> = {
    requestor: '/dashboard/requestor',
    approver: '/dashboard/office-head',
    admin: '/dashboard/it-admin',
    // Legacy fallbacks
    office_head: '/dashboard/office-head',
    vice_president: '/dashboard/vp',
    imc_qa_checker: '/dashboard/imc-qa',
    it_publisher: '/dashboard/it-admin',
  };
  return map[role] ?? '/dashboard/requestor';
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    requestor: 'Requestor',
    approver: 'Approver',
    admin: 'Administrator',
    // Legacy
    office_head: 'Office Head',
    vice_president: 'Vice President',
    imc_qa_checker: 'IMC/QA Checker',
    it_publisher: 'IT Admin',
  };
  return labels[role] ?? role;
};

export const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    requestor: '#2563EB',
    approver: '#D97706',
    admin: '#0F172A',
    // Legacy
    office_head: '#D97706',
    vice_president: '#DC2626',
    imc_qa_checker: '#7C3AED',
    it_publisher: '#0F172A',
  };
  return colors[role] ?? '#6B7280';
};

export const getAvatarColors = (name: string): { bg: string, text: string } => {
  const palette = [
    { bg: '#E3F2FD', text: '#1565C0' }, // Light Blue
    { bg: '#F3E8FF', text: '#6B21A8' }, // Light Purple
    { bg: '#FFF3E0', text: '#E65100' }, // Light Orange
    { bg: '#E8F5E9', text: '#2E7D32' }, // Light Green
    { bg: '#FFEBEE', text: '#C62828' }, // Light Red
    { bg: '#FCE4EC', text: '#C2185B' }, // Light Pink
    { bg: '#E0F7FA', text: '#00838F' }, // Light Cyan
  ];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};
