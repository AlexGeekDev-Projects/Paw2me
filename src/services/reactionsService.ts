// src/services/reactionsService.ts
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  nowTs,
  type FirebaseFirestoreTypes,
} from '@services/firebase';

export type FireReactionKey = 'love' | 'sad' | 'match';

export type ReactionDoc = Readonly<{
  userId: string;
  animalId: string;
  key: FireReactionKey;
  createdAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
  updatedAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
}>;

export type ReactionCountsDoc = Readonly<{
  love: number;
  sad: number;
  match: number;
  updatedAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
}>;

export type MatchDoc = Readonly<{
  userId: string;
  animalId: string;
  createdAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
  status?: 'pending' | 'contacted' | 'closed';
}>;

export type AnimalStatus = 'disponible' | 'en_proceso' | 'adoptado' | 'oculto';

/** Mínimo del paw que espejamos para pintar la lista del usuario */
type PawSnapshotDoc = Readonly<{
  name?: string;
  species?: string;
  location?: { city?: string };
  coverUrl?: string;
  status?: AnimalStatus;
}>;

export type UserMatchAnimal = Readonly<{
  name: string;
  species: string;
  city?: string;
  coverUrl?: string;
  status?: AnimalStatus;
}>;

export type UserMatchDoc = Readonly<{
  animalId: string; // mantenemos el nombre que ya usas
  createdAt:
    | FirebaseFirestoreTypes.FieldValue
    | FirebaseFirestoreTypes.Timestamp;
  status: 'pending' | 'contacted' | 'closed';
  paw: UserMatchAnimal;
}>;

type Unsub = () => void;

/* ──────────────────────────────
 * Refs tipados (sin any)
 * ────────────────────────────── */
const pawRef = (
  animalId: string,
): FirebaseFirestoreTypes.DocumentReference<FirebaseFirestoreTypes.DocumentData> =>
  doc(getFirestore(), 'paws', animalId);

const reactionDocRef = (
  animalId: string,
  userId: string,
): FirebaseFirestoreTypes.DocumentReference<ReactionDoc> =>
  doc(
    getFirestore(),
    'paws',
    animalId,
    'reactions',
    userId,
  ) as FirebaseFirestoreTypes.DocumentReference<ReactionDoc>;

const countsDocRef = (
  animalId: string,
): FirebaseFirestoreTypes.DocumentReference<ReactionCountsDoc> =>
  doc(
    getFirestore(),
    'paws',
    animalId,
    'meta',
    'reactionCounts',
  ) as FirebaseFirestoreTypes.DocumentReference<ReactionCountsDoc>;

const pawMatchDocRef = (
  animalId: string,
  userId: string,
): FirebaseFirestoreTypes.DocumentReference<MatchDoc> =>
  doc(
    getFirestore(),
    'paws',
    animalId,
    'matches',
    userId,
  ) as FirebaseFirestoreTypes.DocumentReference<MatchDoc>;

const userMatchesColRef = (
  userId: string,
): FirebaseFirestoreTypes.CollectionReference<UserMatchDoc> =>
  collection(
    getFirestore(),
    'users',
    userId,
    'matches',
  ) as FirebaseFirestoreTypes.CollectionReference<UserMatchDoc>;

const userMatchDocRef = (
  userId: string,
  animalId: string,
): FirebaseFirestoreTypes.DocumentReference<UserMatchDoc> =>
  doc(
    getFirestore(),
    'users',
    userId,
    'matches',
    animalId,
  ) as FirebaseFirestoreTypes.DocumentReference<UserMatchDoc>;

/* ──────────────────────────────
 * Utils estrictos
 * ────────────────────────────── */
const isAnimalStatus = (v: unknown): v is AnimalStatus =>
  v === 'disponible' ||
  v === 'en_proceso' ||
  v === 'adoptado' ||
  v === 'oculto';

const toUserMatchAnimal = (
  src: PawSnapshotDoc | undefined,
): UserMatchAnimal => {
  const name =
    typeof src?.name === 'string' && src.name.trim().length > 0
      ? src.name
      : '—';
  const species =
    typeof src?.species === 'string' && src.species.trim().length > 0
      ? src.species
      : 'otro';
  const city =
    typeof src?.location?.city === 'string' && src.location.city.length > 0
      ? src.location.city
      : undefined;
  const coverUrl =
    typeof src?.coverUrl === 'string' && src.coverUrl.length > 0
      ? src.coverUrl
      : undefined;
  const status = isAnimalStatus(src?.status) ? src!.status : undefined;

  return {
    name,
    species,
    ...(city ? { city } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(status ? { status } : {}),
  };
};

/* ──────────────────────────────
 * Listeners (callbacks tipados)
 * ────────────────────────────── */

/** Recuento global de reacciones de un paw */
export function listenReactionCounts(
  animalId: string,
  cb: (counts: ReactionCountsDoc | null) => void,
): Unsub {
  const ref = countsDocRef(animalId);
  return ref.onSnapshot(
    (snap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionCountsDoc>) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const data = snap.data();
      cb({
        love: typeof data?.love === 'number' ? data.love : 0,
        sad: typeof data?.sad === 'number' ? data.sad : 0,
        match: typeof data?.match === 'number' ? data.match : 0,
        updatedAt: (data?.updatedAt ??
          nowTs()) as ReactionCountsDoc['updatedAt'],
      });
    },
  );
}

/** Reacción del usuario sobre un paw */
export function listenUserReaction(
  animalId: string,
  userId: string,
  cb: (key: FireReactionKey | null) => void,
): Unsub {
  const ref = reactionDocRef(animalId, userId);
  return ref.onSnapshot(
    (snap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionDoc>) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data();
      const k = d?.key;
      cb(
        k === 'love' || k === 'sad' || k === 'match'
          ? (k as FireReactionKey)
          : null,
      );
    },
  );
}

/** Escucha matches del usuario para la pantalla “Mis matches” */
export function listenUserMatches(
  userId: string,
  cb: (items: ReadonlyArray<UserMatchDoc & { id: string }>) => void,
  opts?: { limit?: number },
): Unsub {
  const qRef: FirebaseFirestoreTypes.Query<UserMatchDoc> = query(
    userMatchesColRef(userId),
    orderBy('createdAt', 'desc'),
    limit(typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 50),
  );

  return qRef.onSnapshot(
    (snap: FirebaseFirestoreTypes.QuerySnapshot<UserMatchDoc>) => {
      const out = snap.docs.map(
        (
          d: FirebaseFirestoreTypes.QueryDocumentSnapshot<UserMatchDoc>,
        ): UserMatchDoc & { id: string } => {
          const data = d.data();
          return { id: d.id, ...data };
        },
      );
      cb(out);
    },
  );
}

/** One-shot para obtener los matches del usuario (útil en inicialización) */
export async function listUserMatches(
  userId: string,
  opts?: { limit?: number },
): Promise<ReadonlyArray<UserMatchDoc & { id: string }>> {
  const qRef: FirebaseFirestoreTypes.Query<UserMatchDoc> = query(
    userMatchesColRef(userId),
    orderBy('createdAt', 'desc'),
    limit(typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 50),
  );
  const snap: FirebaseFirestoreTypes.QuerySnapshot<UserMatchDoc> =
    await getDocs(qRef);
  return snap.docs.map(
    (
      d: FirebaseFirestoreTypes.QueryDocumentSnapshot<UserMatchDoc>,
    ): UserMatchDoc & { id: string } => {
      const data = d.data();
      return { id: d.id, ...data };
    },
  );
}

/* ──────────────────────────────
 * Escritura con transacción
 *  - Actualiza contadores
 *  - Guarda/elimina reacción del usuario
 *  - Espejo de match:
 *      /paws/{animalId}/matches/{userId}
 *      /users/{userId}/matches/{animalId}  ← con snapshot mínimo del paw
 * ────────────────────────────── */
export async function setUserReaction(params: {
  animalId: string;
  userId: string;
  next: FireReactionKey | null;
}): Promise<void> {
  const { animalId, userId, next } = params;

  await getFirestore().runTransaction(
    async (tx: FirebaseFirestoreTypes.Transaction) => {
      const rRef = reactionDocRef(animalId, userId);
      const cRef = countsDocRef(animalId);
      const pmRef = pawMatchDocRef(animalId, userId);
      const umRef = userMatchDocRef(userId, animalId);
      const aRef = pawRef(animalId);

      // reacción previa
      const prevSnap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionDoc> =
        await tx.get(rRef);
      const prev = prevSnap.exists() ? (prevSnap.data() as ReactionDoc) : null;

      if ((prev?.key ?? null) === next) return; // no-op

      // contadores actuales
      const countsSnap: FirebaseFirestoreTypes.DocumentSnapshot<ReactionCountsDoc> =
        await tx.get(cRef);
      const base = countsSnap.exists()
        ? (countsSnap.data() as ReactionCountsDoc)
        : undefined;

      let love = (base?.love ?? 0) | 0;
      let sad = (base?.sad ?? 0) | 0;
      let match = (base?.match ?? 0) | 0;

      if (prev?.key === 'love' && love > 0) love -= 1;
      if (prev?.key === 'sad' && sad > 0) sad -= 1;
      if (prev?.key === 'match' && match > 0) match -= 1;

      if (next === 'love') love += 1;
      if (next === 'sad') sad += 1;
      if (next === 'match') match += 1;

      const now = nowTs();

      // guarda contadores
      tx.set(
        cRef,
        { love, sad, match, updatedAt: now } satisfies ReactionCountsDoc,
        { merge: true },
      );

      // guarda/elimina reacción de usuario
      if (next) {
        const payload: ReactionDoc = {
          userId,
          animalId,
          key: next,
          createdAt: (prev?.createdAt ?? now) as ReactionDoc['createdAt'],
          updatedAt: now as ReactionDoc['updatedAt'],
        };
        tx.set(rRef, payload);
      } else {
        tx.delete(rRef);
      }

      // espejo de match (ambos lados)
      const wasMatch = prev?.key === 'match';
      const willMatch = next === 'match';

      if (!wasMatch && willMatch) {
        // lado paw
        const m: MatchDoc = {
          userId,
          animalId,
          createdAt: now,
          status: 'pending',
        };
        tx.set(pmRef, m);

        // snapshot mínimo del paw para el lado usuario
        const aSnap: FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData> =
          await tx.get(aRef);
        const aData = aSnap.exists()
          ? (aSnap.data() as PawSnapshotDoc)
          : undefined;

        const paw: UserMatchAnimal = toUserMatchAnimal(aData);
        const um: UserMatchDoc = {
          animalId,
          createdAt: now,
          status: 'pending',
          paw,
        };
        tx.set(umRef, um);
      } else if (wasMatch && !willMatch) {
        tx.delete(pmRef);
        tx.delete(umRef);
      }
    },
  );
}
