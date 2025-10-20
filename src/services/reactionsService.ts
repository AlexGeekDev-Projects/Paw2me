// src/services/reactionsService.ts
import {
  getFirestore,
  doc,
  collection,
  setDoc,
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

type Unsub = () => void;

// ——— refs
const pawRef = (animalId: string) => doc(getFirestore(), 'paws', animalId);

const subCol = (
  parent: FirebaseFirestoreTypes.DocumentReference<FirebaseFirestoreTypes.DocumentData>,
  name: string,
) => collection(parent, name);

const reactionDocRef = (animalId: string, userId: string) =>
  doc(subCol(pawRef(animalId), 'reactions'), userId);

const countsDocRef = (animalId: string) =>
  doc(subCol(pawRef(animalId), 'meta'), 'reactionCounts');

const matchDocRef = (animalId: string, userId: string) =>
  doc(subCol(pawRef(animalId), 'matches'), userId);

// ——— listeners con null-guard
export function listenReactionCounts(
  animalId: string,
  cb: (counts: ReactionCountsDoc | null) => void,
): Unsub {
  const ref = countsDocRef(animalId);
  return ref.onSnapshot(
    (
      snap: FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData> | null,
    ) => {
      if (!snap || !snap.exists()) {
        cb(null);
        return;
      }
      const data = snap.data() as Partial<ReactionCountsDoc> | undefined;
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

export function listenUserReaction(
  animalId: string,
  userId: string,
  cb: (key: FireReactionKey | null) => void,
): Unsub {
  const ref = reactionDocRef(animalId, userId);
  return ref.onSnapshot(
    (
      snap: FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData> | null,
    ) => {
      if (!snap || !snap.exists()) {
        cb(null);
        return;
      }
      const d = snap.data() as { key?: unknown } | undefined;
      const k = d?.key;
      cb(
        k === 'love' || k === 'sad' || k === 'match'
          ? (k as FireReactionKey)
          : null,
      );
    },
  );
}

// ——— write/txn con null-guard
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
      const mRef = matchDocRef(animalId, userId);

      const prevSnap = (await tx.get(
        rRef,
      )) as FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData> | null;

      const countsSnap = (await tx.get(
        cRef,
      )) as FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData> | null;

      const prev =
        prevSnap && prevSnap.exists() ? (prevSnap.data() as ReactionDoc) : null;

      if ((prev?.key ?? null) === next) return;

      const base =
        countsSnap && countsSnap.exists()
          ? (countsSnap.data() as Partial<ReactionCountsDoc>)
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

      tx.set(
        cRef,
        {
          love,
          sad,
          match,
          updatedAt: now,
        } as ReactionCountsDoc,
        { merge: true },
      );

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

      const wasMatch = prev?.key === 'match';
      const willMatch = next === 'match';
      if (!wasMatch && willMatch) {
        const m: MatchDoc = { userId, animalId, createdAt: now };
        tx.set(mRef, m);
      } else if (wasMatch && !willMatch) {
        tx.delete(mRef);
      }
    },
  );
}
