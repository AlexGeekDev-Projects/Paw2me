import type { OptionKV } from '@models/meta';

export const citiesMX: readonly OptionKV[] = [
  { value: 'CDMX', label: 'Ciudad de México' },
  { value: 'GDL', label: 'Guadalajara' },
  { value: 'MTY', label: 'Monterrey' },
  { value: 'PUE', label: 'Puebla' },
  { value: 'QRO', label: 'Querétaro' },
  { value: 'TOL', label: 'Toluca' },
  { value: 'TJU', label: 'Tijuana' },
  { value: 'LEO', label: 'León' },
  { value: 'MER', label: 'Mérida' },
  { value: 'CUN', label: 'Cancún' },
] as const;
