// src/services/firebase.ts
import { getApp } from '@react-native-firebase/app';
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
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { getStorage } from '@react-native-firebase/storage';

// Re-export modular APIs que ya usas
export {
  getApp,
  getAuth,
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
  getStorage,
  type FirebaseFirestoreTypes,
};

// Timestamp helper “ahora”
export const nowTs = () => serverTimestamp();

// Generador de IDs para una colección
export const newId = (collectionPath: string) =>
  doc(collection(getFirestore(), collectionPath)).id;
