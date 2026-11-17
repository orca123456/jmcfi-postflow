import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { getRoleDashboardPath } from '../store/auth';

export default function Index() {
  const { user, isInitialized } = useAuthStore();

  if (!isInitialized) return null;

  if (user) {
    return <Redirect href={getRoleDashboardPath(user.role) as any} />;
  }

  return <Redirect href="/(auth)/login" />;
}
