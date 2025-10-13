// src/services/firebaseSanity.ts
// TS estricto, sin any, y sin app()
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

type SanityInfo = {
  hasAuth: boolean;
  hasFirestore: boolean;
  hasStorage: boolean;
  uid: string | null;
};

export const firebaseSanityCheck = async (): Promise<SanityInfo> => {
  // Instanciar módulos (no hace red solo por instanciar)
  const db = firestore();
  const st = storage();

  // Sign-in anónimo temporal para validar Auth (puedes quitarlo luego)
  await auth().signInAnonymously();
  const uid = auth().currentUser ? auth().currentUser!.uid : null;

  return {
    hasAuth: true,
    hasFirestore: !!db,
    hasStorage: !!st,
    uid,
  };
};
