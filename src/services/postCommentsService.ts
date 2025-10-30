// src/services/postCommentsService.ts
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  getCountFromServer, // <- asegúrate de re-exportarlo desde @services/firebase
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import { addDoc, updateDoc } from '@services/firebase'; // tus helpers compat

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
  collection(
    getFirestore(),
    'posts',
    postId,
    'comments',
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
  // FieldValue (serverTimestamp placeholder) → usamos “ahora” como fallback
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

/** Lista paginada (devuelve en ascendente para render natural) */
export async function listComments(
  postId: PostId,
  opts?: Readonly<{ limit?: number; after?: unknown | null }>,
): Promise<CommentsPage> {
  const L = Math.max(1, Math.min(50, opts?.limit ?? 20));
  const base = colRef(postId);

  const q = opts?.after
    ? (query(
        base,
        orderBy('createdAt', 'desc'),
        startAfter(opts.after as any),
        limit(L),
      ) as FirebaseFirestoreTypes.Query<CommentFS>)
    : (query(
        base,
        orderBy('createdAt', 'desc'),
        limit(L),
      ) as unknown as FirebaseFirestoreTypes.Query<CommentFS>);

  const ss = await getDocs(q);
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
  const q = query(
    colRef(postId),
    orderBy('createdAt', 'desc'),
    limit(L),
  ) as FirebaseFirestoreTypes.Query<CommentFS>;

  const off = onSnapshot(q, ss => {
    const docs =
      ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[];
    const items = docs.map(toDoc).slice().reverse();
    opts.onChange(items);
  });

  return off;
}

/** Crear comentario (modular + helper compat) */
export async function addComment(
  postId: PostId,
  uid: string,
  data: NewComment,
): Promise<CommentDoc> {
  const ref = await addDoc(colRef(postId), {
    postId,
    authorUid: uid,
    content: data.content.trim(),
    replyToId: data.replyToId ?? null,
    createdAt: Date.now(),
    updatedAt: null,
    deleted: false,
  } as CommentFS);

  const snap = (await getDoc(
    ref,
  )) as FirebaseFirestoreTypes.DocumentSnapshot<CommentFS>;

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
  const ref = doc(
    getFirestore(),
    'posts',
    postId,
    'comments',
    commentId,
  ) as FirebaseFirestoreTypes.DocumentReference<CommentFS>;

  await updateDoc(ref, {
    content: content.trim(),
    updatedAt: Date.now(),
  } as Partial<CommentFS>);
}

/** Borrar duro */
export async function deleteComment(
  postId: PostId,
  commentId: string,
): Promise<void> {
  const ref = doc(
    getFirestore(),
    'posts',
    postId,
    'comments',
    commentId,
  ) as FirebaseFirestoreTypes.DocumentReference<CommentFS>;

  await deleteDoc(ref);
}

/** Conteo de comentarios (usa aggregate; fallback a getDocs limitado) */
export async function getCommentsCount(postId: PostId): Promise<number> {
  try {
    const q = query(colRef(postId)) as FirebaseFirestoreTypes.Query<CommentFS>;
    const agg: any = await getCountFromServer(q as any);
    const n = typeof agg?.data === 'function' ? agg.data()?.count : agg?.count;
    return typeof n === 'number' ? n : 0;
  } catch {
    const ss = await getDocs(
      query(
        colRef(postId),
        limit(1000),
      ) as FirebaseFirestoreTypes.Query<CommentFS>,
    );
    return ss.size;
  }
}
