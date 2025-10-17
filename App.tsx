// App.tsx
import React from 'react';
import RootNavigator from '@navigation/RootNavigator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setGeocodingKey } from '@services/geoService';
import { GOOGLE_MAPS_GEOCODING_KEY } from '@config/appConfig';
import { useResolvedTheme } from '@hooks/useResolvedTheme';
import { useInitTheme } from '@hooks/useInitTheme';
import { PaperProvider, ActivityIndicator } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';

if (GOOGLE_MAPS_GEOCODING_KEY?.length > 0) {
  setGeocodingKey(GOOGLE_MAPS_GEOCODING_KEY);
} else {
  console.warn('[geo] GOOGLE_MAPS_GEOCODING_KEY no está definida.');
}

const ThemedBackground: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { theme } = useResolvedTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {children}
    </View>
  );
};

const App = () => {
  const themeReady = useInitTheme();
  const { theme } = useResolvedTheme();

  if (!themeReady) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View
          style={[
            styles.root,
            { justifyContent: 'center', alignItems: 'center' },
          ]}
        >
          <ActivityIndicator animating size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <PaperProvider theme={theme}>
        <ThemedBackground>
          <RootNavigator />
        </ThemedBackground>
      </PaperProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
