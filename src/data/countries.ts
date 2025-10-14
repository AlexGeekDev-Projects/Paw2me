import type { OptionKV } from '@models/meta';

export const countries: readonly OptionKV[] = [
  { value: 'MX', label: 'México' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CO', label: 'Colombia' },
  { value: 'ES', label: 'España' },
] as const;
