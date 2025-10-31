// ⚠️ Visible en el bundle. Úsalo mientras terminamos la migración.
export const GOOGLE_MAPS_GEOCODING_KEY =
  'AIzaSyDTuP_zivti4MF6awpUBKOjWm_wyBmdYDU';

export const FIREBASE_STORAGE_BUCKET_URL = 'gs://paw-2me.appspot.com';

// src/config/appConfig.ts
export const listPerfConfig = {
  preferFlashList: true, // cambia a false si quieres forzar FlatList
  estimatedItemSize: 132 as const, // alto aprox. de cada ítem (para FlashList)
};
