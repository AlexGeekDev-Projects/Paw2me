import { useCallback, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export type LocationPermissionState = {
  granted: boolean;
  request: () => Promise<boolean>;
};

export const useLocationPermission = (): LocationPermissionState => {
  const [granted, setGranted] = useState<boolean>(Platform.OS !== 'android');

  const request = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setGranted(true);
      return true;
    }
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    const ok = res === PermissionsAndroid.RESULTS.GRANTED;
    setGranted(ok);
    return ok;
  }, []);

  return { granted, request };
};
