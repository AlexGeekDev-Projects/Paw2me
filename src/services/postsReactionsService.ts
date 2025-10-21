// src/services/postsReactionsService.ts
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  nowTs,
  startAfter,
  type FirebaseFirestoreTypes,
} from '@services/firebase';

export type ReactionKey = 'like' | 'love' | 'happy' | 'sad' | 'wow' | 'angry';

export type ReactionDoc = Readonly<{
  userId: string;
  postId: string;
  key: ReactionKey;
  createdAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
  updatedAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
}>;

export type ReactionCountsDoc = Readonly<
  Record<ReactionKey, number> & {
    updatedAt:
      | FirebaseFirestoreTypes.FieldValue
      | FirebaseFirestoreTypes.Timestamp;
  }
>;

type Unsub = () => void;
type Order = 'asc' | 'desc';

/* ───────────── Refs tipados ───────────── */
const postRef = (
  postId: string,
): FirebaseFirestoreTypes.DocumentReference<FirebaseFirestoreTypes.DocumentData> =>
  doc(getFirestore(), 'posts', postId);

const reactionsColRef = (
  postId: string,
): FirebaseFirestoreTypes.CollectionReference<ReactionDoc> =>
  collection(
    getFirestore(),
    'posts',
    postId,
    'reactions',
  ) as FirebaseFirestoreTypes.CollectionReference<ReactionDoc>;

const reactionDocRef = (
  postId: string,
  userId: string,
): FirebaseFirestoreTypes.DocumentReference<ReactionDoc> =>
  doc(
    getFirestore(),
    'posts',
    postId,
    'reactions',
    userId,
  ) as FirebaseFirestoreTypes.DocumentReference<ReactionDoc>;

const countsDocRef = (
  postId: string,
): FirebaseFirestoreTypes.DocumentReference<ReactionCountsDoc> =>
  doc(
    getFirestore(),
    'posts',
    postId,
    'meta',
    'reactionCounts',
  ) as FirebaseFirestoreTypes.DocumentReference<ReactionCountsDoc>;

/* ───────────── Utils ───────────── */
const EMPTY: ReactionCountsDoc = {
  like: 0,
  love: 0,
  happy: 0,
  sad: 0,
  wow: 0,
  angry: 0,
  updatedAt: nowTs(),
};

const tsToMillis = (
  v: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue,
): number =>
  (v as FirebaseFirestoreTypes.Timestamp)?.toMillis
    ? (v as FirebaseFirestoreTypes.Timestamp).toMillis()
    : 0;

const sortByUpdatedAt = <T extends { updatedAt: ReactionDoc['updatedAt'] }>(
  arr: readonly T[],
  order: Order,
): T[] =>
  [...arr].sort((a, b) => {
    const am = tsToMillis(a.updatedAt);
    const bm = tsToMillis(b.updatedAt);
    return order === 'asc' ? am - bm : bm - am;
  });

/* ───────────── Lecturas/escuchas ───────────── */
export function listenPostReactionCounts(
  postId: string,
  cb: (counts: ReactionCountsDoc | null) => void,
): Unsub {
  const ref = countsDocRef(postId);
  return ref.onSnapshot(
    (snap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionCountsDoc>) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data();
      cb({
        like: (d?.like ?? 0) | 0,
        love: (d?.love ?? 0) | 0,
        happy: (d?.happy ?? 0) | 0,
        sad: (d?.sad ?? 0) | 0,
        wow: (d?.wow ?? 0) | 0,
        angry: (d?.angry ?? 0) | 0,
        updatedAt: d?.updatedAt ?? nowTs(),
      });
    },
  );
}

export function listenPostUserReaction(
  postId: string,
  userId: string,
  cb: (key: ReactionKey | null) => void,
): Unsub {
  const ref = reactionDocRef(postId, userId);
  return ref.onSnapshot(
    (snap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionDoc>) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const k = snap.data()?.key;
      cb(
        k === 'like' ||
          k === 'love' ||
          k === 'happy' ||
          k === 'sad' ||
          k === 'wow' ||
          k === 'angry'
          ? (k as ReactionKey)
          : null,
      );
    },
  );
}

/* ───────────── Escritura con transacción ───────────── */
export async function setPostUserReaction(params: {
  postId: string;
  userId: string;
  next: ReactionKey | null;
}): Promise<void> {
  const { postId, userId, next } = params;

  await getFirestore().runTransaction(
    async (tx: FirebaseFirestoreTypes.Transaction) => {
      const rRef = reactionDocRef(postId, userId);
      const cRef = countsDocRef(postId);
      const pRef = postRef(postId);

      // previa
      const prevSnap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionDoc> =
        await tx.get(rRef);
      const prev = prevSnap.exists() ? (prevSnap.data() as ReactionDoc) : null;

      if ((prev?.key ?? null) === next) return; // no-op

      // contadores
      const countsSnap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionCountsDoc> =
        await tx.get(cRef);
      const base = countsSnap.exists()
        ? (countsSnap.data() as ReactionCountsDoc)
        : undefined;

      let like = (base?.like ?? 0) | 0;
      let love = (base?.love ?? 0) | 0;
      let happy = (base?.happy ?? 0) | 0;
      let sad = (base?.sad ?? 0) | 0;
      let wow = (base?.wow ?? 0) | 0;
      let angry = (base?.angry ?? 0) | 0;

      const dec = (k: ReactionKey) => {
        if (k === 'like' && like > 0) like -= 1;
        if (k === 'love' && love > 0) love -= 1;
        if (k === 'happy' && happy > 0) happy -= 1;
        if (k === 'sad' && sad > 0) sad -= 1;
        if (k === 'wow' && wow > 0) wow -= 1;
        if (k === 'angry' && angry > 0) angry -= 1;
      };
      const inc = (k: ReactionKey) => {
        if (k === 'like') like += 1;
        if (k === 'love') love += 1;
        if (k === 'happy') happy += 1;
        if (k === 'sad') sad += 1;
        if (k === 'wow') wow += 1;
        if (k === 'angry') angry += 1;
      };

      if (prev?.key) dec(prev.key);
      if (next) inc(next);

      const now = nowTs();

      // guarda contadores
      tx.set(
        cRef,
        { like, love, happy, sad, wow, angry, updatedAt: now },
        { merge: true },
      );

      // guarda/elimina reacción de usuario
      if (next) {
        const payload: ReactionDoc = {
          userId,
          postId,
          key: next,
          createdAt: (prev?.createdAt ?? now) as ReactionDoc['createdAt'],
          updatedAt: now as ReactionDoc['updatedAt'],
        };
        tx.set(rRef, payload);
      } else {
        tx.delete(rRef);
      }

      // write-touch opcional por si quieres ordenar por updatedAt en el post
      tx.set(pRef, { updatedAt: now }, { merge: true });
    },
  );
}

/* ───────────── Reactores (para el modal) ───────────── */
export function listenPostReactorsAll(
  postId: string,
  cb: (items: ReadonlyArray<ReactionDoc & { id: string }>) => void,
  opts?: { limit?: number; order?: Order },
): Unsub {
  const n =
    typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 120;
  const dir: Order = opts?.order === 'asc' ? 'asc' : 'desc';

  const col = reactionsColRef(postId);
  let unsub: Unsub | null = null;

  const subscribe = (withOrder: boolean): void => {
    const qRef: FirebaseFirestoreTypes.Query<ReactionDoc> = withOrder
      ? query(col, orderBy('updatedAt'), limit(n))
      : query(col, limit(n));

    unsub = qRef.onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot<ReactionDoc>) => {
        const mapped = snap.docs.map(
          (
            d: FirebaseFirestoreTypes.QueryDocumentSnapshot<ReactionDoc>,
          ): ReactionDoc & { id: string } => ({ id: d.id, ...d.data() }),
        );
        cb(sortByUpdatedAt(mapped, dir));
      },
      // fallback sin índice
      () => {
        if (withOrder) subscribe(false);
        else cb([]);
      },
    );
  };

  subscribe(true);
  return () => unsub?.();
}

export function listenPostReactorsByKey(
  postId: string,
  key: ReactionKey,
  cb: (items: ReadonlyArray<ReactionDoc & { id: string }>) => void,
  opts?: { limit?: number; order?: Order },
): Unsub {
  const n = typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 80;
  const dir: Order = opts?.order === 'asc' ? 'asc' : 'desc';

  const col = reactionsColRef(postId);
  let unsub: Unsub | null = null;

  const subscribe = (withOrder: boolean): void => {
    const qRef: FirebaseFirestoreTypes.Query<ReactionDoc> = withOrder
      ? query(col, where('key', '==', key), orderBy('updatedAt'), limit(n))
      : query(col, where('key', '==', key), limit(n));

    unsub = qRef.onSnapshot(
      (snap: FirebaseFirestoreTypes.QuerySnapshot<ReactionDoc>) => {
        const mapped = snap.docs.map(
          (
            d: FirebaseFirestoreTypes.QueryDocumentSnapshot<ReactionDoc>,
          ): ReactionDoc & { id: string } => ({ id: d.id, ...d.data() }),
        );
        cb(sortByUpdatedAt(mapped, dir));
      },
      () => {
        if (withOrder) subscribe(false);
        else cb([]);
      },
    );
  };

  subscribe(true);
  return () => unsub?.();
}

/* ───────────── (Opcional) warmup para posts antiguos ───────────── */
export async function warmupPostCounts(postId: string): Promise<void> {
  const col = reactionsColRef(postId);
  const snap = await getDocs(query(col, limit(1000)));
  const counts = { like: 0, love: 0, happy: 0, sad: 0, wow: 0, angry: 0 };
  snap.forEach(d => {
    const k = (d.data().key ?? '') as ReactionKey;
    if (k in counts) (counts as any)[k] += 1;
  });
  await setDoc(
    countsDocRef(postId),
    { ...counts, updatedAt: nowTs() } as ReactionCountsDoc,
    { merge: true },
  );
}
