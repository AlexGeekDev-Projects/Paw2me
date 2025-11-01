// src/hooks/explore/useExploreData.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Image } from 'react-native';
import { listAnimalsPublic } from '@services/animalsService';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
import { useUserLocation } from '@hooks/useUserLocation';
import { onAnimalCommentAdded } from '@utils/commentsEvents';
import { getCommentsCount as getAnimalCommentsCount } from '@services/animalCommentsService';
import type { AnimalCardVM } from '@models/animal';

type PublicAnimalsResponse = Readonly<{
  cards: AnimalCardVM[];
  nextCursor?: string | null;
}>;

type AnimalCardVMExt = AnimalCardVM &
  Partial<{
    comments: number;
    size: string;
    title: string;
    breed: string;
    description: string;
  }>;

const PAGE_SIZE = 24;
const ENRICH_COMMENTS_FIRST_N = 8;
const LOAD_MORE_COOLDOWN_MS = 900;

/** Hook principal de datos para Explore/galerías públicas */
export const useExploreData = () => {
  const {
    filters,
    setText,
    toggleSpecies,
    toggleUrgent,
    buildParams,
    clearAll,
    clearDistance,
    restoreFromLastApplied,
  } = useExploreFiltersStore();

  const { locating, error, locateMe, shouldSuggestSettings, openAppSettings } =
    useUserLocation();

  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [loadingBootstrap, setLoadingBootstrap] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [bootstrapped, setBootstrapped] = useState<boolean>(false);

  /** Prefetch de portadas (iOS mejora el cache) */
  const prefetchCoverImages = useCallback((items: AnimalCardVM[]) => {
    if (Platform.OS === 'android') return;
    const urls = items
      .map(i => i.coverUrl)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    urls.forEach(u => {
      Image.prefetch(u).catch(() => {});
    });
  }, []);

  /** Cache local de comentarios */
  const commentsCacheRef = useRef<Map<string, number>>(new Map());

  /** Enriquecer comentarios para subconjunto de IDs */
  const enrichCommentsFor = useCallback(async (ids: string[]) => {
    const toFetch = ids.filter(id => !commentsCacheRef.current.has(id));
    if (toFetch.length === 0) return;
    try {
      const pairs = await Promise.all(
        toFetch.map(async id => {
          try {
            const n = await getAnimalCommentsCount(id);
            return [id, n] as const;
          } catch {
            return [id, 0] as const;
          }
        }),
      );
      for (const [id, n] of pairs) {
        commentsCacheRef.current.set(id, n);
      }
      setCards(prev =>
        prev.map(c =>
          commentsCacheRef.current.has(c.id)
            ? ({
                ...(c as AnimalCardVMExt),
                comments: commentsCacheRef.current.get(c.id)!,
              } as AnimalCardVM)
            : c,
        ),
      );
    } catch {
      // silencioso
    }
  }, []);

  /** Primera página */
  const fetchFirstPage = useCallback(
    async (opts?: {
      override?: Parameters<typeof listAnimalsPublic>[0];
      silent?: boolean;
    }) => {
      const silent = Boolean(opts?.silent);
      if (!silent) setLoadingBootstrap(true);
      else setSyncing(true);

      try {
        const res = (await listAnimalsPublic({
          limit: PAGE_SIZE,
          ...buildParams(),
          ...(opts?.override ?? {}),
        })) as PublicAnimalsResponse;

        setCards(res.cards);
        setCursor(res.nextCursor ?? null);
        setHasMore(Boolean(res.nextCursor));

        prefetchCoverImages(res.cards.slice(0, 8));
        void enrichCommentsFor(
          res.cards.slice(0, ENRICH_COMMENTS_FIRST_N).map(c => c.id),
        );
      } finally {
        if (!silent) setLoadingBootstrap(false);
        else setSyncing(false);
      }
    },
    [buildParams, prefetchCoverImages, enrichCommentsFor],
  );

  /** Paginación */
  const lastLoadMoreAtRef = useRef(0);
  const fetchNextPage = useCallback(async () => {
    const now = Date.now();
    if (!hasMore || loadingMore) return;
    if (now - lastLoadMoreAtRef.current < LOAD_MORE_COOLDOWN_MS) return;

    lastLoadMoreAtRef.current = now;
    setLoadingMore(true);
    try {
      const res = (await listAnimalsPublic({
        limit: PAGE_SIZE,
        ...(cursor ? { after: cursor } : {}),
        ...buildParams(),
      })) as PublicAnimalsResponse;

      setCards(prev => prev.concat(res.cards));
      setCursor(res.nextCursor ?? null);
      setHasMore(Boolean(res.nextCursor));

      prefetchCoverImages(res.cards.slice(0, 8));
      void enrichCommentsFor(
        res.cards.slice(0, ENRICH_COMMENTS_FIRST_N).map(c => c.id),
      );
    } finally {
      setLoadingMore(false);
    }
  }, [
    cursor,
    hasMore,
    loadingMore,
    buildParams,
    prefetchCoverImages,
    enrichCommentsFor,
  ]);

  /** End reached (protegido contra momentum) */
  const endReachedDuringMomentum = useRef(false);
  const handleEndReached = useCallback(() => {
    if (endReachedDuringMomentum.current) return;
    endReachedDuringMomentum.current = true;
    void fetchNextPage();
  }, [fetchNextPage]);

  const onMomentumScrollBegin = useCallback(() => {
    endReachedDuringMomentum.current = false;
  }, []);

  /** Pull-to-refresh */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage({ silent: true });
    setRefreshing(false);
  }, [fetchFirstPage]);

  /** Bootstrap inicial */
  const skipNextFiltersReloadRef = useRef(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        void locateMe({ strategy: 'balanced' }).catch(() => {});
        restoreFromLastApplied();
        skipNextFiltersReloadRef.current = true;
        await fetchFirstPage({ silent: false });
      } finally {
        if (alive) setBootstrapped(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Re-aplicar cuando cambian filtros (debounced) */
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!bootstrapped) return;
    if (skipNextFiltersReloadRef.current) {
      skipNextFiltersReloadRef.current = false;
      return;
    }
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      void fetchFirstPage({ silent: true });
    }, 450);
    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, [filters, bootstrapped, fetchFirstPage]);

  /** Listener optimista de comentarios */
  useEffect(() => {
    const off = onAnimalCommentAdded(({ pawId, delta = 1 }) => {
      const prev = commentsCacheRef.current.get(pawId) ?? 0;
      commentsCacheRef.current.set(pawId, Math.max(0, prev + delta));
      setCards(prevCards =>
        prevCards.map(c =>
          c.id === pawId
            ? ({
                ...(c as AnimalCardVMExt),
                comments: commentsCacheRef.current.get(c.id),
              } as AnimalCardVM)
            : c,
        ),
      );
    });
    return off;
  }, []);

  /** Helpers de UI (filtros activos) */
  const hasCenter = useMemo(
    () =>
      Boolean(
        filters.center &&
          typeof (filters.center as unknown as { lat?: number }).lat ===
            'number',
      ),
    [filters.center],
  );

  const hasDistanceActive = useMemo(
    () =>
      typeof filters.distanceKm === 'number' &&
      filters.distanceWasExplicit === true,
    [filters.distanceKm, filters.distanceWasExplicit],
  );

  const hasCityActive = useMemo(
    () => Boolean(filters.city) && filters.cityWasExplicit === true,
    [filters.city, filters.cityWasExplicit],
  );

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.species ||
          filters.size ||
          hasCityActive ||
          filters.urgent ||
          filters.text ||
          hasDistanceActive,
      ),
    [
      filters.species,
      filters.size,
      hasCityActive,
      filters.urgent,
      filters.text,
      hasDistanceActive,
    ],
  );

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filters.species) n++;
    if (filters.size) n++;
    if (hasCityActive) n++;
    if (filters.urgent) n++;
    if (filters.text) n++;
    if (hasDistanceActive) n++;
    return n;
  }, [
    filters.species,
    filters.size,
    hasCityActive,
    filters.urgent,
    filters.text,
    hasDistanceActive,
  ]);

  /** Filtrado local inmediato (client-side) */
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  const viewCards = useMemo(() => {
    if (!cards.length) return cards;

    const bySpecies =
      filters.species != null
        ? (x: AnimalCardVM) => x.species === filters.species
        : () => true;

    const bySize =
      filters.size != null
        ? (x: AnimalCardVMExt) => x.size === filters.size
        : () => true;

    const byUrgent = filters.urgent
      ? (x: AnimalCardVMExt) => Boolean(x.urgent)
      : () => true;

    const byCity =
      filters.city && filters.cityWasExplicit === true
        ? (x: AnimalCardVMExt) =>
            norm(String(x.city ?? '')).includes(norm(filters.city!))
        : () => true;

    const byText =
      filters.text && filters.text.length > 0
        ? (x: AnimalCardVMExt) => {
            const hay = [x.name, x.title, x.breed, x.city, x.description]
              .filter(Boolean)
              .map(v => norm(String(v)))
              .join(' ');
            return hay.includes(norm(filters.text!));
          }
        : () => true;

    return cards.filter(
      c =>
        bySpecies(c) &&
        bySize(c as AnimalCardVMExt) &&
        byUrgent(c as AnimalCardVMExt) &&
        byCity(c as AnimalCardVMExt) &&
        byText(c as AnimalCardVMExt),
    );
  }, [
    cards,
    filters.species,
    filters.size,
    filters.urgent,
    filters.city,
    filters.cityWasExplicit,
    filters.text,
  ]);

  /** Props útiles para la barra */
  const distanceProps:
    | { distanceKm: number; onClearDistance: () => void }
    | {} =
    typeof filters.distanceKm === 'number' && filters.distanceWasExplicit
      ? { distanceKm: filters.distanceKm, onClearDistance: clearDistance }
      : {};

  return {
    // data
    cards,
    viewCards,
    hasMore,
    loadingBootstrap,
    loadingMore,
    refreshing,
    syncing,
    // pagination/refresh
    handleEndReached,
    onMomentumScrollBegin,
    onRefresh,
    fetchFirstPage,
    enrichCommentsFor,
    // filters + location
    filters,
    setText,
    toggleSpecies,
    toggleUrgent,
    clearAll,
    distanceProps,
    locating,
    error,
    hasCenter,
    hasActiveFilters,
    activeFiltersCount,
    locateMe,
    shouldSuggestSettings,
    openAppSettings,
  };
};
