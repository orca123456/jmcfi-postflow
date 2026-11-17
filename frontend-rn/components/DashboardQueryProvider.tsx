import { useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { AuthUser } from '../store/auth';

const DASHBOARD_KEYS = new Set([
  'adminInitData', 'requestor-posts', 'oh-dashboard-data',
  'vp-dashboard-data', 'imc-dashboard-data',
]);

function getSessionStorage() {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const storage = window.sessionStorage;
    const token = storage.getItem('auth_token');
    return {
      getItem: (key: string) => storage.getItem('auth_token') === token ? storage.getItem(key) : null,
      setItem: (key: string, value: string) => {
        // An old request finishing after logout must not recreate its cache.
        if (token && storage.getItem('auth_token') === token) storage.setItem(key, value);
      },
      removeItem: (key: string) => storage.removeItem(key),
    };
  } catch {
    return undefined;
  }
}

// Mounted separately for each authenticated session. Never persist credentials,
// settings, mutation results, or the Axios request/config attached to a response.
export function DashboardQueryProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15000,
        gcTime: 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: 'always',
        retry: 1,
      },
    },
  }));
  const [persister] = useState(() => createSyncStoragePersister({
    storage: getSessionStorage(),
    key: `postflow_query_v2_${user.id}`,
    throttleTime: 0,
    serialize: persisted => JSON.stringify({
      ...persisted,
      clientState: {
        ...persisted.clientState,
        queries: persisted.clientState.queries.map(query => ({
          ...query,
          state: {
            ...query.state,
            data: { data: (query.state.data as { data: unknown }).data },
          },
        })),
      },
    }),
  }));

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 5 * 60 * 1000,
        buster: JSON.stringify([user.id, user.roles, user.role, user.department, user.program_head_id]),
        dehydrateOptions: {
          shouldDehydrateQuery: query => query.state.status === 'success'
            && DASHBOARD_KEYS.has(String(query.queryKey[0]))
            && Date.now() - query.state.dataUpdatedAt < 5 * 60 * 1000,
          shouldDehydrateMutation: () => false,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
