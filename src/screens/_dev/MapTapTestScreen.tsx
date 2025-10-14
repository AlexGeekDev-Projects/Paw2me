import React, { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { MapPressEvent } from 'react-native-maps';

const INITIAL_REGION = {
  latitude: 19.432608,
  longitude: -99.133209,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const MapTapTestScreen: React.FC = () => {
  const mapRef = useRef<MapView | null>(null);
  const [pt, setPt] = useState<{ lat: number; lng: number } | null>(null);

  const onPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    console.log('[TEST] onPress', latitude, longitude);
    setPt({ lat: latitude, lng: longitude });
  };

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={ref => {
          mapRef.current = ref;
        }}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onPress={onPress}
      >
        {pt ? (
          <Marker coordinate={{ latitude: pt.lat, longitude: pt.lng }} />
        ) : null}
      </MapView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});

export default MapTapTestScreen;
