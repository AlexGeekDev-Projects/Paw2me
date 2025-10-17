import {
  MD3LightTheme as LightBase,
  MD3DarkTheme as DarkBase,
  configureFonts,
  type MD3Theme,
} from 'react-native-paper';

const commonColors = {
  primary: '#50579e',
  secondary: '#7460a2',
  tertiary: '#8E8DAB',
  error: '#D32F2F',
  success: '#388E3C',
  warning: '#F9A825',
  info: '#1976D2',
  backgroundLight: '#FAFAFA',
  backgroundDark: '#121212',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#1E1E1E',
};

// Map completo de estilos según MD3
const fontConfig = {
  displayLarge: {
    fontFamily: 'Ubuntu-Bold',
    fontWeight: '700',
    fontSize: 57,
    lineHeight: 64,
    letterSpacing: -0.25,
  } as const,
  displayMedium: {
    fontFamily: 'Ubuntu-Bold',
    fontWeight: '700',
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: 0,
  } as const,
  displaySmall: {
    fontFamily: 'Ubuntu-Bold',
    fontWeight: '700',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0,
  } as const,
  headlineLarge: {
    fontFamily: 'Ubuntu-Bold',
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  } as const,
  headlineMedium: {
    fontFamily: 'Ubuntu-Bold',
    fontWeight: '700',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
  } as const,
  headlineSmall: {
    fontFamily: 'Ubuntu-Bold',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
  } as const,
  titleLarge: {
    fontFamily: 'Ubuntu-Regular',
    fontWeight: '400',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  } as const,
  titleMedium: {
    fontFamily: 'Ubuntu-Medium',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.1,
  } as const,
  titleSmall: {
    fontFamily: 'Ubuntu-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  } as const,
  labelLarge: {
    fontFamily: 'Ubuntu-Medium',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  } as const,
  labelMedium: {
    fontFamily: 'Ubuntu-Medium',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  } as const,
  labelSmall: {
    fontFamily: 'Ubuntu-Medium',
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
  } as const,
  bodyLarge: {
    fontFamily: 'Ubuntu-Regular',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  } as const,
  bodyMedium: {
    fontFamily: 'Ubuntu-Regular',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  } as const,
  bodySmall: {
    fontFamily: 'Ubuntu-Regular',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  } as const,
};

export const LightTheme: MD3Theme = {
  ...LightBase,
  dark: false,
  colors: {
    ...LightBase.colors,
    primary: commonColors.primary,
    secondary: commonColors.secondary,
    tertiary: commonColors.tertiary,
    background: commonColors.backgroundLight,
    surface: commonColors.surfaceLight,
    error: commonColors.error,
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#000000',
    onBackground: '#000000',
    onError: '#FFFFFF',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const DarkTheme: MD3Theme = {
  ...DarkBase,
  dark: true,
  colors: {
    ...DarkBase.colors,
    primary: commonColors.primary,
    secondary: commonColors.secondary,
    tertiary: commonColors.tertiary,
    background: commonColors.backgroundDark,
    surface: commonColors.surfaceDark,
    error: commonColors.error,
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#FFFFFF',
    onBackground: '#FFFFFF',
    onError: '#000000',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export const paperTheme = LightTheme;
