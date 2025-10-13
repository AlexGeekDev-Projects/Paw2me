// App.tsx en la raíz (igual patrón que Radar4, pero apuntando a TU navigator)
import React from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavigationLight,
  DarkTheme as NavigationDark,
} from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { enableScreens } from 'react-native-screens';
import { getApp } from '@react-native-firebase/app';

import AppNavigator from '@navigation/AppNavigator'; // <-- usa tu navigator real
import { lightTheme, darkTheme } from '@theme/theme';
import { useThemeStore } from '@store/useThemeStore';

enableScreens();

export default function App() {
  const isDark = useThemeStore(state => state.dark);
  let projectId: string | undefined;
  try {
    projectId = getApp().options.projectId;
    console.log('[Firebase] iOS projectId =', projectId);
  } catch {
    console.log(
      '[Firebase] iOS: default app no inicializada (revisar GoogleService-Info.plist / Bundle ID)',
    );
  }

  return (
    <PaperProvider theme={isDark ? darkTheme : lightTheme}>
      <NavigationContainer theme={isDark ? NavigationDark : NavigationLight}>
        <AppNavigator />
      </NavigationContainer>
    </PaperProvider>
  );
}
