import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#5E8BFF',
    secondary: '#5CD6C0',
    tertiary: '#FFB86B',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceVariant: '#E7EEF8',
    onSurface: '#101319',
    outline: '#C4D0DF',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#7CA6FF',
    secondary: '#6FE7D0',
    tertiary: '#FFC380',
    background: '#0B0F14',
    surface: '#121822',
    surfaceVariant: '#1B2431',
    onSurface: '#E4F2FF',
    outline: '#3B4A60',
  },
};
