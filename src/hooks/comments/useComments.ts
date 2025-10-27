// src/hooks/comments/useComments.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFirestore, type FirebaseFirestoreTypes } from '@services/firebase';
import type { CommentDoc, NewComment } from '@models/comment';

export function useComments(
  postId: string,
  uid: string | null,
  enabled: boolean = true,
): Readonly<{
  comments: Readonly<CommentDoc>[];
  loading: boolean;
  posting: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  add: (data: NewComment) => Promise<void>;
  edit: (id: string, content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}> {
  const [comments, setComments] = useState<Readonly<CommentDoc>[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [posting, setPosting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const db = getFirestore();
  const unsubRef = useRef<(() => void) | null>(null);

  const colRef = useMemo(() => {
    if (!postId) return null;
    return (db as FirebaseFirestoreTypes.Module)
      .collection('posts')
      .doc(postId)
      .collection('comments');
  }, [db, postId]);

  const mapDoc = useCallback(
    (
      d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
    ): CommentDoc => {
      const v = d.data() as Record<string, unknown>;
      const toMs = (x: unknown): number | null => {
        if (typeof x === 'number') return x;
        const ts = x as { toMillis?: () => number } | null | undefined;
        if (ts && typeof ts.toMillis === 'function') {
          try {
            return ts.toMillis();
          } catch {
            /* ignore */
          }
        }
        return null;
      };

      const createdAtMs = toMs(v['createdAt']) ?? Date.now();
      const updatedAtMs = v['updatedAt'] != null ? toMs(v['updatedAt']) : null;

      return {
        id: d.id,
        postId,
        authorUid: String(v['authorUid'] ?? ''),
        content: String(v['content'] ?? ''),
        createdAt: createdAtMs,
        ...(updatedAtMs != null ? { updatedAt: updatedAtMs } : {}),
        replyToId: (v['replyToId'] ?? null) as string | null,
        deleted: Boolean(v['deleted']),
      } as const;
    },
    [postId],
  );

  const subscribe = useCallback(() => {
    if (!enabled || !colRef) {
      setLoading(false);
      return () => {};
    }

    // Limpia suscripción previa
    unsubRef.current?.();

    const q = colRef.orderBy('createdAt', 'asc').limit(50);

    const unsubscribe = q.onSnapshot(
      (
        qs: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
      ) => {
        const list: Readonly<CommentDoc>[] = qs.docs.map(mapDoc);
        setComments(list);
        setLoading(false);
        setError(null);
      },
      (err: unknown) => {
        const msg =
          (err as { message?: string })?.message ??
          'Error al cargar comentarios';
        setError(msg);
        setLoading(false);
      },
    );

    unsubRef.current = unsubscribe;
    return unsubscribe;
  }, [colRef, enabled, mapDoc]);

  useEffect(() => {
    const u = subscribe();
    return () => u?.();
  }, [subscribe]);

  const refresh = useCallback(async () => {
    unsubRef.current?.();
    subscribe();
  }, [subscribe]);

  const add = useCallback(
    async (data: NewComment) => {
      if (!colRef || !uid) return;
      const content = String(data?.content ?? '').trim();
      if (!content) return;

      setPosting(true);
      try {
        await colRef.add({
          postId,
          authorUid: uid,
          content,
          createdAt: Date.now(),
          replyToId: data?.replyToId ?? null,
          deleted: false,
        } as Omit<CommentDoc, 'id' | 'updatedAt'>);
      } catch (e: unknown) {
        const msg =
          (e as { message?: string })?.message ??
          'No se pudo publicar el comentario';
        setError(msg);
      } finally {
        setPosting(false);
      }
    },
    [colRef, postId, uid],
  );

  const edit = useCallback(
    async (id: string, content: string) => {
      if (!colRef) return;
      await colRef.doc(id).update({
        content: String(content ?? '').trim(),
        updatedAt: Date.now(),
      } as Partial<CommentDoc>);
    },
    [colRef],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!colRef) return;
      await colRef.doc(id).update({
        deleted: true,
        updatedAt: Date.now(),
      } as Partial<CommentDoc>);
    },
    [colRef],
  );

  const loadMore = useCallback(async () => {
    // pendiente: paginación con startAfter(lastVisible)
    return;
  }, []);

  return {
    comments,
    loading,
    posting,
    error,
    loadMore,
    refresh,
    add,
    edit,
    remove,
  } as const;
}
