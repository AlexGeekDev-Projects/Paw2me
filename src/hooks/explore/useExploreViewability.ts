// src/hooks/explore/useExploreViewability.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, InteractionManager, Platform } from 'react-native';
import type { ViewToken } from 'react-native';
import type { AnimalCardVM } from '@models/animal';

const VIEWABILITY_THROTTLE_MS = 120;

export type UseExploreViewabilityOpts = {
  onEnrich: (ids: string[]) => void | Promise<void>;
};

export const useExploreViewability = ({
  onEnrich,
}: UseExploreViewabilityOpts) => {
  const [visibleMap, setVisibleMap] = useState<Record<string, true>>({});
  const [version, setVersion] = useState(0);

  const lastVisibleIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<{ ids: string[]; nextUrl?: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const applyVisibleMap = useCallback((ids: Set<string>) => {
    setVisibleMap(prev => {
      if (prev && Object.keys(prev).length === ids.size) {
        let same = true;
        for (const id of ids) {
          if (!prev[id]) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      const next: Record<string, true> = {};
      ids.forEach(id => {
        next[id] = true as const;
      });
      return next;
    });
    setVersion(v => v + 1); // fuerza re-render en Android
  }, []);

  const flush = useCallback(() => {
    const payload = pendingRef.current;
    pendingRef.current = null;
    if (!payload) return;

    const run = () => {
      if (payload.nextUrl) {
        Image.prefetch(payload.nextUrl).catch(() => {});
      }
      if (payload.ids.length) {
        void onEnrich(payload.ids);
      }
    };

    if (Platform.OS === 'android') {
      InteractionManager.runAfterInteractions(run);
    } else {
      run();
    }
  }, [onEnrich]);

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: ViewToken[];
      changed: ViewToken[];
    }) => {
      const ids = viewableItems
        .filter(v => v.isViewable)
        .map(v => (v.item as AnimalCardVM).id)
        .filter(Boolean);

      const last = viewableItems[viewableItems.length - 1];
      const nextUrl = (last?.item as AnimalCardVM | undefined)?.coverUrl;

      const nextSet = new Set(ids);
      const prevSet = lastVisibleIdsRef.current;

      let changedSet = nextSet.size !== prevSet.size;
      if (!changedSet) {
        for (const id of nextSet) {
          if (!prevSet.has(id)) {
            changedSet = true;
            break;
          }
        }
      }
      if (changedSet) {
        lastVisibleIdsRef.current = nextSet;
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          applyVisibleMap(nextSet);
          rafRef.current = null;
        });
      }

      pendingRef.current = {
        ids,
        ...(typeof nextUrl === 'string' && nextUrl.length > 0
          ? { nextUrl }
          : {}),
      };

      if (timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        flush();
      }, VIEWABILITY_THROTTLE_MS);
    },
  ).current;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { onViewableItemsChanged, visibleMap, version };
};
