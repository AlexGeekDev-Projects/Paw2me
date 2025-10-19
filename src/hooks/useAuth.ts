// src/hooks/useAuth.ts
import { useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';

interface AuthState {
  ready: boolean;
  isSignedIn: boolean;
  user: FirebaseAuthTypes.User | null;
  signOut: () => Promise<void>;
}

export const useAuth = (): AuthState => {
  const [state, setState] = useState<Omit<AuthState, 'signOut'>>({
    ready: false,
    isSignedIn: false,
    user: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), user => {
      setState({ ready: true, isSignedIn: !!user, user });
    });
    return unsub;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(getAuth());
    setState({ ready: true, isSignedIn: false, user: null });
  };

  return { ...state, signOut };
};
