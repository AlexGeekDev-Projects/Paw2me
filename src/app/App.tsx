import React from 'react';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { PaperProvider, adaptNavigationTheme } from 'react-native-paper';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';
import AppNavigator from '@navigation/AppNavigator';
import { useThemeStore } from '@store/useThemeStore';
import { lightTheme, darkTheme } from '@theme/theme';

// Puentea colores para Navigation sin romper tipos MD3
const { LightTheme: PaperNavLight, DarkTheme: PaperNavDark } =
  adaptNavigationTheme({
    reactNavigationLight: NavLight,
    reactNavigationDark: NavDark,
  });

const App = () => {
  const isDark = useThemeStore(s => s.dark);
  const paper = isDark ? darkTheme : lightTheme;
  const nav = isDark ? PaperNavDark : PaperNavLight;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PaperProvider theme={paper}>
        <NavigationContainer theme={nav}>
          <AppNavigator />
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;
