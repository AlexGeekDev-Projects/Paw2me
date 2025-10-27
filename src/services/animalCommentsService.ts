import {
  getFirestore,
  collection as fsCollection,
  query as fsQuery,
  orderBy as fsOrderBy,
  limit as fsLimit,
  startAfter as fsStartAfter,
  getDocs as fsGetDocs,
  addDoc as fsAddDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  doc as fsDoc,
  onSnapshot as fsOnSnapshot,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import { onQuerySnapshot as fsOnQuerySnapshot } from '@services/firebase';
import type { CommentDoc, CommentsPage, NewComment } from '@models/comment';

type CommentFS = Readonly<{
  pawId: string;
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

const colRef = (
  pawId: string,
): FirebaseFirestoreTypes.CollectionReference<CommentFS> =>
  fsCollection(
    getFirestore(),
    `paws/${pawId}/comments`,
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
    postId: d.pawId, // campo del modelo (compat)
    authorUid: d.authorUid,
    content: d.content,
    createdAt: toMillis(d.createdAt) ?? Date.now(),
    updatedAt: toMillis(d.updatedAt),
    replyToId: d.replyToId ?? null,
    deleted: !!d.deleted,
  };
};

// Paginada
export async function listAnimalComments(
  pawId: string,
  opts?: Readonly<{ limit?: number; after?: unknown | null }>,
): Promise<CommentsPage> {
  const L = Math.max(1, Math.min(200, opts?.limit ?? 50));
  const ss = (await fsGetDocs(
    colRef(pawId),
  )) as FirebaseFirestoreTypes.QuerySnapshot<CommentFS>;

  const all = (
    ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[]
  )
    .map(toDoc)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); // asc

  const items = all.slice(-L); // últimos L en asc
  return { items, nextCursor: null };
}

// RT (cabeza)
// ─── RT (todos los comentarios en orden ascendente) ───
export function listenAnimalCommentsHead(
  pawId: string,
  opts: Readonly<{ onChange: (items: CommentDoc[]) => void; limit?: number }>,
): () => void {
  // Importante: sin limit y en ascendente para traer todos los existentes
  const q = fsQuery(
    colRef(pawId),
    fsOrderBy('createdAt', 'asc'),
  ) as FirebaseFirestoreTypes.Query<CommentFS>;

  return fsOnQuerySnapshot<CommentFS>(
    q,
    ss => {
      const docs =
        ss.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[];
      const items = docs.map(toDoc); // ya vienen ascendente, no invertir
      opts.onChange(items);
    },
    err => {
      console.warn('[listenAnimalCommentsHead] onSnapshot error:', err);
      opts.onChange([]);
    },
  );
}

// Crear
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

  // No releemos: devolvemos optimista
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

// Editar
export async function editAnimalComment(
  pawId: string,
  commentId: string,
  content: string,
): Promise<void> {
  const ref = fsDoc(
    getFirestore(),
    `paws/${pawId}/comments/${commentId}`,
  ) as FirebaseFirestoreTypes.DocumentReference<CommentFS>;
  await fsUpdateDoc<CommentFS>(ref, {
    content: content.trim(),
    updatedAt: Date.now(),
  });
}

// Borrar
export async function deleteAnimalComment(
  pawId: string,
  commentId: string,
): Promise<void> {
  const ref = fsDoc(
    getFirestore(),
    `paws/${pawId}/comments/${commentId}`,
  ) as FirebaseFirestoreTypes.DocumentReference<CommentFS>;
  await fsDeleteDoc(ref);
}

// ─── Conteo RT de comentarios (ojo: lee toda la colección) ───
export function listenAnimalCommentsCount(
  pawId: string,
  onChange: (n: number) => void,
): () => void {
  const q = fsQuery(
    colRef(pawId),
    fsOrderBy('createdAt', 'desc'),
  ) as FirebaseFirestoreTypes.Query<CommentFS>;
  return fsOnQuerySnapshot<CommentFS>(
    q,
    ss => onChange(ss?.size ?? 0),
    _e => onChange(0),
  );
}

export function listenAnimalCommentsAll(
  pawId: string,
  onChange: (items: CommentDoc[]) => void,
  onError?: (e: unknown) => void,
): () => void {
  const q = colRef(pawId) as unknown as FirebaseFirestoreTypes.Query<CommentFS>;
  return fsOnSnapshot(
    q as any,
    (ss: FirebaseFirestoreTypes.QuerySnapshot<CommentFS>) => {
      const docs = (ss?.docs ??
        []) as FirebaseFirestoreTypes.QueryDocumentSnapshot<CommentFS>[];
      const items = docs
        .map(toDoc)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)); // asc
      onChange(items);
    },
    err => {
      console.warn('[listenAnimalCommentsAll] snapshot error:', err);
      onError?.(err);
      onChange([]);
    },
  );
}
