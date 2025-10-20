import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from 'firebase/firestore';

export type FireReactionKey = 'love' | 'sad' | 'match';

export type ReactionDoc = Readonly<{
  userId: string;
  animalId: string;
  key: FireReactionKey;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}>;

export type ReactionCountsDoc = Readonly<{
  love: number;
  sad: number;
  match: number;
  updatedAt: Timestamp;
}>;

export type MatchDoc = Readonly<{
  userId: string;
  animalId: string;
  createdAt: Timestamp;
  // Espacio para datos extra (contacto, estado, etc.)
  status?: 'pending' | 'contacted' | 'closed';
}>;

export const reactionConverter: FirestoreDataConverter<ReactionDoc> = {
  toFirestore: d => d,
  fromFirestore: (snap: QueryDocumentSnapshot, _opt: SnapshotOptions) =>
    snap.data() as ReactionDoc,
};

export const reactionCountsConverter: FirestoreDataConverter<ReactionCountsDoc> =
  {
    toFirestore: d => d,
    fromFirestore: (snap, _opt) => snap.data() as ReactionCountsDoc,
  };

export const matchConverter: FirestoreDataConverter<MatchDoc> = {
  toFirestore: d => d,
  fromFirestore: (snap, _opt) => snap.data() as MatchDoc,
};
