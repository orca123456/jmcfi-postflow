import { useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { AuthTransitionContext } from '../../components/AuthTransitionContext';

export default function AuthLayout() {
  const { user } = useAuthStore();
  const [signInInProgress, setSignInInProgress] = useState(false);

  if (user && !signInInProgress) {
    return <Redirect href="/" />;
  }

  return (
    <AuthTransitionContext.Provider value={setSignInInProgress}>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthTransitionContext.Provider>
  );
}
