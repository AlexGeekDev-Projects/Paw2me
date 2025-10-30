// src/hooks/useAnimalComments.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { CommentDoc } from '@models/comment';
import {
  listAnimalComments,
  listenAnimalCommentsHead,
  addAnimalComment,
  editAnimalComment,
  deleteAnimalComment,
} from '@services/animalCommentsService';

type Options = Readonly<{
  limit?: number;
  onFirstLoad?: () => void;
  enabled?: boolean;
}>;

export function useAnimalComments(
  animalId: string,
  userId: string | null,
  opts?: Options,
) {
  const enabled = opts?.enabled !== false;
  const [items, setItems] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mantén onFirstLoad estable
  const onFirstLoadRef = useRef<Options['onFirstLoad']>(opts?.onFirstLoad);
  useEffect(() => {
    onFirstLoadRef.current = opts?.onFirstLoad;
  }, [opts?.onFirstLoad]);

  // Bootstrap (últimos N en asc)
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const page = await listAnimalComments(animalId, {
          limit: opts?.limit ?? 50,
        });
        if (!alive) return;
        setItems(page.items);
      } catch (e) {
        if (__DEV__) console.warn('[useAnimalComments] bootstrap', e);
        if (alive) setError('No fue posible cargar comentarios.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [animalId, opts?.limit, enabled]);

  // Realtime (asc). No dependas del objeto opts completo.
  useEffect(() => {
    if (!enabled) return;
    const off = listenAnimalCommentsHead(animalId, {
      onChange: arr => {
        setItems(arr);
        setLoading(false);
        onFirstLoadRef.current?.();
        onFirstLoadRef.current = undefined;
      },
    });
    return off;
  }, [animalId, enabled]);

  const add = useCallback(
    async (content: string) => {
      if (!userId) throw new Error('Debe iniciar sesión para comentar.');
      const text = content.trim();
      if (!text) return;
      // optimista
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
    (commentId: string, content: string) =>
      editAnimalComment(animalId, commentId, content),
    [animalId],
  );
  const remove = useCallback(
    (commentId: string) => deleteAnimalComment(animalId, commentId),
    [animalId],
  );

  return { items, loading, sending, error, add, edit, remove };
}
