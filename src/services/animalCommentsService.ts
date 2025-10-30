import {
  getFirestore,
  collection as fsCollection,
  query as fsQuery,
  orderBy as fsOrderBy,
  getDocs as fsGetDocs,
  addDoc as fsAddDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  doc as fsDoc,
  onSnapshot as fsOnSnapshot,
  getCountFromServer,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import type { CommentDoc, CommentsPage, NewComment } from '@models/comment';

type CommentFS = Readonly<{
  pawId?: string;
  authorUid: string;
  content: string;
  createdAt:
    | number
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp
    | null;
  updatedAt?:
    | number
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp
    | null;
  replyToId?: string | null;
  deleted?: boolean;
}>;

// Usa segmentos (API modular)
const colRef = (
  pawId: string,
): FirebaseFirestoreTypes.CollectionReference<CommentFS> =>
  fsCollection(
    getFirestore(),
    'paws',
    pawId,
    'comments',
  ) as unknown as FirebaseFirestoreTypes.CollectionReference<CommentFS>;

const isTs = (v: unknown): v is FirebaseFirestoreTypes.Timestamp =>
  !!v && typeof v === 'object' && typeof (v as any).toMillis === 'function';

const toMillis = (
  v:
    | number
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp
    | null
    | undefined,
): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (isTs(v)) return v.toMillis();
  return Date.now();
};

const toDoc = (
  snap: FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>,
): CommentDoc => {
  const d = snap.data();
  return {
    id: snap.id,
    postId: snap.ref.parent.parent?.id ?? '',
    authorUid: d.authorUid,
    content: d.content,
    createdAt: toMillis(d.createdAt) ?? Date.now(),
    updatedAt: toMillis(d.updatedAt),
    replyToId: d.replyToId ?? null,
    deleted: !!d.deleted,
  };
};

// Bootstrap (ascendente y nos quedamos con los últimos L)
export async function listAnimalComments(
  pawId: string,
  opts?: Readonly<{ limit?: number }>,
): Promise<CommentsPage> {
  const L = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const ss = (await fsGetDocs(
    colRef(pawId),
  )) as FirebaseFirestoreTypes.QuerySnapshot<CommentFS>;

  const all = (
    ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[]
  )
    .map(toDoc)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return { items: all.slice(-L), nextCursor: null };
}

// Realtime: todos ascendente
export function listenAnimalCommentsHead(
  pawId: string,
  opts: Readonly<{ onChange: (items: CommentDoc[]) => void }>,
): () => void {
  const q = fsQuery(
    colRef(pawId),
    fsOrderBy('createdAt', 'asc'),
  ) as FirebaseFirestoreTypes.Query<CommentFS>;

  const off = fsOnSnapshot(
    q,
    ss => {
      const docs =
        ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[];
      const items = docs.map(toDoc);
      if (__DEV__) console.log('[comments RT]', pawId, 'n=', items.length);
      opts.onChange(items);
    },
    err => {
      if (__DEV__) {
        console.warn('[listenAnimalCommentsHead] onSnapshot error:', err);
      }
      opts.onChange([]);
    },
  );
  return off;
}

// Crear / Editar / Borrar
export async function addAnimalComment(
  pawId: string,
  uid: string,
  data: NewComment,
): Promise<CommentDoc> {
  const createdAt = Date.now();
  const ref = await fsAddDoc(colRef(pawId), {
    pawId,
    authorUid: uid,
    content: data.content.trim(),
    replyToId: data.replyToId ?? null,
    createdAt,
    updatedAt: null,
    deleted: false,
  } as CommentFS);
  return {
    id: ref.id,
    postId: pawId,
    authorUid: uid,
    content: data.content.trim(),
    createdAt,
    updatedAt: null,
    replyToId: data.replyToId ?? null,
    deleted: false,
  };
}

export async function editAnimalComment(
  pawId: string,
  commentId: string,
  content: string,
): Promise<void> {
  const ref = fsDoc(
    getFirestore(),
    'paws',
    pawId,
    'comments',
    commentId,
  ) as FirebaseFirestoreTypes.DocumentReference<CommentFS>;
  await fsUpdateDoc<CommentFS>(ref, {
    content: content.trim(),
    updatedAt: Date.now(),
  });
}

export async function deleteAnimalComment(
  pawId: string,
  commentId: string,
): Promise<void> {
  const ref = fsDoc(
    getFirestore(),
    'paws',
    pawId,
    'comments',
    commentId,
  ) as FirebaseFirestoreTypes.DocumentReference<CommentFS>;
  await fsDeleteDoc(ref);
}

/** Conteo para Explore (aggregate) */
export async function getCommentsCount(pawId: string): Promise<number> {
  try {
    const q = fsQuery(colRef(pawId)) as FirebaseFirestoreTypes.Query<CommentFS>;
    const agg = await getCountFromServer(q as any);
    const n =
      typeof (agg as any)?.data === 'function'
        ? (agg as any).data()?.count
        : (agg as any)?.count;
    return typeof n === 'number' ? n : 0;
  } catch {
    const ss = (await fsGetDocs(
      colRef(pawId),
    )) as FirebaseFirestoreTypes.QuerySnapshot<CommentFS>;
    return ss.size ?? 0;
  }
}
