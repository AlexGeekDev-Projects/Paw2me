// src/hooks/useAnimalComments.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CommentDoc } from '@models/comment';
import {
  listenAnimalCommentsAll,
  listAnimalComments,
  addAnimalComment,
  editAnimalComment,
  deleteAnimalComment,
} from '@services/animalCommentsService';

type Options = Readonly<{ limit?: number; onFirstLoad?: () => void }>;

export function useAnimalComments(
  animalId: string,
  userId: string | null,
  opts?: Options,
) {
  const [items, setItems] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const firstSnap = useRef(false);

  // Bootstrap (sin orderBy)
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const page = await listAnimalComments(animalId, {
          limit: opts?.limit ?? 50,
        });
        if (!alive) return;
        setItems(page.items);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId]);

  // RT: toda la colección, orden asc en cliente
  useEffect(() => {
    const off = listenAnimalCommentsAll(
      animalId,
      arr => {
        setItems(arr);
        if (!firstSnap.current) {
          firstSnap.current = true;
          setLoading(false);
          opts?.onFirstLoad?.();
        }
      },
      () => setLoading(false),
    );
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animalId]);

  const add = useCallback(
    async (content: string) => {
      if (!userId) throw new Error('Debe iniciar sesión para comentar.');
      const text = content.trim();
      if (!text) return;

      // Optimista
      const temp: CommentDoc = {
        id: `__opt_${Date.now()}`,
        postId: animalId,
        authorUid: userId,
        content: text,
        createdAt: Date.now(),
        updatedAt: null,
        replyToId: null,
        deleted: false,
      };
      setItems(prev => prev.concat(temp));

      setSending(true);
      try {
        await addAnimalComment(animalId, userId, { content: text });
      } finally {
        setSending(false);
      }
    },
    [animalId, userId],
  );

  const edit = useCallback(
    async (commentId: string, content: string) =>
      editAnimalComment(animalId, commentId, content),
    [animalId],
  );

  const remove = useCallback(
    async (commentId: string) => deleteAnimalComment(animalId, commentId),
    [animalId],
  );

  return { items, loading, sending, add, edit, remove };
}
