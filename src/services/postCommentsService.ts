// src/services/postCommentsService.ts
import {
  getFirestore,
  doc,
  getDoc,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import type {
  CommentDoc,
  CommentsPage,
  NewComment,
  PostId,
} from '@models/comment';

type CommentFS = Readonly<{
  postId: string;
  authorUid: string;
  content: string;
  // Soportamos Timestamp (si lo tenías), FieldValue (si algún lugar lo mete) y number para máxima compat.
  createdAt:
    | FirebaseFirestoreTypes.Timestamp
    | FirebaseFirestoreTypes.FieldValue
    | number
    | null;
  updatedAt?:
    | FirebaseFirestoreTypes.Timestamp
    | FirebaseFirestoreTypes.FieldValue
    | number
    | null;
  replyToId?: string | null;
  deleted?: boolean;
}>;

const colRef = (
  postId: string,
): FirebaseFirestoreTypes.CollectionReference<CommentFS> =>
  // compat API
  getFirestore().collection(
    `posts/${postId}/comments`,
  ) as unknown as FirebaseFirestoreTypes.CollectionReference<CommentFS>;

const isTs = (v: unknown): v is FirebaseFirestoreTypes.Timestamp =>
  !!v && typeof v === 'object' && typeof (v as any).toMillis === 'function';

const numFrom = (
  v:
    | FirebaseFirestoreTypes.Timestamp
    | FirebaseFirestoreTypes.FieldValue
    | number
    | null
    | undefined,
): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (isTs(v)) return v.toMillis();
  // FieldValue (serverTimestamp placeholder) → usamos ahora mismo
  return Date.now();
};

const toDoc = (
  snap: FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>,
): CommentDoc => {
  const d = snap.data();
  return {
    id: snap.id,
    postId: d.postId,
    authorUid: d.authorUid,
    content: d.content,
    createdAt: numFrom(d.createdAt) ?? Date.now(),
    updatedAt: numFrom(d.updatedAt),
    replyToId: d.replyToId ?? null,
    deleted: !!d.deleted,
  };
};

/** Lista paginada (retorna ascendente para render natural) */
export async function listComments(
  postId: PostId,
  opts?: Readonly<{ limit?: number; after?: unknown | null }>,
): Promise<CommentsPage> {
  const L = Math.max(1, Math.min(50, opts?.limit ?? 20));
  const col = colRef(postId);

  let q = col.orderBy('createdAt', 'desc').limit(L);
  if (opts?.after) q = q.startAfter(opts.after as any);

  const ss = (await q.get()) as FirebaseFirestoreTypes.QuerySnapshot<CommentFS>;
  const docs =
    ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[];
  const itemsDesc = docs.map(toDoc);
  const nextCursor = docs.length === L ? docs[docs.length - 1] : null;

  return { items: itemsDesc.slice().reverse(), nextCursor };
}

/** Cabeza en tiempo real (últimos L) */
export function listenCommentsHead(
  postId: PostId,
  opts: Readonly<{
    onChange: (items: CommentDoc[]) => void;
    limit?: number;
  }>,
): () => void {
  const L = Math.max(1, Math.min(50, opts.limit ?? 20));
  const q = colRef(postId).orderBy('createdAt', 'desc').limit(L);

  const off = q.onSnapshot(
    (ss: FirebaseFirestoreTypes.QuerySnapshot<CommentFS>) => {
      const docs =
        ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[];
      const items = docs.map(toDoc).slice().reverse();
      opts.onChange(items);
    },
  );
  return off;
}

/** Crear comentario (compat) */
export async function addComment(
  postId: PostId,
  uid: string,
  data: NewComment,
): Promise<CommentDoc> {
  const col = colRef(postId);
  const ref = await col.add({
    postId,
    authorUid: uid,
    content: data.content.trim(),
    replyToId: data.replyToId ?? null,
    // evitamos serverTimestamp por falta de export → número
    createdAt: Date.now(),
    updatedAt: null,
    deleted: false,
  } as CommentFS);

  const snap =
    (await ref.get()) as FirebaseFirestoreTypes.DocumentSnapshot<CommentFS>;
  // normalizo a QueryDocumentSnapshot-like para reutilizar toDoc
  const asQuerySnap = {
    id: snap.id,
    ref: snap.ref,
    data: () => snap.data() as CommentFS,
  } as unknown as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>;

  return toDoc(asQuerySnap);
}

/** Editar */
export async function editComment(
  postId: PostId,
  commentId: string,
  content: string,
): Promise<void> {
  await colRef(postId)
    .doc(commentId)
    .update({
      content: content.trim(),
      updatedAt: Date.now(),
    } as Partial<CommentFS>);
}

/** Borrar duro */
export async function deleteComment(
  postId: PostId,
  commentId: string,
): Promise<void> {
  await colRef(postId).doc(commentId).delete();
}

/** (Opcional) contar comentarios (placeholder eficiente requiere agregaciones) */
export async function getCommentsCount(postId: PostId): Promise<number> {
  const col = colRef(postId);

  // 1) Intento con agregación del servidor (si la SDK la soporta)
  try {
    // RNFirebase moderno expone count().get()
    const agg: any = await (col as any).count().get();

    // Algunos SDK exponen .data().count, otros .count directo
    const n = typeof agg?.data === 'function' ? agg.data()?.count : agg?.count;

    return typeof n === 'number' ? n : 0;
  } catch {
    // 2) Fallback (no ideal): traer hasta 1000 y contar tamaño
    //    *Si luego necesitas precisión con miles de comentarios,
    //     conviene un contador desnormalizado en el doc del post
    const ss = (await col
      .limit(1000)
      .get()) as FirebaseFirestoreTypes.QuerySnapshot<CommentFS>;
    return ss.size;
  }
}
