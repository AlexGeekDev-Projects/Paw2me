import type { Option } from '@components/inputs/SelectDialog';
export const dogBreeds: readonly Option[] = [
  { value: 'mestizo', label: 'Mestizo' },
  { value: 'labrador', label: 'Labrador' },
  { value: 'pastor_aleman', label: 'Pastor Alemán' },
  { value: 'chihuahua', label: 'Chihuahua' },
  { value: 'pitbull', label: 'Pitbull' },
] as const;
