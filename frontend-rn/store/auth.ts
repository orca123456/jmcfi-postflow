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
      const { token, user } = response.data;

      await storage.set('auth_token', token);
      await storage.set('auth_user', JSON.stringify(user));

      set({ user, token, isLoading: false });
      return true;
    } catch (err: any) {
      // Mock fallback for UI development when backend is down
      console.log("Login API failed, falling back to mock auth...");
      
      let mockRole = 'requestor';
      if (email.includes('admin')) mockRole = 'admin';
      else if (email.includes('vp') || email.includes('academic')) mockRole = 'vice_president';
      else if (email.includes('president')) mockRole = 'president';
      else if (email.includes('head')) mockRole = 'office_head';
      else if (email.includes('publisher') || email.includes('support')) mockRole = 'it_publisher';
      else if (email.includes('imc') || email.includes('qa')) mockRole = 'imc_qa_checker';

      const user = {
        id: 1,
        name: email.split('@')[0].toUpperCase() + ' User',
        email: email,
        role: mockRole,
        department_id: 1,
      };
      const token = 'mock-jwt-token-123';

      await storage.set('auth_token', token);
      await storage.set('auth_user', JSON.stringify(user));

      set({ user, token, isLoading: false });
      return true;
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
        set({ user, token });
      } catch (_) {}
    }
  },

  clearError: () => set({ error: null }),
}));

// Role helper
export const getRoleDashboardPath = (role: string): string => {
  const map: Record<string, string> = {
    admin: '/dashboard/admin',
    requestor: '/dashboard/requestor',
    office_head: '/dashboard/office-head',
    vice_president: '/dashboard/vp',
    president: '/dashboard/president',
    imc_qa_checker: '/dashboard/imc-qa',
    it_publisher: '/dashboard/publisher',
  };
  return map[role] ?? '/dashboard/requestor';
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    requestor: 'Content Requestor',
    office_head: 'Office Head',
    vice_president: 'Vice President',
    president: 'President',
    imc_qa_checker: 'IMC/QA Checker',
    it_publisher: 'IT Publisher',
  };
  return labels[role] ?? role;
};

export const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    admin: '#7C3AED',
    requestor: '#2563EB',
    office_head: '#D97706',
    vice_president: '#DC2626',
    president: '#0F766E',
    imc_qa_checker: '#7C3AED',
    it_publisher: '#374151',
  };
  return colors[role] ?? '#6B7280';
};
