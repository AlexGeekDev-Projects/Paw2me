import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeState = {
  mode: ThemeMode;
  dark: boolean;
  setMode: (mode: ThemeMode) => void;
};

const computeDark = (mode: ThemeMode): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return Appearance.getColorScheme() === 'dark';
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      dark: computeDark('system'),
      setMode: mode => set({ mode, dark: computeDark(mode) }),
    }),
    {
      name: 'paw2me-theme',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: s => ({ mode: s.mode }), // solo guardamos el modo; 'dark' se recalcula
    },
  ),
);
