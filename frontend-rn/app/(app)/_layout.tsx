import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays "fresh" for 10 minutes
      staleTime: 10 * 60 * 1000,
      // Keep data in memory + persisted storage for 24 hours (survives F5)
      gcTime: 24 * 60 * 60 * 1000,
      // Don't refetch on window focus — served from persist cache
      refetchOnWindowFocus: false,
      // Retry once on failure
      retry: 1,
    },
  },
});

// Persists the ENTIRE React Query cache to localStorage safely.
// On F5: all tab data loads at 0ms from storage. Background sync updates stale data.
const persister = createSyncStoragePersister({
  storage: Platform.OS === 'web' && typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'postflow-rq-v1',
  throttleTime: 1000,
  serialize: (data) => {
    try {
      return JSON.stringify(data);
    } catch (e) {
      return '';
    }
  },
  deserialize: (str) => {
    try {
      return str ? JSON.parse(str) : undefined;
    } catch (e) {
      return undefined;
    }
  },
});

// All dashboard routes that exist in the app
const ALL_DASHBOARDS = [
  '/dashboard/requestor',
  '/dashboard/office-head',
  '/dashboard/vp',
  '/dashboard/imc-qa',
  '/dashboard/it-admin',
];

// Raw DB role -> the ONLY dashboard that role is allowed to open.
const ROLE_PATHS: Record<string, string[]> = {
  it_publisher: ['/dashboard/it-admin'],
  it_admin: ['/dashboard/it-admin'],
  office_head: ['/dashboard/office-head'],
  vice_president: ['/dashboard/vp'],
  imc_qa_checker: ['/dashboard/imc-qa'],
  content_requestor: ['/dashboard/requestor'],
  requestor: ['/dashboard/requestor'],
  admin: ['/dashboard/it-admin'],
  approver: ['/dashboard/requestor'],
};

// Raw role -> the dashboard the role is redirected to when unauthorized
const ROLE_HOME: Record<string, string> = {
  it_publisher: '/dashboard/it-admin',
  it_admin: '/dashboard/it-admin',
  office_head: '/dashboard/office-head',
  vice_president: '/dashboard/vp',
  imc_qa_checker: '/dashboard/imc-qa',
  content_requestor: '/dashboard/requestor',
  requestor: '/dashboard/requestor',
  admin: '/dashboard/it-admin',
  approver: '/dashboard/office-head',
};

const resolveRawRole = (user: any): string => {
  const rawRole = (user?.roles && user.roles[0]) || user?.role || 'requestor';
  const department = (user?.department || '').toLowerCase();

  if (rawRole === 'office_head' && department.includes('vice president')) {
    return 'vice_president';
  }

  if (rawRole === 'office_head' && department.includes('institutional marketing communication')) {
    return 'imc_qa_checker';
  }

  return rawRole;
};

export default function AppLayout() {
  const { user, isInitialized } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Don't make routing decisions until auth storage initialization has finished
    if (!isInitialized) return;

    // Not logged in -> go to login
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    // Determine the user's role
    const rawRole = resolveRawRole(user);
    const allowed = ROLE_PATHS[rawRole] || ROLE_PATHS[user.role || ''] || ['/dashboard/requestor'];

    // Block URL manipulation
    if (ALL_DASHBOARDS.includes(pathname) && !allowed.includes(pathname)) {
      const home = ROLE_HOME[rawRole] || ROLE_HOME[user.role || ''] || '/dashboard/requestor';
      router.replace(home as any);
    }
  }, [pathname, user, isInitialized, router]);

  // While auth is still loading from storage or not logged in, render null (HTML shell will show)
  if (!isInitialized || !user) {
    return null;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // Cache survives for 24 hours across F5 reloads
        maxAge: 24 * 60 * 60 * 1000,
        // Cache key version — bump this to invalidate all persisted data
        buster: 'postflow-v1',
      }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </PersistQueryClientProvider>
  );
}
