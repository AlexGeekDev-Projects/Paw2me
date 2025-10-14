// App.tsx
import React from 'react';
import RootNavigator from '@navigation/RootNavigator';
import Config from 'react-native-config';
import { initGeocoder } from '@services/geoService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const GEOCODING_KEY = (Config as Record<string, string | undefined>)[
  'GOOGLE_MAPS_GEOCODING_KEY'
];
if (GEOCODING_KEY && GEOCODING_KEY.length > 0) {
  initGeocoder(GEOCODING_KEY);
} else {
  console.warn(
    '[geo] GOOGLE_MAPS_GEOCODING_KEY no está definida. No habrá reverse geocoding.',
  );
}

const App = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <RootNavigator />
  </GestureHandlerRootView>
);

export default App;
