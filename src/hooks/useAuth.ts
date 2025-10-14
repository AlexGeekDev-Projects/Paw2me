import { useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  type FirebaseAuthTypes,
} from '@react-native-firebase/auth';

interface AuthState {
  ready: boolean;
  isSignedIn: boolean;
  user: FirebaseAuthTypes.User | null;
}

export const useAuth = (): AuthState => {
  const [state, setState] = useState<AuthState>({
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

  return state;
};
