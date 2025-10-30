// src/hooks/useUserLite.ts
import { useEffect, useState } from 'react';
import {
  getFirestore,
  doc as fsDoc,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import { onDocSnapshot } from '@services/firebase';

type UserLiteFS = Readonly<{
  displayName?: string | null;
  display_name?: string | null;
  name?: string | null;
  username?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;

  photoURL?: string | null;
  photoUrl?: string | null;
  avatarUrl?: string | null;
  avatarURL?: string | null;
}>;

function pickName(d?: UserLiteFS | null): string {
  if (!d) return 'Usuario';
  const parts: string[] = [];

  // preferencia por displayName/name/username/fullName...
  const s =
    d.displayName?.trim() ||
    d.display_name?.trim() ||
    d.name?.trim() ||
    d.username?.trim() ||
    d.fullName?.trim();

  if (s) return s;

  const f = d.firstName?.trim();
  const l = d.lastName?.trim();
  if (f) parts.push(f);
  if (l) parts.push(l);

  const joined = parts.join(' ').trim();
  return joined.length > 0 ? joined : 'Usuario';
}

function pickPhoto(d?: UserLiteFS | null): string | null {
  if (!d) return null;
  const p = d.photoURL || d.photoUrl || d.avatarUrl || d.avatarURL || null;
  return p && String(p).length > 4 ? String(p) : null;
}

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

    // ⚠️ usar segmentos en lugar de "users/${uid}"
    const ref = fsDoc(
      getFirestore(),
      'users',
      uid,
    ) as FirebaseFirestoreTypes.DocumentReference<UserLiteFS>;

    const off = onDocSnapshot<UserLiteFS>(
      ref,
      snap => {
        const d = snap?.data();
        setName(pickName(d));
        setPhotoURL(pickPhoto(d));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return off;
  }, [uid]);

  return { name, photoURL, loading };
}
