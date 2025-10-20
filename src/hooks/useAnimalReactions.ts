// src/hooks/useAnimalReactions.ts
import { useCallback, useEffect, useState } from 'react';
import {
  listenReactionCounts,
  listenUserReaction,
  setUserReaction,
  type FireReactionKey,
  type ReactionCountsDoc,
} from '@services/reactionsService';

type Counts = Readonly<{ love: number; sad: number; match: number }>;

export function useAnimalReactions(
  animalId: string | null | undefined,
  userId: string | null | undefined,
) {
  const [counts, setCounts] = useState<Counts>({ love: 0, sad: 0, match: 0 });
  const [current, setCurrent] = useState<FireReactionKey | null>(null);
  const [readyCounts, setReadyCounts] = useState(false);
  const [readyCurrent, setReadyCurrent] = useState(false);

  useEffect(() => {
    if (!animalId) {
      setCounts({ love: 0, sad: 0, match: 0 });
      setReadyCounts(true);
      return;
    }
    const unsub = listenReactionCounts(
      animalId,
      (c: ReactionCountsDoc | null) => {
        setCounts({
          love: c?.love ?? 0,
          sad: c?.sad ?? 0,
          match: c?.match ?? 0,
        });
        setReadyCounts(true);
      },
    );
    return unsub;
  }, [animalId]);

  useEffect(() => {
    if (!animalId || !userId) {
      setCurrent(null);
      setReadyCurrent(true);
      return;
    }
    const unsub = listenUserReaction(animalId, userId, key => {
      setCurrent(key);
      setReadyCurrent(true);
    });
    return unsub;
  }, [animalId, userId]);

  const loading = !readyCounts || !readyCurrent;

  const react = useCallback(
    async (next: FireReactionKey | null) => {
      if (!animalId || !userId) return;
      await setUserReaction({ animalId, userId, next });
    },
    [animalId, userId],
  );

  return { counts, current, loading, react } as const;
}
