import { create } from 'zustand';
import { Platform } from 'react-native';

interface ThemeStore {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const initialDarkMode = Platform.OS === 'web'
    ? localStorage.getItem('dark_mode') === 'true'
    : false;

  return {
    isDarkMode: initialDarkMode,
    toggleDarkMode: () => set((state) => {
      const nextMode = !state.isDarkMode;
      if (Platform.OS === 'web') {
        localStorage.setItem('dark_mode', String(nextMode));
      }
      return { isDarkMode: nextMode };
    }),
  };
});
