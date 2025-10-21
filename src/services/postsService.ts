// src/services/postsService.ts
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  nowTs,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  deleteDoc,
  startAfter,
  type FirebaseFirestoreTypes,
} from '@services/firebase';

import type { PostDoc, PostCardVM } from '@models/post';

/* ─────────────────────────────────────────────────────────────
 * Tipos de entrada (coinciden con tu modelo)
 * ───────────────────────────────────────────────────────────── */
export type NewPostInput = Readonly<{
  authorUid: string;
  content: string;
  status: 'active' | 'hidden';
  animalId?: string | null;
  imageUrls?: string[];
  videoUrls?: string[];
}>;

/* ─────────────────────────────────────────────────────────────
 * Helpers Firestore / utilidades puramente tipadas
 * ───────────────────────────────────────────────────────────── */
const postsColRef = () => collection(getFirestore(), 'posts');
const reactionsColRef = (postId: string) =>
  collection(getFirestore(), 'posts', postId, 'reactions');
const reactionDocRef = (postId: string, uid: string) =>
  doc(getFirestore(), 'posts', postId, 'reactions', uid);

const toMillisNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const maybeTs = v as { toMillis?: () => number } | null;
  if (maybeTs && typeof maybeTs.toMillis === 'function') {
    const n = maybeTs.toMillis();
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every(x => typeof x === 'string');

const extractIndexLink = (err: unknown): string | null => {
  const msg =
    typeof err === 'string' ? err : err instanceof Error ? err.message : '';
  const m = msg.match(/https?:\/\/\S+/);
  return m ? m[0] : null;
};

/* ─────────────────────────────────────────────────────────────
 * Crear / actualizar
 * ───────────────────────────────────────────────────────────── */
export const newPostId = (): string =>
  doc(collection(getFirestore(), 'posts')).id;

export async function createPost(
  id: string,
  input: NewPostInput,
): Promise<void> {
  const ref = doc(getFirestore(), 'posts', id);
  const now = nowTs();
  await setDoc(ref, {
    ...input,
    imageUrls: input.imageUrls ?? [],
    videoUrls: input.videoUrls ?? [],
    createdAt: now,
    updatedAt: now,
  } as Omit<NewPostInput, 'id'> & {
    createdAt: FirebaseFirestoreTypes.FieldValue;
    updatedAt: FirebaseFirestoreTypes.FieldValue;
  });
}

export async function updatePostPartial(
  id: string,
  patch: Partial<NewPostInput>,
): Promise<void> {
  const ref = doc(getFirestore(), 'posts', id);
  await setDoc(ref, { ...patch, updatedAt: nowTs() }, { merge: true });
}

/* ─────────────────────────────────────────────────────────────
 * Listado público con cursor (desc por createdAt) + fallback sin índice
 * ───────────────────────────────────────────────────────────── */
export type ListPostsParams = Readonly<{
  limit?: number;
  after?: string; // cursor = String(millis) del último doc
  authorUid?: string;
  animalId?: string;
}>;

/** Molde sin index signatures para d.data() */
type PostDocRaw = Readonly<{
  animalId?: unknown;
  authorUid?: unknown;
  content?: unknown;
  imageUrls?: unknown;
  videoUrls?: unknown; // ← NUEVO
  status?: unknown;
  reactionCount?: unknown;
  commentCount?: unknown;
  shareCount?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}>;

function mapSnapToPost(
  d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
): PostDoc {
  const data = d.data() as PostDocRaw;

  const createdAtMs =
    (typeof data.createdAt === 'number'
      ? data.createdAt
      : toMillisNumber(data.createdAt)) ?? 0;

  const updatedAtMs =
    (typeof data.updatedAt === 'number'
      ? data.updatedAt
      : toMillisNumber(data.updatedAt)) ?? createdAtMs;

  const imageUrls = isStringArray(data.imageUrls) ? data.imageUrls : [];
  const videoUrls = isStringArray(data.videoUrls) ? data.videoUrls : []; // ← NUEVO

  const reactionCount =
    typeof data.reactionCount === 'number' ? data.reactionCount : 0;
  const commentCount =
    typeof data.commentCount === 'number' ? data.commentCount : 0;
  const shareCount = typeof data.shareCount === 'number' ? data.shareCount : 0;

  const status: 'active' | 'hidden' =
    data.status === 'hidden' ? 'hidden' : 'active';

  const animalId = typeof data.animalId === 'string' ? data.animalId : '';
  const authorUid = typeof data.authorUid === 'string' ? data.authorUid : '';
  const content = typeof data.content === 'string' ? data.content : '';

  return {
    id: d.id,
    animalId,
    authorUid,
    content,
    imageUrls,
    videoUrls, // ← NUEVO
    status,
    reactionCount,
    commentCount,
    shareCount,
    createdAt: createdAtMs,
    updatedAt: updatedAtMs,
  };
}

export async function listPostsPublic(
  opts?: ListPostsParams,
): Promise<Readonly<{ items: PostDoc[]; nextCursor: string | null }>> {
  const userLimit =
    typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 20;

  const base: Parameters<typeof query>[1][] = [
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(userLimit),
  ];
  if (opts?.authorUid)
    base.splice(1, 0, where('authorUid', '==', opts.authorUid));
  if (opts?.animalId) base.splice(1, 0, where('animalId', '==', opts.animalId));
  if (opts?.after && Number.isFinite(Number(opts.after))) {
    base.push(startAfter(new Date(Number(opts.after))));
  }

  try {
    const q1 = query(postsColRef(), ...base);
    const snap = await getDocs(q1);

    const items = snap.docs.map(mapSnapToPost);

    let nextCursor: string | null = null;
    if (!snap.empty) {
      const last = snap.docs[snap.docs.length - 1];
      const lastRaw = last.data() as PostDocRaw;
      const lastMs =
        (typeof lastRaw.createdAt === 'number'
          ? lastRaw.createdAt
          : toMillisNumber(lastRaw.createdAt)) ?? null;
      if (lastMs != null) nextCursor = String(lastMs);
    }

    return { items, nextCursor };
  } catch (err) {
    const link = extractIndexLink(err);
    const code = (err as { code?: string } | null)?.code ?? '';
    console.warn(
      '[postsService] Falta índice compuesto status + createdAt.' +
        (link
          ? ` Crea el índice aquí: ${link}`
          : ' (crea: status ASC, createdAt DESC)'),
    );

    if (!(code === 'failed-precondition' || /index/i.test(String(err)))) {
      throw err;
    }

    // Fallback sin where('status'), filtrando en cliente (TS7006: param tipado)
    const fb: Parameters<typeof query>[1][] = [
      orderBy('createdAt', 'desc'),
      limit(userLimit),
    ];
    if (opts?.authorUid)
      fb.splice(0, 0, where('authorUid', '==', opts.authorUid));
    if (opts?.animalId) fb.splice(0, 0, where('animalId', '==', opts.animalId));
    if (opts?.after && Number.isFinite(Number(opts.after))) {
      fb.push(startAfter(new Date(Number(opts.after))));
    }

    const q2 = query(postsColRef(), ...fb);
    const snap = await getDocs(q2);

    const onlyActive = (p: PostDoc): p is PostDoc => p.status === 'active';
    const items = snap.docs.map(mapSnapToPost).filter(onlyActive);

    let nextCursor: string | null = null;
    if (!snap.empty) {
      const last = snap.docs[snap.docs.length - 1];
      const lastRaw = last.data() as PostDocRaw;
      const lastMs =
        (typeof lastRaw.createdAt === 'number'
          ? lastRaw.createdAt
          : toMillisNumber(lastRaw.createdAt)) ?? null;
      if (lastMs != null) nextCursor = String(lastMs);
    }

    return { items, nextCursor };
  }
}

/* ─────────────────────────────────────────────────────────────
 * Reacciones (subcolección posts/{id}/reactions/{uid})
 * ───────────────────────────────────────────────────────────── */
type ReactionDoc = Readonly<{
  reactedAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
}>;

export async function getUserReacted(
  postId: string,
  uid: string,
): Promise<boolean> {
  const r = await getDoc(reactionDocRef(postId, uid));
  return r.exists();
}

export async function countReactions(postId: string): Promise<number> {
  const r = await getDocs(reactionsColRef(postId));
  return r.size;
}

export async function toggleReaction(
  postId: string,
  uid: string,
): Promise<boolean> {
  const ref = reactionDocRef(postId, uid);
  const s = await getDoc(ref);
  if (s.exists()) {
    await deleteDoc(ref);
    return false;
  }
  const payload: ReactionDoc = { reactedAt: nowTs() };
  await setDoc(ref, payload);
  return true;
}

/* ─────────────────────────────────────────────────────────────
 * Mapper a ViewModel del feed (PostCard) — tipado estricto
 * ───────────────────────────────────────────────────────────── */
export function toPostVM(
  p: Readonly<PostDoc>,
  reactedByMe: boolean,
): PostCardVM {
  return {
    id: p.id,
    animalId: p.animalId,
    content: p.content,
    imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls : [],
    ...(Array.isArray(p.videoUrls) && p.videoUrls.length > 0
      ? { videoUrls: p.videoUrls }
      : {}),
    reactionCount: typeof p.reactionCount === 'number' ? p.reactionCount : 0,
    commentCount: typeof p.commentCount === 'number' ? p.commentCount : 0,
    shareCount: typeof p.shareCount === 'number' ? p.shareCount : 0,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : 0,
    reactedByMe,
    ...(typeof p.updatedAt === 'number' ? { updatedAt: p.updatedAt } : {}),
  };
}
