import { useEffect, useState } from 'react';
import type { UserMini } from '@services/userService';
import { listenUserMini } from '@services/userService';

export function useUserMini(uid?: string | null) {
  const [user, setUser] = useState<UserMini | null>(null);

  useEffect(() => {
    if (!uid) {
      setUser(null);
      return;
    }
    const off = listenUserMini(uid, setUser, () => setUser(null));
    return off;
  }, [uid]);

  return user;
}
