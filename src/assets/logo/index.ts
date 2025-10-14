import { Platform } from 'react-native';

// Selección de un PNG estable (resolución adecuada para UI auth)
const iosLogo = require('../logo/ios/120ppi/Mesa de trabajo 1iPhone@2x.png');
const androidLogo = require('../logo/android/96ppi/Mesa de trabajo 1Xhdpi.png');

export const appLogo = Platform.OS === 'ios' ? iosLogo : androidLogo;
