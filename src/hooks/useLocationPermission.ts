// src/hooks/useLocationPermission.ts
import { useCallback, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export type LocationPermissionState = {
  granted: boolean;
  request: () => Promise<boolean>;
};

export const useLocationPermission = (): LocationPermissionState => {
  const [granted, setGranted] = useState<boolean>(false);

  const request = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      const ok = res === PermissionsAndroid.RESULTS.GRANTED;
      setGranted(ok);
      return ok;
    } else {
      // iOS: el prompt real ocurre al pedir posición; marcamos true para permitir la llamada
      setGranted(true);
      return true;
    }
  }, []);

  return { granted, request };
};
