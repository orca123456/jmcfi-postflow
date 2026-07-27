import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearError: () => void;
}

// Cross-platform storage helpers
const storage = {
  set: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  get: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  remove: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
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
            'it_admin': 'it_publisher',
            'admin': 'it_publisher',
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
          'it_admin': 'it_publisher',
          'admin': 'it_publisher',
        };
        if (user.role) {
          user.role = roleMap[user.role] ?? user.role;
        }
        set({ user, token });
      } catch (_) {}
    }
  },

  clearError: () => set({ error: null }),
}));

// Role helper
export const getRoleDashboardPath = (role: string): string => {
  const map: Record<string, string> = {
    requestor: '/dashboard/requestor',
    office_head: '/dashboard/office-head',
    vice_president: '/dashboard/vp',
    imc_qa_checker: '/dashboard/imc-qa',
    it_publisher: '/dashboard/it-admin',
    admin: '/dashboard/it-admin',
  };
  return map[role] ?? '/dashboard/requestor';
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    requestor: 'Content Requestor',
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
    office_head: '#D97706',
    vice_president: '#DC2626',
    imc_qa_checker: '#7C3AED',
    it_publisher: '#0F172A',
  };
  return colors[role] ?? '#6B7280';
};
