// src/store/useThemeStore.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  init: () => Promise<void>;
}

const THEME_KEY = 'app_theme';

export const useThemeStore = create<ThemeState>(set => ({
  theme: 'light',

  setTheme: mode => {
    AsyncStorage.setItem(THEME_KEY, mode);
    set({ theme: mode });
  },

  toggleTheme: () => {
    set(state => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_KEY, next);
      return { theme: next };
    });
  },

  init: async () => {
    const saved = await AsyncStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      set({ theme: saved });
    }
  },
}));
