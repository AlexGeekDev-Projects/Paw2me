// src/services/geoService.ts
import { GOOGLE_MAPS_GEOCODING_KEY } from '@config/appConfig';

export type GeoInfo = {
  formattedAddress?: string;
  countryCode?: string;
  city?: string;
};

let GEOCODING_KEY: string = (GOOGLE_MAPS_GEOCODING_KEY || '').trim();

export const setGeocodingKey = (key: string) => {
  GEOCODING_KEY = (key || '').trim();
};

type GoogleComp = { long_name: string; short_name: string; types: string[] };
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
    `&language=es&region=mx&result_type=street_address|route|locality&key=${GEOCODING_KEY}`;

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
    if (!first) return null;
    return extract(first);
  } catch (e) {
    console.warn('[geo] Geocoding fetch error:', e);
    return null;
  }
};
