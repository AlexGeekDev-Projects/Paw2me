// src/services/firebase.ts
import { getApp } from '@react-native-firebase/app';

// Firestore (modular)
import * as FS from '@react-native-firebase/firestore';
import {
  getFirestore,
  serverTimestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getCountFromServer,
  runTransaction,
  type FirebaseFirestoreTypes,
  deleteDoc,
} from '@react-native-firebase/firestore';

// Auth / Storage (alias para evitar colisiones de nombre)
import {
  getAuth as rnGetAuth,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';
import {
  getStorage as rnGetStorage,
  type FirebaseStorageTypes,
} from '@react-native-firebase/storage';

type DocumentData = FirebaseFirestoreTypes.DocumentData;

/** addDoc compatible (RNFirebase modular o fallback .add) */
export const addDoc = <T extends DocumentData>(
  col: FirebaseFirestoreTypes.CollectionReference<T>,
  data: T,
) => {
  const maybe = (FS as any).addDoc;
  if (typeof maybe === 'function') return maybe(col as any, data as any);
  return (col as any).add(data);
};

/** updateDoc compatible */
export const updateDoc = <T extends DocumentData>(
  ref: FirebaseFirestoreTypes.DocumentReference<T>,
  data: Partial<T>,
) => {
  const maybe = (FS as any).updateDoc;
  if (typeof maybe === 'function') return maybe(ref as any, data as any);
  return (ref as any).update(data);
};

/** onSnapshot para Query: nunca pasa null al callback */
export function onQuerySnapshot<T extends DocumentData>(
  q: FirebaseFirestoreTypes.Query<T>,
  onNext: (ss: FirebaseFirestoreTypes.QuerySnapshot<T>) => void,
  onError?: (e: unknown) => void,
): () => void {
  const mod = (FS as any).onSnapshot;
  if (typeof mod === 'function') {
    return mod(
      q,
      (snap: any) => onNext(snap as FirebaseFirestoreTypes.QuerySnapshot<T>),
      onError,
    );
  }
  const anyQ: any = q as any;
  if (typeof anyQ?.onSnapshot === 'function') {
    const unsub = anyQ.onSnapshot(
      (snap: any) => onNext(snap as FirebaseFirestoreTypes.QuerySnapshot<T>),
      (err: any) => onError?.(err),
    );
    return () => unsub?.();
  }
  throw new Error('onQuerySnapshot not available.');
}

/** onSnapshot para Document: nunca pasa null al callback */
export function onDocSnapshot<T extends DocumentData>(
  ref: FirebaseFirestoreTypes.DocumentReference<T>,
  onNext: (ds: FirebaseFirestoreTypes.DocumentSnapshot<T>) => void,
  onError?: (e: unknown) => void,
): () => void {
  const mod = (FS as any).onSnapshot;
  if (typeof mod === 'function') {
    return mod(
      ref,
      (snap: any) => onNext(snap as FirebaseFirestoreTypes.DocumentSnapshot<T>),
      onError,
    );
  }
  const anyRef: any = ref as any;
  if (typeof anyRef?.onSnapshot === 'function') {
    const unsub = anyRef.onSnapshot(
      (snap: any) => onNext(snap as FirebaseFirestoreTypes.DocumentSnapshot<T>),
      (err: any) => onError?.(err),
    );
    return () => unsub?.();
  }
  throw new Error('onDocSnapshot not available.');
}

// Re-exports de Firestore (modular)
export {
  getApp,
  getFirestore,
  serverTimestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  onSnapshot,
  getCountFromServer,
  runTransaction,
  type FirebaseFirestoreTypes,
};

// ✅ Wrappers MODULARES (sin colisión de nombre y sin API namespaced)
export const getAuth = (): FirebaseAuthTypes.Module => rnGetAuth(getApp());
export const getStorage = (): FirebaseStorageTypes.Module =>
  rnGetStorage(getApp());

// Helpers
export const nowTs = () => serverTimestamp();
export const newId = (collectionPath: string) =>
  doc(collection(getFirestore(), collectionPath)).id;
