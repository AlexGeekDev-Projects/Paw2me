// src/services/authService.ts
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
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
  role: Role;

  fullName?: string;
  username?: string;
  bio?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  website?: string;
  location?: {
    country?: string;
    city?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  shelterName?: string;
  shelterVerified?: boolean;
  shelterDescription?: string;
  verifiedEmail: boolean;
  acceptedTerms?: boolean;
  receiveNotifications?: boolean;
  createdAt?: FirebaseFirestoreTypes.FieldValue;
  updatedAt?: FirebaseFirestoreTypes.FieldValue;
}

const makeDefaultUser = (
  u: FirebaseAuthTypes.User,
): Omit<UserDoc, 'createdAt' | 'updatedAt'> => ({
  uid: u.uid,
  email: u.email ?? '',
  displayName: u.displayName ?? '',
  role: 'user',
  verifiedEmail: !!u.emailVerified,
  fullName: '',
  username: '',
  bio: '',
  receiveNotifications: true,
});

export const signUpEmail = async (
  email: string,
  password: string,
  fullName?: string,
  username?: string,
) => {
  const auth = getAuth();
  const creds = await createUserWithEmailAndPassword(auth, email, password);

  // 🔒 Espera a que la sesión esté propagada antes de escribir
  await new Promise<FirebaseAuthTypes.User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user?.uid === creds.user.uid) {
        unsub();
        resolve(user);
      }
    });
    // Optional: fallback timeout
    setTimeout(
      () => reject(new Error('Timeout esperando autenticación')),
      3000,
    );
  });

  const userDoc: Omit<UserDoc, 'createdAt' | 'updatedAt'> = {
    ...makeDefaultUser(creds.user),
    fullName: fullName ?? '',
    username: username ?? '',
  };

  const db = getFirestore();
  const ref = doc(db, 'users', creds.user.uid);

  await setDoc(ref, {
    ...userDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies UserDoc);

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
