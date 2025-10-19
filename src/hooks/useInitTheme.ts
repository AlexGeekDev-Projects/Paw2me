// src/hooks/useInitTheme.ts
import { useEffect, useState } from 'react';
import { useThemeStore } from '@store/useThemeStore';

export const useInitTheme = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    useThemeStore
      .getState()
      .init()
      .finally(() => {
        setReady(true);
      });
  }, []);

  return ready;
};
