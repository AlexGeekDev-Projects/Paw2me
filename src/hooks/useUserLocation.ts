// src/hooks/useUserLocation.ts
import { useCallback, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
// import { reverseGeocode } from '@services/geoService';  // ❌ ya no lo usamos aquí
import { useLocationPermission } from './useLocationPermission';

type LocateOptions = Readonly<{
  strategy?: 'balanced' | 'precise' | 'fast';
  highAccTimeoutMs?: number;
  lowAccTimeoutMs?: number;
  maxAgeMs?: number;
}>;

type LocalGeoOptions = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  forceRequestLocation?: boolean;
  showLocationDialog?: boolean;
};

const DEFAULTS: Required<Omit<LocateOptions, 'strategy'>> = {
  highAccTimeoutMs: 10000,
  lowAccTimeoutMs: 4000,
  maxAgeMs: 5 * 60 * 1000,
};

export const useUserLocation = () => {
  const { setCenter } = useExploreFiltersStore(); // 👈 solo center
  const { request } = useLocationPermission();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [failStreak, setFailStreak] = useState(0);
  const lastErrTypeRef = useRef<
    'permission' | 'timeout' | 'unavailable' | 'unknown' | null
  >(null);
  const inFlightRef = useRef<Promise<{
    lat: number;
    lng: number;
  } | null> | null>(null);

  const getOnce = (opts: LocalGeoOptions) =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        p => {
          const lat = p?.coords?.latitude;
          const lng = p?.coords?.longitude;
          if (typeof lat === 'number' && typeof lng === 'number')
            resolve({ lat, lng });
          else reject(new Error('Respuesta de geolocalización inválida'));
        },
        e => reject(e),
        opts,
      );
    });

  const locateMe = useCallback(
    async (
      options?: LocateOptions,
    ): Promise<{ lat: number; lng: number } | null> => {
      if (inFlightRef.current) return inFlightRef.current;

      setError(undefined);
      setLocating(true);

      const { strategy = 'balanced' } = options ?? {};
      const highAccTimeoutMs =
        options?.highAccTimeoutMs ?? DEFAULTS.highAccTimeoutMs;
      const lowAccTimeoutMs =
        options?.lowAccTimeoutMs ?? DEFAULTS.lowAccTimeoutMs;
      const maxAgeMs = options?.maxAgeMs ?? DEFAULTS.maxAgeMs;

      const run = async (): Promise<{ lat: number; lng: number } | null> => {
        try {
          const ok = await request();
          if (!ok) {
            setError('Permiso de ubicación no concedido.');
            lastErrTypeRef.current = 'permission';
            setFailStreak(s => s + 1);
            return null;
          }

          if (
            Platform.OS === 'ios' &&
            typeof Geolocation.requestAuthorization === 'function'
          ) {
            try {
              (Geolocation.requestAuthorization as unknown as () => void)();
            } catch {}
          }

          const onSuccess = async (pos: { lat: number; lng: number }) => {
            // ✅ solo center; no tocamos city
            setCenter(pos);
            setError(undefined);
            setFailStreak(0);
            lastErrTypeRef.current = null;
            return pos;
          };

          if (strategy === 'precise') {
            const pos = await getOnce({
              enableHighAccuracy: true,
              timeout: highAccTimeoutMs,
              maximumAge: 0,
            });
            return onSuccess(pos);
          }

          if (strategy === 'fast') {
            try {
              const pos = await getOnce({
                enableHighAccuracy: false,
                timeout: lowAccTimeoutMs,
                maximumAge: maxAgeMs,
              });
              return onSuccess(pos);
            } catch {
              const pos2 = await getOnce({
                enableHighAccuracy: true,
                timeout: lowAccTimeoutMs,
                maximumAge: maxAgeMs,
              });
              return onSuccess(pos2);
            }
          }

          try {
            const pos = await getOnce({
              enableHighAccuracy: true,
              timeout: highAccTimeoutMs,
              maximumAge: 0,
            });
            return onSuccess(pos);
          } catch (eHigh) {
            try {
              const pos2 = await getOnce({
                enableHighAccuracy: false,
                timeout: lowAccTimeoutMs,
                maximumAge: maxAgeMs,
              });
              return onSuccess(pos2);
            } catch (eLow) {
              const message =
                (eHigh as any)?.message ||
                (eLow as any)?.message ||
                'No se pudo obtener tu ubicación.';
              lastErrTypeRef.current = 'unknown';
              setError(message);
              setFailStreak(s => s + 1);
              return null;
            }
          }
        } catch (e: any) {
          lastErrTypeRef.current = 'unknown';
          setError(String(e?.message ?? e));
          setFailStreak(s => s + 1);
          return null;
        }
      };

      const p = run().finally(() => {
        setLocating(false);
        inFlightRef.current = null;
      });

      inFlightRef.current = p;
      return p;
    },
    [request, setCenter],
  );

  const shouldSuggestSettings =
    lastErrTypeRef.current === 'permission' || failStreak >= 2;
  const openAppSettings = () => {
    try {
      Linking.openSettings();
    } catch {}
  };

  return { locating, error, locateMe, shouldSuggestSettings, openAppSettings };
};
