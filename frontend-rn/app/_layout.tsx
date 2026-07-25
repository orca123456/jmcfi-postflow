import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth';
import { useFonts, Kameron_400Regular, Kameron_700Bold } from '@expo-google-fonts/kameron';

export default function RootLayout() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  const [fontsLoaded, fontError] = useFonts({
    Kameron_400Regular,
    Kameron_700Bold,
  });

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
