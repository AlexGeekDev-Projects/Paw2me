import { useThemeStore } from '@store/useThemeStore';
import { DarkTheme, LightTheme } from '@theme/paperTheme';

export const useResolvedTheme = () => {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return {
    theme: isDark ? DarkTheme : LightTheme,
    isDark,
    setTheme,
    toggleTheme,
  };
};
