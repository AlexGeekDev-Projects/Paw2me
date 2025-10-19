import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, {
  Marker,
  type Region,
  type LatLng,
  type MapPressEvent,
  type UserLocationChangeEvent,
} from 'react-native-maps';
import { Button, Text } from 'react-native-paper';
import { reverseGeocode } from '@services/geoService';
import MapControls from './MapControls';
import type { CoordChange, LocationPickerProps } from './types';

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

const LocationPickerIOS: React.FC<LocationPickerProps> = ({
  value,
  onChange,
  height = 220,
}) => {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(
    value ? toRegion(value.lat, value.lng) : DEFAULT_REGION,
  );
  const [marker, setMarker] = useState<
    { lat: number; lng: number } | undefined
  >(value ? { lat: value.lat, lng: value.lng } : undefined);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const pendingLocate = useRef<((c: LatLng) => void | Promise<void>) | null>(
    null,
  );

  useEffect(() => {
    if (!value) return;
    const r = toRegion(value.lat, value.lng);
    setRegion(r);
    setMarker({ lat: value.lat, lng: value.lng });
    requestAnimationFrame(() => mapRef.current?.animateToRegion(r, 250));
  }, [value]);

  const applyChange = useCallback(
    async (lat: number, lng: number) => {
      setMarker({ lat, lng });
      setRegion(toRegion(lat, lng));
      try {
        const info = await reverseGeocode(lat, lng);
        const payload: CoordChange = {
          lat,
          lng,
          ...(info?.countryCode ? { countryCode: info.countryCode } : {}),
          ...(info?.city ? { city: info.city } : {}),
          ...(info?.formattedAddress ? { address: info.formattedAddress } : {}),
        };
        onChange(payload);
      } catch {
        onChange({ lat, lng });
      }
    },
    [onChange],
  );

  const onPressMap = useCallback(
    (e: MapPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      void applyChange(latitude, longitude);
    },
    [applyChange],
  );

  const onUserLocation = useCallback((e: UserLocationChangeEvent) => {
    const c = e.nativeEvent.coordinate;
    if (c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) {
      const coord = { latitude: c.latitude, longitude: c.longitude };
      setUserLoc(coord);
      const cb = pendingLocate.current;
      if (cb) {
        pendingLocate.current = null;
        void cb(coord);
      }
    }
  }, []);

  const zoomBy = useCallback(async (delta: number) => {
    const m = mapRef.current;
    if (!m) return;
    const cam = await m.getCamera();
    const nextZoom = Math.min(20, Math.max(0, (cam.zoom ?? 10) + delta));
    await m.animateCamera({ zoom: nextZoom }, { duration: 200 });
  }, []);

  const centerOnUser = useCallback(async () => {
    const m = mapRef.current;
    if (!m) return;

    const animateTo = async (c: LatLng) => {
      const cam = await m.getCamera();
      await m.animateCamera(
        { center: c, zoom: Math.max(cam.zoom ?? 14, 15) },
        { duration: 250 },
      );
    };

    if (userLoc) {
      await animateTo(userLoc);
      return;
    }

    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        pendingLocate.current = null;
        resolve();
      }, 3000);
      pendingLocate.current = async (c: LatLng) => {
        clearTimeout(timeout);
        await animateTo(c);
        resolve();
      };
    });
  }, [userLoc]);

  const provider = useMemo(() => undefined, []);

  return (
    <View>
      <View style={[styles.mapWrapper, { height }]}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={provider}
            initialRegion={region}
            onRegionChangeComplete={setRegion}
            onPress={onPressMap}
            showsUserLocation
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            rotateEnabled={false}
            pitchEnabled={false}
            onUserLocationChange={onUserLocation}
          >
            {marker ? (
              <Marker
                coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              />
            ) : null}
          </MapView>
        </View>

        <MapControls
          onZoomIn={() => void zoomBy(+1)}
          onZoomOut={() => void zoomBy(-1)}
          onLocate={() => void centerOnUser()}
        />
      </View>

      <View style={styles.actions}>
        <Text style={styles.caption}>
          {marker ? 'Ubicación seleccionada' : 'Toca el mapa para seleccionar'}
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
  mapWrapper: {
    position: 'relative',
    width: '100%',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e5ea',
    zIndex: 0,
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

export default LocationPickerIOS;
