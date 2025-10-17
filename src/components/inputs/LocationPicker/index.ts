import { Platform } from 'react-native';
import AndroidImpl from './LocationPicker.android';
import IOSImpl from './LocationPicker.ios';

const LocationPicker = Platform.select({
  android: AndroidImpl,
  ios: IOSImpl,
  default: IOSImpl,
}) as typeof IOSImpl;

export type { CoordChange, LocationPickerProps } from './types';
export default LocationPicker;
