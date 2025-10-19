import type { ReactionKey, ReactionMeta } from '@reactions/types';

// NOTA: el bundler de RN devuelve `number` para `require(...)`.
// Lottie acepta objeto/uri/number en tiempo de ejecución; tipeamos como `any`.
const like = require('@assets/lottie/reactions/like.json') as any;
const love = require('@assets/lottie/reactions/love.json') as any;
const happy = require('@assets/lottie/reactions/happy.json') as any;
const wow = require('@assets/lottie/reactions/wow.json') as any;
const sad = require('@assets/lottie/reactions/sad.json') as any;
const angry = require('@assets/lottie/reactions/angry.json') as any;
const match = require('@assets/lottie/reactions/match.json') as any;

export const REACTIONS: ReactionMeta[] = [
  { key: 'like', label: 'Me gusta', lottie: like },
  { key: 'love', label: 'Me encanta', lottie: love },
  { key: 'match', label: 'Match', lottie: match },
  { key: 'happy', label: 'Feliz', lottie: happy },
  { key: 'wow', label: 'Asombro', lottie: wow },
  { key: 'sad', label: 'Triste', lottie: sad },
  { key: 'angry', label: 'Molesta', lottie: angry },
];

/** Mantiene el orden global de REACTIONS pero filtra por keys dadas. */
export const pickReactions = (keys?: ReactionKey[] | null): ReactionMeta[] => {
  if (!keys || keys.length === 0) return REACTIONS.slice();
  const set = new Set<ReactionKey>(keys);
  return REACTIONS.filter(r => set.has(r.key));
};
