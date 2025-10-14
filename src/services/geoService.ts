// src/services/geoService.ts
import Config from 'react-native-config';

export type GeoInfo = {
  formattedAddress?: string;
  countryCode?: string; // ISO-3166-1 alpha-2 (MX, US, ...)
  city?: string;
};

let GEOCODING_KEY: string | undefined;

export const initGeocoder = (key: string) => {
  GEOCODING_KEY = key;
};

type GoogleComp = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleResult = {
  formatted_address: string;
  address_components: GoogleComp[];
};

const extract = (res: GoogleResult): GeoInfo => {
  const comps = res.address_components ?? [];
  const cc = comps.find(c => c.types.includes('country'))?.short_name;
  const locality =
    comps.find(c => c.types.includes('locality'))?.long_name ||
    comps.find(c => c.types.includes('sublocality'))?.long_name ||
    comps.find(c => c.types.includes('administrative_area_level_2'))?.long_name;

  const info: GeoInfo = {};
  if (res.formatted_address) info.formattedAddress = res.formatted_address;
  if (cc) info.countryCode = cc;
  if (locality) info.city = locality;
  return info;
};

export const reverseGeocode = async (
  lat: number,
  lng: number,
): Promise<GeoInfo | null> => {
  if (!GEOCODING_KEY) {
    console.warn('[geo] reverseGeocode: no hay GEOCODING_KEY inicializada');
    return null;
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}` +
    `&language=es&result_type=street_address|route|locality&key=${GEOCODING_KEY}`;

  try {
    const r = await fetch(url);
    const json: any = await r.json();

    const status: string = json?.status ?? 'UNKNOWN';
    if (status !== 'OK') {
      const em = json?.error_message;
      console.warn('[geo] Geocoding status:', status, em ? `| ${em}` : '');
      return null;
    }

    const first: GoogleResult | undefined = json.results?.[0];
    if (!first) {
      console.warn('[geo] Geocoding sin results');
      return null;
    }
    return extract(first);
  } catch (e) {
    console.warn('[geo] Geocoding fetch error:', e);
    return null;
  }
};

// Inicializa con .env si existe:
const KEY_FROM_ENV = (Config as Record<string, string | undefined>)[
  'GOOGLE_MAPS_GEOCODING_KEY'
];
if (KEY_FROM_ENV && KEY_FROM_ENV.length > 0) {
  GEOCODING_KEY = KEY_FROM_ENV;
}
