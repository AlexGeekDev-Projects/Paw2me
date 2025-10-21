// src/hooks/usePostReactions.ts
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  listenPostReactionCounts,
  listenPostUserReaction,
  setPostUserReaction,
  type ReactionKey,
  type ReactionCountsDoc,
} from '@services/postsReactionsService';

export function usePostReactions(postId: string, userId: string | null) {
  const [counts, setCounts] = useState<ReactionCountsDoc | null>(null);
  const [current, setCurrent] = useState<ReactionKey | null>(null);

  useEffect(() => listenPostReactionCounts(postId, setCounts), [postId]);

  useEffect(() => {
    if (!userId) return;
    return listenPostUserReaction(postId, userId, setCurrent);
  }, [postId, userId]);

  const react = useCallback(
    async (next: ReactionKey | null) => {
      if (!userId) return;
      await setPostUserReaction({ postId, userId, next });
    },
    [postId, userId],
  );

  // normaliza para ReactionFooter (puede esperar undefined)
  const safeCounts = useMemo(
    () => ({
      like: counts?.like ?? 0,
      love: counts?.love ?? 0,
      happy: counts?.happy ?? 0,
      sad: counts?.sad ?? 0,
      wow: counts?.wow ?? 0,
      angry: counts?.angry ?? 0,
    }),
    [counts],
  );

  return { counts: safeCounts, current, react };
}
