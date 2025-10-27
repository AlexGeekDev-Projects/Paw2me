// src/services/userService.ts
import {
  getFirestore,
  doc as fsDoc,
  getDoc as fsGetDoc,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import { onDocSnapshot } from '@services/firebase';

export type UserMini = Readonly<{
  displayName?: string | null;
  photoURL?: string | null;
}>;

const usersCol = 'users';

export async function getUserMini(uid: string): Promise<UserMini | null> {
  const ref = fsDoc(
    getFirestore(),
    `${usersCol}/${uid}`,
  ) as FirebaseFirestoreTypes.DocumentReference<UserMini>;
  const snap = await fsGetDoc(ref);
  return (snap?.exists() ? (snap.data() as UserMini) : null) ?? null; // 👈 aquí
}

export function listenUserMini(
  uid: string,
  onChange: (u: UserMini | null) => void,
  onError?: (e: unknown) => void,
): () => void {
  const ref = fsDoc(
    getFirestore(),
    `${usersCol}/${uid}`,
  ) as FirebaseFirestoreTypes.DocumentReference<UserMini>;
  return onDocSnapshot<UserMini>(
    ref,
    ds => onChange(ds?.exists() ? ((ds.data() as UserMini) ?? null) : null), // 👈 y aquí
    onError,
  );
}
