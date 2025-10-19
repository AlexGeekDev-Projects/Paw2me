export type ReactionKey =
  | 'like'
  | 'love'
  | 'happy'
  | 'wow'
  | 'sad'
  | 'angry'
  | 'match';

export type ReactionCounts = Partial<Record<ReactionKey, number>>;

export interface ReactionMeta {
  key: ReactionKey;
  label: string;
  /** Lottie source. RN typing no incluye `number` (require), usamos `any` para compatibilidad. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lottie: any;
}
