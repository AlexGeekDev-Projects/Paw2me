// utils/media.ts
export const MIN_AR = 0.8; // 4:5
export const MAX_AR = 1.91; // 1.91:1

export function clampAspectRatio(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return 1; // fallback 1:1
  return Math.max(MIN_AR, Math.min(MAX_AR, r));
}
export function heightFromWidthAndAR(widthPx: number, ar: number): number {
  return Math.round(widthPx / ar);
}

const ratioCache = new Map<string, number>();

export async function getRemoteAspectRatio(
  url: string,
): Promise<number | undefined> {
  if (!url) return undefined;
  const cached = ratioCache.get(url);
  if (cached) return cached;

  const { Image } = require('react-native') as typeof import('react-native');
  return new Promise(resolve => {
    Image.getSize(
      url,
      (w, h) => {
        const r = w > 0 && h > 0 ? w / h : 1;
        ratioCache.set(url, r);
        resolve(r);
      },
      () => resolve(undefined),
    );
  });
}

export function extractFromChips(chips?: readonly string[] | null): {
  breed?: string;
  size?: string;
} {
  if (!Array.isArray(chips)) return {};
  const SIZE_WORDS = [
    'mini',
    'toy',
    'chico',
    'pequeño',
    'pequeña',
    'mediano',
    'mediana',
    'grande',
    'muy grande',
    'gigante',
    'small',
    'medium',
    'large',
    'xlarge',
  ];

  const clean = chips.map(s => s.trim()).filter(Boolean);
  const rawSize = clean.find(s => SIZE_WORDS.includes(s.toLowerCase()));
  const rawBreed = clean.find(s => !SIZE_WORDS.includes(s.toLowerCase()));

  const out: { breed?: string; size?: string } = {};
  if (rawBreed) out.breed = title(rawBreed)!; // setea la prop sólo si hay valor
  if (rawSize) out.size = title(rawSize)!;
  return out;
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}

export function title(s?: string): string | undefined {
  if (!s) return undefined;
  return s.replace(/\S+/g, w => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}
