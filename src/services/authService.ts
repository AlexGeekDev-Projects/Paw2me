import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export type Role = 'user' | 'shelter' | 'moderator' | 'admin';

export interface UserDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | undefined;
  role: Role;
  age?: number | undefined;
  bio?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  location?:
    | { country?: string | undefined; city?: string | undefined }
    | undefined;

  createdAt?: FirebaseFirestoreTypes.FieldValue | number | null | undefined;
  updatedAt?: FirebaseFirestoreTypes.FieldValue | number | null | undefined;
}

const makeDefaultUser = (
  u: FirebaseAuthTypes.User,
): Omit<UserDoc, 'createdAt' | 'updatedAt'> => ({
  uid: u.uid,
  email: u.email ?? '',
  displayName: u.displayName ?? '',
  photoURL: u.photoURL ?? undefined,
  role: 'user',
  age: undefined,
  bio: '',
  phone: '',
  website: '',
  location: {},
});

export const ensureUserDoc = async (u: FirebaseAuthTypes.User) => {
  const db = getFirestore();
  const ref = doc(db, 'users', u.uid);
  await setDoc(
    ref,
    {
      ...makeDefaultUser(u),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Partial<UserDoc>,
    { merge: true },
  );
};

export const signUpEmail = async (email: string, password: string) => {
  const auth = getAuth();
  const creds = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(creds.user);
  return creds.user;
};

export const signInEmail = async (email: string, password: string) => {
  const auth = getAuth();
  const creds = await signInWithEmailAndPassword(auth, email, password);
  return creds.user;
};

export const resetPassword = async (email: string) =>
  sendPasswordResetEmail(getAuth(), email);
export const signOutSession = async () => signOut(getAuth());
