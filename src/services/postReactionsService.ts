// src/services/postReactionsService.ts
import {
  getFirestore,
  getAuth,
  doc,
  collection,
  where,
  getDoc,
  query,
  orderBy,
  limit,
  nowTs,
  type FirebaseFirestoreTypes,
} from '@services/firebase';

export type PostReactionKey =
  | 'like'
  | 'love'
  | 'happy'
  | 'sad'
  | 'wow'
  | 'angry';

export type PostReactionDoc = Readonly<{
  userId: string;
  postId: string;
  key: PostReactionKey;
  createdAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
  updatedAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
}>;

export type PostReactionCountsDoc = Readonly<{
  like: number;
  love: number;
  happy: number;
  sad: number;
  wow: number;
  angry: number;
  updatedAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
}>;

type Unsub = () => void;
type Order = 'asc' | 'desc';

type PostReactionCountsData = Readonly<{
  like: number;
  love: number;
  happy: number;
  sad: number;
  wow: number;
  angry: number;
}>;

/* ──────────────────────────────
 * Refs
 * ────────────────────────────── */
const reactionsColRef = (
  postId: string,
): FirebaseFirestoreTypes.CollectionReference<PostReactionDoc> =>
  collection(
    getFirestore(),
    'posts',
    postId,
    'reactions',
  ) as FirebaseFirestoreTypes.CollectionReference<PostReactionDoc>;

const reactionDocRef = (
  postId: string,
  userId: string,
): FirebaseFirestoreTypes.DocumentReference<PostReactionDoc> =>
  doc(
    getFirestore(),
    'posts',
    postId,
    'reactions',
    userId,
  ) as FirebaseFirestoreTypes.DocumentReference<PostReactionDoc>;

const countsDocRef = (
  postId: string,
): FirebaseFirestoreTypes.DocumentReference<PostReactionCountsDoc> =>
  doc(
    getFirestore(),
    'posts',
    postId,
    'meta',
    'reactionCounts',
  ) as FirebaseFirestoreTypes.DocumentReference<PostReactionCountsDoc>;

/* ──────────────────────────────
 * Utils
 * ────────────────────────────── */
const tsToMillis = (
  v: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue,
): number =>
  (v as FirebaseFirestoreTypes.Timestamp)?.toMillis
    ? (v as FirebaseFirestoreTypes.Timestamp).toMillis()
    : 0;

const sortByUpdatedAt = <T extends { updatedAt: PostReactionDoc['updatedAt'] }>(
  arr: readonly T[],
  dir: Order,
): T[] =>
  [...arr].sort((a, b) => {
    const am = tsToMillis(a.updatedAt);
    const bm = tsToMillis(b.updatedAt);
    return dir === 'asc' ? am - bm : bm - am;
  });

const isPostKey = (k: unknown): k is PostReactionKey =>
  k === 'like' ||
  k === 'love' ||
  k === 'happy' ||
  k === 'sad' ||
  k === 'wow' ||
  k === 'angry';

function assertSelf(userId: string): string {
  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? '';
  if (!uid) throw new Error('auth/unauthenticated');
  if (uid !== userId) throw new Error('auth/mismatch');
  return uid;
}

/* ──────────────────────────────
 * Listeners (con fallback sin índice compuesto)
 * ────────────────────────────── */
export function listenPostReactorsAll(
  postId: string,
  cb: (items: ReadonlyArray<PostReactionDoc & { id: string }>) => void,
  opts?: { limit?: number; order?: Order },
): Unsub {
  const n: number =
    typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 120;
  const dir: Order = opts?.order === 'asc' ? 'asc' : 'desc';

  const col = reactionsColRef(postId);
  let currentUnsub: Unsub | null = null;

  const subscribe = (withOrder: boolean): void => {
    const qRef: FirebaseFirestoreTypes.Query<PostReactionDoc> = withOrder
      ? query(col, orderBy('updatedAt'), limit(n))
      : query(col, limit(n));

    currentUnsub = qRef.onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot<PostReactionDoc>) => {
        const mapped = snap.docs.map(
          (
            d: FirebaseFirestoreTypes.QueryDocumentSnapshot<PostReactionDoc>,
          ): PostReactionDoc & { id: string } => ({ id: d.id, ...d.data() }),
        );
        const ordered = sortByUpdatedAt(mapped, dir);
        cb(ordered);
      },
      (_err: Error) => {
        if (withOrder) subscribe(false);
        else cb([]);
      },
    );
  };

  subscribe(true);
  return () => currentUnsub?.();
}

export function listenPostReactorsByKey(
  postId: string,
  key: PostReactionKey,
  cb: (items: ReadonlyArray<PostReactionDoc & { id: string }>) => void,
  opts?: { limit?: number; order?: Order },
): Unsub {
  const n: number =
    typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 80;
  const dir: Order = opts?.order === 'asc' ? 'asc' : 'desc';

  const col = reactionsColRef(postId);
  let currentUnsub: Unsub | null = null;

  const subscribe = (withOrder: boolean): void => {
    const qRef: FirebaseFirestoreTypes.Query<PostReactionDoc> = withOrder
      ? query(col, where('key', '==', key), orderBy('updatedAt'), limit(n))
      : query(col, where('key', '==', key), limit(n));

    currentUnsub = qRef.onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot<PostReactionDoc>) => {
        const mapped = snap.docs.map(
          (
            d: FirebaseFirestoreTypes.QueryDocumentSnapshot<PostReactionDoc>,
          ): PostReactionDoc & { id: string } => ({ id: d.id, ...d.data() }),
        );
        const ordered = sortByUpdatedAt(mapped, dir);
        cb(ordered);
      },
      (_err: Error) => {
        if (withOrder) subscribe(false);
        else cb([]);
      },
    );
  };

  subscribe(true);
  return () => currentUnsub?.();
}

/* ──────────────────────────────
 * Lecturas helpers
 * ────────────────────────────── */
export async function getUserReacted(
  postId: string,
  userId: string,
): Promise<PostReactionKey | null> {
  const snap = await getDoc(reactionDocRef(postId, userId));
  if (!snap.exists()) return null;
  const k = (snap.data()?.key ?? null) as unknown;
  return isPostKey(k) ? k : null;
}

/** Distribución completa por clave (si no hay doc, todo a 0) */
export async function getReactionCounts(
  postId: string,
): Promise<PostReactionCountsData> {
  const snap = await getDoc(countsDocRef(postId));
  const data: PostReactionCountsData | undefined = snap.exists()
    ? (snap.data() as PostReactionCountsData | undefined)
    : undefined;

  return {
    like: data?.like ?? 0,
    love: data?.love ?? 0,
    happy: data?.happy ?? 0,
    sad: data?.sad ?? 0,
    wow: data?.wow ?? 0,
    angry: data?.angry ?? 0,
  };
}

/** Suma total desde meta; si no hay doc, 0 */
export async function countReactions(postId: string): Promise<number> {
  const d = await getReactionCounts(postId);
  return d.like + d.love + d.happy + d.sad + d.wow + d.angry;
}

/* ──────────────────────────────
 * Escritura transaccional
 * ────────────────────────────── */
export async function setPostReaction(params: {
  postId: string;
  userId: string;
  next: PostReactionKey | null;
}): Promise<void> {
  const { postId, userId, next } = params;

  assertSelf(userId);

  await getFirestore().runTransaction(
    async (tx: FirebaseFirestoreTypes.Transaction) => {
      const rRef = reactionDocRef(postId, userId);
      const cRef = countsDocRef(postId);

      // previa
      const prevSnap: FirebaseFirestoreTypes.DocumentSnapshot<PostReactionDoc> =
        await tx.get(rRef);
      const prev = prevSnap.exists()
        ? (prevSnap.data() as PostReactionDoc)
        : null;

      if ((prev?.key ?? null) === next) return; // no-op

      // contadores actuales
      const countsSnap: FirebaseFirestoreTypes.DocumentSnapshot<PostReactionCountsDoc> =
        await tx.get(cRef);
      const base = countsSnap.exists()
        ? (countsSnap.data() as PostReactionCountsDoc)
        : undefined;

      let like = (base?.like ?? 0) | 0;
      let love = (base?.love ?? 0) | 0;
      let happy = (base?.happy ?? 0) | 0;
      let sad = (base?.sad ?? 0) | 0;
      let wow = (base?.wow ?? 0) | 0;
      let angry = (base?.angry ?? 0) | 0;

      const dec = (k: PostReactionKey | undefined): void => {
        if (k === 'like' && like > 0) like -= 1;
        if (k === 'love' && love > 0) love -= 1;
        if (k === 'happy' && happy > 0) happy -= 1;
        if (k === 'sad' && sad > 0) sad -= 1;
        if (k === 'wow' && wow > 0) wow -= 1;
        if (k === 'angry' && angry > 0) angry -= 1;
      };
      const inc = (k: PostReactionKey | undefined): void => {
        if (k === 'like') like += 1;
        if (k === 'love') love += 1;
        if (k === 'happy') happy += 1;
        if (k === 'sad') sad += 1;
        if (k === 'wow') wow += 1;
        if (k === 'angry') angry += 1;
      };

      dec(prev?.key);
      inc(next ?? undefined);

      const now = nowTs();

      // guarda contadores
      tx.set(
        cRef,
        {
          like,
          love,
          happy,
          sad,
          wow,
          angry,
          updatedAt: now,
        } satisfies PostReactionCountsDoc,
        { merge: true },
      );

      // guarda/elimina reacción
      if (next) {
        const payload: PostReactionDoc = {
          userId,
          postId,
          key: next,
          createdAt: (prev?.createdAt ?? now) as PostReactionDoc['createdAt'],
          updatedAt: now as PostReactionDoc['updatedAt'],
        };
        tx.set(rRef, payload);
      } else {
        tx.delete(rRef);
      }
    },
  );
}

/** Cambia a una clave concreta (o la quita si ya estaba). Devuelve la clave final o null. */
export async function toggleReactionKey(
  postId: string,
  userId: string,
  key: PostReactionKey,
): Promise<PostReactionKey | null> {
  const prev = await getUserReacted(postId, userId);
  const next: PostReactionKey | null = prev === key ? null : key;
  await setPostReaction({ postId, userId, next });
  return next;
}

/** Variante que fija exactamente una clave (o la borra si pasas null). Devuelve la clave final o null. */
export async function setReactionKey(
  postId: string,
  userId: string,
  next: PostReactionKey | null,
): Promise<PostReactionKey | null> {
  await setPostReaction({ postId, userId, next });
  return next;
}

/** Helpers con el usuario autenticado */
export async function toggleMyReactionKey(
  postId: string,
  key: PostReactionKey,
): Promise<boolean> {
  const uid = getAuth().currentUser?.uid ?? '';
  if (!uid) throw new Error('auth/unauthenticated');
  const final = await toggleReactionKey(postId, uid, key);
  return final === key;
}

export async function setMyReactionKey(
  postId: string,
  next: PostReactionKey | null,
): Promise<PostReactionKey | null> {
  const uid = getAuth().currentUser?.uid ?? '';
  if (!uid) throw new Error('auth/unauthenticated');
  return setReactionKey(postId, uid, next);
}

/** Compat: toggle de 'love' como antes */
export async function toggleReaction(
  postId: string,
  userId: string,
): Promise<boolean> {
  const res = await toggleReactionKey(postId, userId, 'love');
  return res === 'love';
}

export async function toggleMyReaction(postId: string): Promise<boolean> {
  const uid = getAuth().currentUser?.uid ?? '';
  if (!uid) throw new Error('auth/unauthenticated');
  return toggleReaction(postId, uid);
}
