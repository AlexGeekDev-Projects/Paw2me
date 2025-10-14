// src/components/inputs/LocationPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import { Button, Text } from 'react-native-paper';
import { reverseGeocode } from '@services/geoService';

export type CoordChange = {
  lat: number;
  lng: number;
  countryCode?: string;
  city?: string;
  address?: string;
};

type Props = {
  value?: { lat: number; lng: number };
  onChange: (v: CoordChange) => void;
  height?: number;
};

const DEFAULT_REGION: Region = {
  latitude: 19.432608,
  longitude: -99.133209,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const toRegion = (lat: number, lng: number): Region => ({
  latitude: lat,
  longitude: lng,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
});

const LocationPicker: React.FC<Props> = ({ value, onChange, height = 220 }) => {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(
    value ? toRegion(value.lat, value.lng) : DEFAULT_REGION,
  );
  const [marker, setMarker] = useState<
    { lat: number; lng: number } | undefined
  >(value ? { lat: value.lat, lng: value.lng } : undefined);

  useEffect(() => {
    if (!value) return;
    const r = toRegion(value.lat, value.lng);
    setRegion(r);
    setMarker({ lat: value.lat, lng: value.lng });
    requestAnimationFrame(() => mapRef.current?.animateToRegion(r, 250));
  }, [value]);

  const provider = useMemo(
    () => (Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined),
    [],
  );

  const applyChange = async (lat: number, lng: number) => {
    setMarker({ lat, lng });
    setRegion(toRegion(lat, lng));
    try {
      const info = await reverseGeocode(lat, lng);
      onChange({
        lat,
        lng,
        ...(info?.countryCode ? { countryCode: info.countryCode } : {}),
        ...(info?.city ? { city: info.city } : {}),
        ...(info?.formattedAddress ? { address: info.formattedAddress } : {}),
      });
    } catch {
      onChange({ lat, lng });
    }
  };

  // iOS: usamos onPress del mapa (funciona bien)
  const handleMapPressIOS = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    applyChange(latitude, longitude);
  };

  // ANDROID: overlay que convierte (x,y) -> (lat,lng)
  const handleOverlayReleaseAndroid = async (e: any) => {
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    if (!mapRef.current || x == null || y == null) return;
    try {
      const { latitude, longitude } = await mapRef.current.coordinateForPoint({
        x,
        y,
      });
      // Log que DEBE verse en Android si el overlay captura el gesto:
      // console.log('[MAP overlay]', x, y, '->', latitude, longitude);
      applyChange(latitude, longitude);
    } catch {
      // en casos raros coordinateForPoint puede fallar si el mapa no está listo
    }
  };

  return (
    <View>
      {/* Importante: NO radius/overflow en MapView; si quieres bordes, hazlo aquí */}
      <View style={[styles.mapContainer, { height }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={provider}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
          // iOS: onPress normal
          {...(Platform.OS === 'ios' ? { onPress: handleMapPressIOS } : {})}
          collapsable={false}
          toolbarEnabled={false}
          liteMode={false}
          moveOnMarkerPress={false}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {marker && (
            <Marker
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            />
          )}
        </MapView>

        {Platform.OS === 'android' ? (
          // Overlay transparente que captura taps en Android
          <View
            style={StyleSheet.absoluteFill}
            // Un tap simple:
            onStartShouldSetResponder={() => true}
            onResponderRelease={handleOverlayReleaseAndroid}
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Text style={styles.caption}>
          {marker
            ? 'Ubicación seleccionada'
            : 'Toca o mantén pulsado para seleccionar'}
        </Text>
        <Button
          mode="outlined"
          onPress={() => {
            setMarker(undefined);
            requestAnimationFrame(() =>
              mapRef.current?.animateToRegion(DEFAULT_REGION, 200),
            );
          }}
          style={styles.clearBtn}
        >
          Limpiar
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden', // el clip aquí es seguro
    backgroundColor: '#e5e5ea',
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caption: { opacity: 0.7 },
  clearBtn: { borderRadius: 20 },
});

export default LocationPicker;
