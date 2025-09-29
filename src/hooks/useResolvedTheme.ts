import { useColorScheme } from 'react-native';
import { useThemeStore } from '@store/useThemeStore';

export const useResolvedTheme = () => {
  const scheme = useColorScheme(); // 'light' | 'dark' | null
  const { mode, isDark } = useThemeStore();
  if (mode === 'system')
    return (scheme ?? 'light') === 'dark' ? 'dark' : 'light';
  return isDark ? 'dark' : 'light';
};
