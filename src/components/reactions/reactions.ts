// Tipos + catálogo de reacciones (con Lottie)
export type ReactionKey =
  | 'like'
  | 'love'
  | 'happy'
  | 'wow'
  | 'sad'
  | 'angry'
  | 'match';

export type ReactionMeta = {
  key: ReactionKey;
  label: string;
  emoji: string; // fallback rápido (y para el resumen)
  tint: string; // colorcito del puntito
  lottie: any; // require('...json')
};

// ⚠️ Coloca estos JSON en tu proyecto (pueden ser placeholders al principio):
// assets/lottie/reactions/{like,love,happy,wow,sad,angry,match}.json
export const REACTIONS: ReactionMeta[] = [
  {
    key: 'like',
    label: 'Me gusta',
    emoji: '👍',
    tint: '#1877F2',
    lottie: require('@assets/lottie/reactions/like.json'),
  },
  {
    key: 'love',
    label: 'Me encanta',
    emoji: '❤️',
    tint: '#E53935',
    lottie: require('@assets/lottie/reactions/love.json'),
  },
  {
    key: 'happy',
    label: 'Me alegra',
    emoji: '😄',
    tint: '#FFC107',
    lottie: require('@assets/lottie/reactions/happy.json'),
  },
  {
    key: 'wow',
    label: 'Me asombra',
    emoji: '😮',
    tint: '#FF9800',
    lottie: require('@assets/lottie/reactions/wow.json'),
  },
  {
    key: 'sad',
    label: 'Me entristece',
    emoji: '😢',
    tint: '#64B5F6',
    lottie: require('@assets/lottie/reactions/sad.json'),
  },
  {
    key: 'angry',
    label: 'Me enoja',
    emoji: '😡',
    tint: '#F44336',
    lottie: require('@assets/lottie/reactions/angry.json'),
  },
  {
    key: 'match',
    label: '¡Match!',
    emoji: '🐾',
    tint: '#8E6DFD',
    lottie: require('@assets/lottie/reactions/match.json'),
  },
];

// Orden lógico de “popularidad”
export const REACTION_INDEX: Record<ReactionKey, number> = REACTIONS.reduce(
  (acc, r, i) => {
    acc[r.key] = i;
    return acc;
  },
  {} as Record<ReactionKey, number>,
);
