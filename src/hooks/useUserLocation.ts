import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
import { reverseGeocode } from '@services/geoService';
import { useLocationPermission } from './useLocationPermission';

export const useUserLocation = () => {
  const { setCenter, setCity } = useExploreFiltersStore();
  const { granted, request } = useLocationPermission();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const locateMe = useCallback(async () => {
    setError(undefined);
    setLocating(true);
    try {
      // 1) Permisos (Android aquí; iOS mostrará el prompt al pedir posición)
      const ok = await request();
      if (!ok) {
        setLocating(false);
        setError('Permiso de ubicación no concedido.');
        return null;
      }

      // 2) iOS: algunas versiones exponen requestAuthorization pero sus types no aceptan args
      if (
        Platform.OS === 'ios' &&
        typeof Geolocation.requestAuthorization === 'function'
      ) {
        try {
          // Llamada sin argumento para cumplir con los types
          (Geolocation.requestAuthorization as () => void)();
        } catch {
          // no bloquea
        }
      }

      // 3) Obtener coordenadas
      const pos = await new Promise<{ lat: number; lng: number }>(
        (resolve, reject) => {
          Geolocation.getCurrentPosition(
            p => {
              const lat = p?.coords?.latitude;
              const lng = p?.coords?.longitude;
              if (typeof lat === 'number' && typeof lng === 'number')
                resolve({ lat, lng });
              else reject(new Error('Respuesta de geolocalización inválida'));
            },
            e => reject(e),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
          );
        },
      );

      // 4) Guardar en store + reverse geocode (no bloqueante)
      setCenter({ lat: pos.lat, lng: pos.lng });
      try {
        const info = await reverseGeocode(pos.lat, pos.lng);
        if (info?.city) setCity(info.city);
      } catch {}

      setLocating(false);
      return pos;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setLocating(false);
      return null;
    }
  }, [request, setCenter, setCity]);

  return { granted, locating, error, locateMe };
};
