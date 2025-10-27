import { useEffect, useState } from 'react';
import {
  getFirestore,
  doc as fsDoc,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import { onDocSnapshot } from '@services/firebase';

type UserLiteFS = Readonly<{
  displayName?: string | null;
  name?: string | null;
  photoURL?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null;
}>;

export function useUserLite(uid?: string | null) {
  const [name, setName] = useState<string>('Usuario');
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!uid);

  useEffect(() => {
    if (!uid) {
      setName('Usuario');
      setPhotoURL(null);
      setLoading(false);
      return;
    }
    const ref = fsDoc(
      getFirestore(),
      `users/${uid}`,
    ) as FirebaseFirestoreTypes.DocumentReference<UserLiteFS>;

    const off = onDocSnapshot<UserLiteFS>(
      ref,
      snap => {
        const d = snap?.data();
        const n = d?.displayName?.trim() || d?.name?.trim() || 'Usuario';
        const p = d?.photoURL || d?.photoUrl || d?.avatarUrl || null;
        setName(n);
        setPhotoURL(p && String(p).length > 4 ? p : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return off;
  }, [uid]);

  return { name, photoURL, loading };
}
