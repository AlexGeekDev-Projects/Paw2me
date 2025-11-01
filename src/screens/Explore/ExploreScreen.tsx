// src/screens/ExploreScreen.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  RefreshControl,
  View,
  StyleSheet,
  Image,
  ScrollView,
  Animated,
  Platform,
  type ViewToken,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import {
  Text,
  useTheme,
  Button,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { useScrollToTop, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnimalCard from '@components/AnimalCard';
import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import ExploreTopBar from '@components/explore/ExploreTopBar';
import FiltersModal from '@components/explore/FiltersModal';

import type { AnimalCardVM, Species } from '@models/animal';
import type { ExploreStackParamList } from '@navigation/RootNavigator';

import { listAnimalsPublic } from '@services/animalsService';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
import { useUserLocation } from '@hooks/useUserLocation';

import { onAnimalCommentAdded } from '@utils/commentsEvents';
import { getCommentsCount as getAnimalCommentsCount } from '@services/animalCommentsService';

const emptyPaw = require('@assets/empty-paw.png') as number;

const PAGE_SIZE = 24;
const LOAD_MORE_COOLDOWN_MS = 900;

/** Android: desactivar stagger (costoso) */
const ENABLE_STAGGER = Platform.OS === 'ios';

/** Stagger solo para iOS */
const STAGGER_MAX_ITEMS = 12;
const STAGGER_STEP_MS = 55;
const STAGGER_DURATION_MS = 220;

/** Enriquecer solo los primeros N en la primera pintura */
const ENRICH_COMMENTS_FIRST_N = 8;

/** Throttle para onViewableItemsChanged */
const VIEWABILITY_THROTTLE_MS = 120;

/** Tuning de lista por plataforma */
const LIST_TUNING = Platform.select({
  android: {
    windowSize: 7 as const,
    maxToRenderPerBatch: 4 as const,
    updateCellsBatchingPeriod: 80 as const,
    initialNumToRender: 6 as const,
    onEndReachedThreshold: 0.5 as const,
  },
  ios: {
    windowSize: 9 as const,
    maxToRenderPerBatch: 6 as const,
    updateCellsBatchingPeriod: 60 as const,
    initialNumToRender: 8 as const,
    onEndReachedThreshold: 0.6 as const,
  },
})!;

/** Tipar navegación con el stack correcto (ExploreStack) */
type Nav = NativeStackNavigationProp<ExploreStackParamList>;

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

type ViewabilityPayload = Readonly<
  { ids: string[] } & ({ nextUrl: string } | {})
>;

const SPECIES_META: Array<{ key: Species; label: string; icon: string }> = [
  { key: 'perro', label: 'Perros', icon: 'dog' },
  { key: 'gato', label: 'Gatos', icon: 'cat' },
  { key: 'conejo', label: 'Conejos', icon: 'rabbit' },
  { key: 'ave', label: 'Aves', icon: 'bird' },
  { key: 'reptil', label: 'Reptiles', icon: 'snake' },
  { key: 'roedor', label: 'Roedores', icon: 'rodent' },
  { key: 'cerdo_mini', label: 'Mini cerdo', icon: 'pig-variant' },
  { key: 'caballo', label: 'Caballos', icon: 'horse' },
  { key: 'otro', label: 'Otros', icon: 'paw' },
];

/* Utils */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/* Item animado + memo */
const AnimatedCardItem: React.FC<{
  item: AnimalCardVM;
  index: number;
  onPress: (id: string) => void;
}> = memo(
  ({ item, index, onPress }) => {
    if (!ENABLE_STAGGER) {
      return <AnimalCard data={item} onPress={onPress} />;
    }

    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(8)).current;

    useEffect(() => {
      const delay = Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_STEP_MS;
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: STAGGER_DURATION_MS,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: STAGGER_DURATION_MS,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    }, [index, item.id, opacity, translateY]);

    return (
      <Animated.View
        style={{ opacity, transform: [{ translateY }] }}
        renderToHardwareTextureAndroid
        shouldRasterizeIOS
      >
        <AnimalCard data={item} onPress={onPress} />
      </Animated.View>
    );
  },
  (a, b) =>
    a.item.id === b.item.id &&
    ((a.item as AnimalCardVMExt).comments ?? 0) ===
      ((b.item as AnimalCardVMExt).comments ?? 0) &&
    a.onPress === b.onPress &&
    a.index === b.index,
);

/* ────────────────────────────────────────────────────────────── */

const ExploreScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const listRef = useRef<FlatList<AnimalCardVM>>(null);

  // Tap en el tab → scroll to top (sin listeners manuales)
  useScrollToTop(listRef); // ✅ FlatList cumple el contrato

  /** Estado de datos del servidor */
  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  /** Estado de UI */
  const [loadingBootstrap, setLoadingBootstrap] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [bootstrapped, setBootstrapped] = useState<boolean>(false);

  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [filtersVisible, setFiltersVisible] = useState<boolean>(false);

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

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  /** Prefetch de portadas siguientes (iOS hace mejor caching) */
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

  /** Enriquecer comentarios para un subconjunto de IDs */
  const enrichCommentsFor = useCallback(async (ids: string[]) => {
    const toFetch = ids.filter(id => !commentsCacheRef.current.has(id));
    if (toFetch.length === 0) return;
    try {
      const results = await Promise.all(
        toFetch.map(async id => {
          try {
            const n = await getAnimalCommentsCount(id);
            return [id, n] as const;
          } catch {
            return [id, 0] as const;
          }
        }),
      );
      for (const [id, n] of results) {
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

  const lastLoadMoreAtRef = useRef(0);
  const endReachedDuringMomentum = useRef(false);

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

  const handleEndReached = useCallback(() => {
    if (endReachedDuringMomentum.current) return;
    endReachedDuringMomentum.current = true;
    void fetchNextPage();
  }, [fetchNextPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage({ silent: true });
    setRefreshing(false);
  }, [fetchFirstPage]);

  /* Bootstrap */
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

  /* Re-aplicar cuando cambian filtros (debounced) */
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!bootstrapped) return;
    if (skipNextFiltersReloadRef.current) {
      skipNextFiltersReloadRef.current = false;
      return;
    }

    if (fetchDebounceRef.current) {
      clearTimeout(fetchDebounceRef.current);
    }
    fetchDebounceRef.current = setTimeout(() => {
      void fetchFirstPage({ silent: true });
      // scrollToTop(); // opcional
    }, 450);

    return () => {
      if (fetchDebounceRef.current) {
        clearTimeout(fetchDebounceRef.current);
      }
    };
  }, [filters, bootstrapped, fetchFirstPage]);

  /* Listener local de comentarios (optimista) */
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

  /* Filtrado local inmediato */
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

  const distanceProps:
    | { distanceKm: number; onClearDistance: () => void }
    | {} =
    typeof filters.distanceKm === 'number' && filters.distanceWasExplicit
      ? { distanceKm: filters.distanceKm, onClearDistance: clearDistance }
      : {};

  /* ---------- TOP BAR FIJO ---------- */
  const topActions = useMemo(
    () => (
      <SafeAreaView
        edges={['top']}
        style={{ backgroundColor: theme.colors['background'] }}
      >
        <ExploreTopBar
          searchOpen={searchOpen}
          onOpenSearch={() => setSearchOpen(true)}
          onCloseSearch={() => setSearchOpen(false)}
          onOpenMatches={() => navigation.navigate('Matches')}
          query={filters.text ?? ''}
          onCommitQuery={q => setText(q)}
          onOpenFilters={() => setFiltersVisible(true)}
          onClearFilters={clearAll}
          hasActiveFilters={hasActiveFilters}
          activeFiltersCount={activeFiltersCount}
          location={{ locating, hasCenter, ...(error ? { error } : {}) }}
          onRetryLocate={() => {
            void locateMe({ strategy: 'balanced' });
          }}
          suggestSettings={shouldSuggestSettings}
          onOpenSettings={openAppSettings}
          {...distanceProps}
        />
      </SafeAreaView>
    ),
    [
      theme.colors,
      searchOpen,
      filters.text,
      setText,
      setFiltersVisible,
      clearAll,
      hasActiveFilters,
      activeFiltersCount,
      locating,
      hasCenter,
      error,
      locateMe,
      shouldSuggestSettings,
      openAppSettings,
      distanceProps,
      navigation,
    ],
  );

  /* ---------- HEADER STICKY (chips + indicador de sync) ---------- */
  const ChipsStickyHeader = useCallback(() => {
    return (
      <View
        style={[
          styles.stickyWrap,
          {
            backgroundColor: theme.colors['background'],
            borderColor: theme.colors['outlineVariant'],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={styles.chipsScroll}
        >
          {SPECIES_META.map(s => {
            const selected = filters.species === s.key;
            return (
              <Chip
                compact
                key={s.key}
                selected={selected}
                onPress={() => toggleSpecies(s.key)}
                icon={selected ? 'check' : s.icon}
                style={[
                  styles.chip,
                  selected && {
                    backgroundColor: theme.colors['primaryContainer'],
                  },
                ]}
                textStyle={
                  selected
                    ? {
                        color: theme.colors['onPrimaryContainer'],
                        fontWeight: '700',
                      }
                    : undefined
                }
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                {s.label}
              </Chip>
            );
          })}

          <Chip
            compact
            selected={Boolean(filters.urgent)}
            onPress={toggleUrgent}
            icon={filters.urgent ? 'check' : 'alert'}
            style={[
              styles.chip,
              filters.urgent && {
                backgroundColor: theme.colors['primaryContainer'],
              },
            ]}
            textStyle={
              filters.urgent
                ? {
                    color: theme.colors['onPrimaryContainer'],
                    fontWeight: '700',
                  }
                : undefined
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: Boolean(filters.urgent) }}
          >
            Urgente
          </Chip>
        </ScrollView>

        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.syncText}>Actualizando resultados…</Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    filters.species,
    filters.urgent,
    toggleSpecies,
    toggleUrgent,
    syncing,
    theme.colors,
  ]);

  const navigationPress = useCallback(
    (id: string) => {
      navigation.navigate('AnimalDetail', { id });
    },
    [navigation],
  );

  const renderItem: ListRenderItem<AnimalCardVM> = useCallback(
    ({ item, index }) => (
      <AnimatedCardItem item={item} index={index} onPress={navigationPress} />
    ),
    [navigationPress],
  );

  // Prefetch + enriquecimiento on-demand con throttle
  const viewabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingViewableRef = useRef<ViewabilityPayload | null>(null);

  const flushViewabilityWork = useCallback(() => {
    const payload = pendingViewableRef.current;
    pendingViewableRef.current = null;
    viewabilityTimerRef.current = null;
    if (!payload) return;

    if ('nextUrl' in payload) {
      Image.prefetch(payload.nextUrl).catch(() => {});
    }
    if (payload.ids.length > 0) {
      void enrichCommentsFor(payload.ids);
    }
  }, [enrichCommentsFor]);

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: ViewToken[];
      changed: ViewToken[];
    }) => {
      const last = viewableItems[viewableItems.length - 1];
      const maybeUrl = (last?.item as AnimalCardVM | undefined)?.coverUrl;
      const ids = viewableItems
        .map(v => (v.item as AnimalCardVM).id)
        .filter(Boolean);

      const payload: ViewabilityPayload =
        typeof maybeUrl === 'string' && maybeUrl.length > 0
          ? { ids, nextUrl: maybeUrl }
          : { ids };

      pendingViewableRef.current = payload;

      if (viewabilityTimerRef.current) return;
      viewabilityTimerRef.current = setTimeout(
        flushViewabilityWork,
        VIEWABILITY_THROTTLE_MS,
      );
    },
  ).current;

  useEffect(
    () => () => {
      if (viewabilityTimerRef.current) {
        clearTimeout(viewabilityTimerRef.current);
        viewabilityTimerRef.current = null;
      }
    },
    [],
  );

  return (
    <Screen edges={[]}>
      {/* TopBar fijo respetando notch */}
      {topActions}

      <FiltersModal
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        onApply={() => {
          setFiltersVisible(false);
        }}
      />

      {loadingBootstrap ? (
        <Loading variant="skeleton-card-list" count={6} />
      ) : viewCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image
            source={emptyPaw}
            style={styles.emptyImage}
            resizeMode="contain"
          />
          <Text variant="titleMedium" style={styles.emptyText}>
            Sin huellitas por aquí…
          </Text>
          <Text variant="bodyMedium" style={styles.emptyHint}>
            Puede ser por los filtros. Restablécelos o ajusta la búsqueda.
          </Text>
          <View style={styles.emptyActions}>
            <Button
              mode="contained"
              onPress={clearAll}
              style={{ marginRight: 8 }}
            >
              Limpiar filtros
            </Button>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('CreateAnimal')}
            >
              Agregar huellita
            </Button>
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={viewCards}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ChipsStickyHeader}
          stickyHeaderIndices={[0]}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors['primary']}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={LIST_TUNING.onEndReachedThreshold}
          onMomentumScrollBegin={() => {
            endReachedDuringMomentum.current = false;
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 8,
            paddingHorizontal: 12,
            paddingBottom: 96,
          }}
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'never' : 'automatic'
          }
          scrollIndicatorInsets={{ top: 0, bottom: 64, left: 0, right: 0 }}
          removeClippedSubviews
          windowSize={LIST_TUNING.windowSize}
          maxToRenderPerBatch={LIST_TUNING.maxToRenderPerBatch}
          updateCellsBatchingPeriod={LIST_TUNING.updateCellsBatchingPeriod}
          initialNumToRender={LIST_TUNING.initialNumToRender}
          keyboardDismissMode="on-drag"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          scrollEventThrottle={16}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  /* STICKY: fondo sólido + borde + leve elevación */
  stickyWrap: {
    zIndex: 10,
    elevation: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },

  headerWrap: { gap: 8, marginBottom: 4 },
  chipsScroll: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  chip: { marginRight: 8 },

  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  syncText: { opacity: 0.7, fontSize: 12 },

  emptyContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontWeight: '600', marginBottom: 4, fontSize: 18 },
  emptyHint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
    marginBottom: 12,
  },
  emptyImage: { width: 96, height: 96, opacity: 0.3, marginBottom: 16 },
  emptyActions: { flexDirection: 'row' },
  footer: { paddingVertical: 16 },
});

export default ExploreScreen;
