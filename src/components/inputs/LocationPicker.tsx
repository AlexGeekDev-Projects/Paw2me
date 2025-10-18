// src/components/inputs/LocationPicker.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  Animated,
  Easing,
  Vibration,
  type GestureResponderEvent,
} from 'react-native';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import {
  Button,
  Text,
  ActivityIndicator,
  Card,
  IconButton,
  useTheme,
} from 'react-native-paper';
import { reverseGeocode } from '@services/geoService';

export type CoordChange = {
  lat: number;
  lng: number;
  countryCode?: string;
  city?: string;
  address?: string;
};

type Props = Readonly<{
  headTitle?: string | undefined;
  value?: { lat: number; lng: number } | undefined;
  onChange: (v: CoordChange) => void;
  height?: number | undefined;
  onUseMyLocation?: (() => void | Promise<void>) | undefined;
  locating?: boolean | undefined;
}>;

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

// ——— HAPTICS (opcional, sin dependencia dura) ———
type HapticTrigger = (type?: string) => void;
const makeHaptics = (): HapticTrigger => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Haptic = require('react-native-haptic-feedback');
    const trigger: HapticTrigger = (type = 'impactMedium') => {
      try {
        Haptic?.default?.trigger?.(type, {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      } catch {
        Vibration.vibrate(10);
      }
    };
    return trigger;
  } catch {
    return () => Vibration.vibrate(8);
  }
};

const LocationPicker: React.FC<Props> = ({
  headTitle = 'Ubicación (obligatoria)',
  value,
  onChange,
  height = 220,
  onUseMyLocation,
  locating = false,
}) => {
  const theme = useTheme();
  const round = Math.max(
    12,
    (theme as any)?.roundness ? (theme as any).roundness * 3 : 16,
  );
  const haptic = useRef<HapticTrigger>(makeHaptics()).current;

  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(
    value ? toRegion(value.lat, value.lng) : DEFAULT_REGION,
  );
  const [marker, setMarker] = useState<
    { lat: number; lng: number } | undefined
  >(value ? { lat: value.lat, lng: value.lng } : undefined);

  // Animación “drop + bounce” del pin
  const pinDrop = useRef(new Animated.Value(0)).current; // translateY
  const runPinDrop = () => {
    pinDrop.setValue(-18);
    Animated.sequence([
      Animated.timing(pinDrop, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pinDrop, {
        toValue: -5,
        duration: 110,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pinDrop, {
        toValue: 0,
        duration: 110,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

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
    haptic('impactLight');
    runPinDrop();

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

  const handleMapPressIOS = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    void applyChange(latitude, longitude);
  };

  const handleOverlayReleaseAndroid = async (e: any) => {
    const x = e.nativeEvent.locationX;
    const y = e.nativeEvent.locationY;
    if (!mapRef.current || x == null || y == null) return;
    try {
      const { latitude, longitude } = await mapRef.current.coordinateForPoint({
        x,
        y,
      });
      await applyChange(latitude, longitude);
    } catch {
      // puede fallar si el mapa no está listo
    }
  };

  const caption = marker
    ? 'Ubicación seleccionada'
    : 'Toca o mantén pulsado para seleccionar';

  return (
    <View>
      {/* Encabezado: título (línea 1) + leyenda (línea 2) */}
      <View style={styles.headerBlock}>
        <Text variant="titleSmall" style={styles.headerTitle}>
          {headTitle}
        </Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>

      {/* Contenedor elevado MD3 para el mapa */}
      <Card
        mode="elevated"
        style={[styles.card, { borderRadius: round }]}
        elevation={2}
      >
        <View
          style={[
            styles.mapContainer,
            {
              height,
              borderRadius: round,
              backgroundColor: theme.colors.surfaceVariant,
            },
          ]}
        >
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={provider}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
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
              >
                {/* Pin rojo custom con animación */}
                <Animated.View style={{ transform: [{ translateY: pinDrop }] }}>
                  <View
                    style={[
                      styles.pinHead,
                      { backgroundColor: '#E53935' /* rojo visible */ },
                    ]}
                  >
                    <View
                      style={[styles.pinDot, { backgroundColor: '#FFFFFF' }]}
                    />
                  </View>
                  <View
                    style={[styles.pinTail, { backgroundColor: '#E53935' }]}
                  />
                </Animated.View>
              </Marker>
            )}
          </MapView>

          {Platform.OS === 'android' ? (
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => true}
              onResponderRelease={handleOverlayReleaseAndroid}
            />
          ) : null}

          {/* Overlay superior: solo mini botón tonal (sin texto de dirección) */}
          <View style={styles.mapOverlays}>
            <View style={styles.overlayRow}>
              <View />
              <IconButton
                mode="contained-tonal"
                icon="crosshairs-gps"
                size={22}
                disabled={locating || !onUseMyLocation}
                onPress={(_e: GestureResponderEvent) => {
                  void onUseMyLocation?.();
                }}
                accessibilityLabel="Usar mi ubicación"
                style={styles.fabMini}
              />
            </View>
          </View>
        </View>
      </Card>

      {/* Acciones bajo el mapa: izquierda “Usar mi ubicación”, derecha “Limpiar” */}
      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <Button
            mode="contained-tonal"
            icon="crosshairs-gps"
            onPress={(_e: GestureResponderEvent) => {
              void onUseMyLocation?.();
            }}
            disabled={locating}
            loading={locating}
            accessibilityLabel="Usar mi ubicación"
          >
            Usar mi ubicación
          </Button>
          {locating ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
        </View>

        <Button
          mode="outlined"
          onPress={(_e: GestureResponderEvent) => {
            setMarker(undefined);
            requestAnimationFrame(() =>
              mapRef.current?.animateToRegion(DEFAULT_REGION, 200),
            );
            onChange({ lat: 0, lng: 0 });
          }}
          style={styles.clearBtn}
          accessibilityLabel="Limpiar ubicación"
        >
          Limpiar
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerBlock: {
    marginBottom: 8,
  },
  headerTitle: { opacity: 0.9, marginBottom: 2, fontWeight: '600' },
  caption: { opacity: 0.7 },

  card: {
    overflow: 'hidden',
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  mapOverlays: {
    ...StyleSheet.absoluteFillObject,
    padding: 8,
  },
  overlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Pin rojo custom
  pinHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.9,
  },
  pinTail: {
    width: 10,
    height: 10,
    transform: [{ rotate: '45deg' }],
    marginTop: -2,
    borderRadius: 2,
    alignSelf: 'center',
  },

  // Actions
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  clearBtn: { borderRadius: 20 },

  fabMini: {
    borderRadius: 20,
  },
});

export default LocationPicker;
