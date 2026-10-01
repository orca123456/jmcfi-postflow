/**
 * usePrefetchAllTabs.ts
 *
 * Pre-fetches ALL dashboard tab data in parallel during the skeleton loading phase.
 * This ensures every tab is instantly available after the skeleton dismisses.
 *
 * How it works:
 * 1. Fires all API calls simultaneously the moment initial auth data loads
 * 2. Populates the React Query cache for every tab
 * 3. Combined with the persist cache, every tab is instant on F5 reloads
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  dashboardApi,
  postsApi,
  usersApi,
  departmentsApi,
  rolesApi,
  auditLogsApi,
  tokenSettingsApi,
  emailSettingsApi,
  categoriesApi,
} from '../services/api';

/**
 * Prefetch strategy per role:
 * - it_admin / it_publisher: prefetch users, departments, analytics, audit logs, token settings, email settings
 * - office_head: prefetch dashboard data (same as init)
 * - vice_president: prefetch dashboard data
 * - imc_qa_checker: prefetch dashboard data
 * - requestor / content_requestor: prefetch posts + categories
 */
export function usePrefetchAllTabs(role: string | undefined, isInitialLoading: boolean) {
  const queryClient = useQueryClient();
  const hasPrefetched = useRef(false);

  useEffect(() => {
    // Only run once, after the initial critical data has loaded
    if (isInitialLoading || !role || hasPrefetched.current) return;
    hasPrefetched.current = true;

    const prefetches: Promise<any>[] = [];

    // ── IT Admin / IT Publisher ──────────────────────────────────────────────
    if (role === 'it_admin' || role === 'it_publisher' || role === 'admin') {
      prefetches.push(
        // User Management tab
        queryClient.prefetchQuery({
          queryKey: ['users-prefetch'],
          queryFn: () => usersApi.list(),
          staleTime: 5 * 60 * 1000,
        }),
        // Departments
        queryClient.prefetchQuery({
          queryKey: ['departments-prefetch'],
          queryFn: () => departmentsApi.list(),
          staleTime: 5 * 60 * 1000,
        }),
        // Analytics tab
        queryClient.prefetchQuery({
          queryKey: ['analytics-overview', 'this_month'],
          queryFn: () => dashboardApi.getAnalyticsOverview({ period: 'this_month' }),
          staleTime: 5 * 60 * 1000,
        }),
        // Audit Logs tab
        queryClient.prefetchQuery({
          queryKey: ['audit-logs-prefetch'],
          queryFn: () => auditLogsApi.list({ per_page: 100 }),
          staleTime: 5 * 60 * 1000,
        }),
        // Token settings tab
        queryClient.prefetchQuery({
          queryKey: ['token-settings-prefetch'],
          queryFn: () => tokenSettingsApi.get(),
          staleTime: 5 * 60 * 1000,
        }),
        // Email settings tab
        queryClient.prefetchQuery({
          queryKey: ['email-settings-prefetch'],
          queryFn: () => emailSettingsApi.get(),
          staleTime: 5 * 60 * 1000,
        }),
        // All posts (for the All Posts tab)
        queryClient.prefetchQuery({
          queryKey: ['all-posts-prefetch'],
          queryFn: () => postsApi.list({ per_page: 15 }),
          staleTime: 5 * 60 * 1000,
        }),
      );
    }

    // ── Requestor / Content Requestor ────────────────────────────────────────
    if (role === 'requestor' || role === 'content_requestor') {
      prefetches.push(
        // Posts (with more data for other tabs)
        queryClient.prefetchQuery({
          queryKey: ['requestor-posts-all'],
          queryFn: () => postsApi.list({ per_page: 50 }),
          staleTime: 5 * 60 * 1000,
        }),
        // Categories (for new request form)
        queryClient.prefetchQuery({
          queryKey: ['categories-prefetch'],
          queryFn: () => categoriesApi.list(),
          staleTime: 10 * 60 * 1000,
        }),
      );
    }

    // ── Office Head ──────────────────────────────────────────────────────────
    if (role === 'office_head' || role === 'approver') {
      prefetches.push(
        queryClient.prefetchQuery({
          queryKey: ['oh-analytics'],
          queryFn: () => dashboardApi.getAnalyticsOverview({ period: 'this_month' }),
          staleTime: 5 * 60 * 1000,
        }),
      );
    }

    // ── VP ───────────────────────────────────────────────────────────────────
    if (role === 'vice_president') {
      prefetches.push(
        queryClient.prefetchQuery({
          queryKey: ['vp-analytics'],
          queryFn: () => dashboardApi.getAnalyticsOverview({ period: 'this_month' }),
          staleTime: 5 * 60 * 1000,
        }),
      );
    }

    // ── IMC QA ───────────────────────────────────────────────────────────────
    if (role === 'imc_qa_checker') {
      prefetches.push(
        queryClient.prefetchQuery({
          queryKey: ['imc-analytics'],
          queryFn: () => dashboardApi.getAnalyticsOverview({ period: 'this_month' }),
          staleTime: 5 * 60 * 1000,
        }),
      );
    }

    // Run all prefetches in parallel — fire and forget
    // The React Query cache (+ persister) will store these for instant access
    Promise.allSettled(prefetches).then(() => {
      console.log('[PostFlow] All tab data pre-fetched and cached ✅');
    });
  }, [isInitialLoading, role, queryClient]);
}
