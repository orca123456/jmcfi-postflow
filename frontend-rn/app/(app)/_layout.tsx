import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// All dashboard routes that exist in the app
const ALL_DASHBOARDS = [
  '/dashboard/requestor',
  '/dashboard/office-head',
  '/dashboard/vp',
  '/dashboard/imc-qa',
  '/dashboard/it-admin',
];

// Raw DB role -> the ONLY dashboard that role is allowed to open.
// Each role is locked to exactly ONE dashboard so URL manipulation
// (e.g. admin editing /dashboard/it-admin into /dashboard/vp) cannot
// navigate into another role's dashboard.
const ROLE_PATHS: Record<string, string[]> = {
  it_publisher: ['/dashboard/it-admin'],
  it_admin: ['/dashboard/it-admin'],
  office_head: ['/dashboard/office-head'],
  vice_president: ['/dashboard/vp'],
  imc_qa_checker: ['/dashboard/imc-qa'],
  content_requestor: ['/dashboard/requestor'],
  requestor: ['/dashboard/requestor'],
  // normalized fallbacks (roles[] is always present from the API, so these
  // only apply to malformed/stale sessions — default to the most restricted)
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

export default function AppLayout() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // NOTE: All hooks must run on every render (no early return before hooks),
  // otherwise React throws "Rendered fewer hooks than expected". Redirects
  // are done inside the effect via router.replace() (expo-router <Redirect>
  // does not fire from a layout).
  useEffect(() => {
    // Not logged in -> go to login
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    // Determine the user's role (raw DB role preferred, normalized role as fallback)
    const rawRole = ((user as any).roles && (user as any).roles[0]) || user.role || 'requestor';
    const allowed = ROLE_PATHS[rawRole] || ROLE_PATHS[user.role || ''] || ['/dashboard/requestor'];

    // Block URL manipulation: if the requested path is a dashboard the role
    // cannot access, send them to their own dashboard instead.
    if (ALL_DASHBOARDS.includes(pathname) && !allowed.includes(pathname)) {
      const home = ROLE_HOME[rawRole] || ROLE_HOME[user.role || ''] || '/dashboard/requestor';
      router.replace(home as any);
    }
  }, [pathname, user, router]);

  // While auth is still resolving, render nothing (avoids flashing the
  // protected stack before the redirect above fires).
  if (!user) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </QueryClientProvider>
  );
}
