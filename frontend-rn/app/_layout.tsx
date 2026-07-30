import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/auth';
import { useFonts, Kameron_400Regular, Kameron_700Bold } from '@expo-google-fonts/kameron';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CustomAlertProvider } from '../components/CustomAlert';

export default function RootLayout() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  const [fontsLoaded, fontError] = useFonts({
    Kameron_400Regular,
    Kameron_700Bold,
    ...Ionicons.font,
  });

  useEffect(() => {
    loadFromStorage();
    
    // Hide default password reveal icon on Edge/IE to prevent overlapping with our custom icon
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.type = 'text/css';
      style.innerHTML = `
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
      `;
      document.head.appendChild(style);
    }
  }, [loadFromStorage]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <CustomAlertProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </CustomAlertProvider>
  );
}
