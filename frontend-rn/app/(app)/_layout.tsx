import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function AppLayout() {
  const { user } = useAuthStore();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
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
