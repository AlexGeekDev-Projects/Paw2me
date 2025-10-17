export type CoordChange = {
  lat: number;
  lng: number;
  countryCode?: string;
  city?: string;
  address?: string;
};

export type LocationPickerProps = {
  value?: { lat: number; lng: number };
  onChange: (v: CoordChange) => void;
  height?: number;
};
