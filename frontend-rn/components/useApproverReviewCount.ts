import { useCallback, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';

type DashboardResult = { data: { stats?: { pending_review?: unknown; pending?: unknown } } };
const emptySnapshot = () => undefined;

/** Observe the dashboard's existing role-scoped request; never fetch a second queue. */
export function useApproverReviewCount(enabled: boolean) {
  const client = useQueryClient();
  const pathname = usePathname();
  const key = pathname.includes('/dashboard/vp') ? 'vp-dashboard-data'
    : pathname.includes('/dashboard/imc-qa') ? 'imc-dashboard-data' : 'oh-dashboard-data';
  const subscribe = useCallback((notify: () => void) => enabled
    ? client.getQueryCache().subscribe(event => { if (event.query.queryKey[0] === key) notify(); })
    : () => {}, [client, key, enabled]);
  const snapshot = useCallback(() => enabled ? client.getQueryState<DashboardResult>([key]) : undefined, [client, key, enabled]);
  const state = useSyncExternalStore(subscribe, snapshot, emptySnapshot);
  const value = state?.data?.data?.stats?.pending_review ?? state?.data?.data?.stats?.pending;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  const count = state?.status === 'success' && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  const unavailable = state?.status === 'error' || (state?.status === 'success' && count === null);
  return { count, unavailable, waiting: enabled && count === null && !unavailable };
}
