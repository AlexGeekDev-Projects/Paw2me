import type { Option } from '@components/inputs/SelectDialog';
export const catBreeds: readonly Option[] = [
  { value: 'mestizo', label: 'Mestizo' },
  { value: 'siames', label: 'Siamés' },
  { value: 'persa', label: 'Persa' },
  { value: 'maine_coon', label: 'Maine Coon' },
  { value: 'bengali', label: 'Bengalí' },
] as const;
