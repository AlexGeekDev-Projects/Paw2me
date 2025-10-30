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
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import {
  Text,
  useTheme,
  Button,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

/* ────────────────────────────────────────────────────────────── */

const emptyPaw = require('@assets/empty-paw.png') as number;

const PAGE_SIZE = 24;
const LOAD_MORE_COOLDOWN_MS = 900;

const STAGGER_MAX_ITEMS = 12;
const STAGGER_STEP_MS = 55;
const STAGGER_DURATION_MS = 220;

/** Tipar navegación con el stack correcto (ExploreStack) */
type Nav = NativeStackNavigationProp<ExploreStackParamList>;

type PublicAnimalsResponse = Readonly<{
  cards: AnimalCardVM[];
  nextCursor?: string | null;
}>;

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

/* Utils para filtro local (sin acentos, minúsculas) */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/* Item animado + memo para evitar renders innecesarios */
const AnimatedCardItem: React.FC<{
  item: AnimalCardVM;
  index: number;
  onPress: (id: string) => void;
}> = memo(
  ({ item, index, onPress }) => {
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
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <AnimalCard data={item} onPress={onPress} />
      </Animated.View>
    );
  },
  (a, b) =>
    a.item.id === b.item.id &&
    (a.item as any).comments === (b.item as any).comments &&
    a.onPress === b.onPress &&
    a.index === b.index,
);

/* ────────────────────────────────────────────────────────────── */

const ExploreScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const listRef = useRef<FlatList<AnimalCardVM>>(null);

  /** Estado de datos del servidor */
  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  /** Estado de UI */
  const [loadingBootstrap, setLoadingBootstrap] = useState<boolean>(true); // solo primera carga
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false); // fetch silencioso tras cambiar filtros
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
        filters.center && typeof (filters.center as any).lat === 'number',
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

  const prefetchCoverImages = useCallback((items: AnimalCardVM[]) => {
    if (Platform.OS === 'android') return;
    const urls = items
      .map(i => (i as any).coverUrl ?? i.coverUrl)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    urls.forEach(u => {
      Image.prefetch(u).catch(() => {});
    });
  }, []);

  const enrichWithComments = useCallback(async (arr: AnimalCardVM[]) => {
    const out = await Promise.all(
      arr.map(async c => {
        try {
          const comments = await getAnimalCommentsCount(c.id);
          return { ...c, comments } as AnimalCardVM;
        } catch {
          return { ...c, comments: (c as any).comments ?? 0 } as AnimalCardVM;
        }
      }),
    );
    return out;
  }, []);

  /** Fetch primera página; con modo silencioso para no “recargar” UI */
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

        const withCounts = await enrichWithComments(res.cards);
        prefetchCoverImages(withCounts.slice(0, 8));

        setCards(withCounts);
        setCursor(res.nextCursor ?? null);
        setHasMore(Boolean(res.nextCursor));
      } finally {
        if (!silent) setLoadingBootstrap(false);
        else setSyncing(false);
      }
    },
    [buildParams, prefetchCoverImages, enrichWithComments],
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

      const withCounts = await enrichWithComments(res.cards);
      prefetchCoverImages(withCounts.slice(0, 8));

      setCards(prev => prev.concat(withCounts));
      setCursor(res.nextCursor ?? null);
      setHasMore(Boolean(res.nextCursor));
    } finally {
      setLoadingMore(false);
    }
  }, [
    cursor,
    hasMore,
    loadingMore,
    buildParams,
    prefetchCoverImages,
    enrichWithComments,
  ]);

  const handleEndReached = useCallback(() => {
    if (endReachedDuringMomentum.current) return;
    endReachedDuringMomentum.current = true;
    void fetchNextPage();
  }, [fetchNextPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage({ silent: true }); // refresh suave
    setRefreshing(false);
  }, [fetchFirstPage]);

  /* Bootstrap (primera carga con skeleton) */
  const skipNextFiltersReloadRef = useRef(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        try {
          await locateMe({ strategy: 'balanced' });
        } catch {}
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

  /* Re-aplicar cuando cambian filtros:
     - Se filtra en cliente al instante (useMemo abajo)
     - Se hace fetch silencioso con debounce (sin skeleton) */
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
      // Si quieres subir al inicio cuando cambian filtros “duros”, hazlo aquí:
      // scrollToTop();
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
      setCards(prev =>
        prev.map(c =>
          c.id === pawId
            ? ({
                ...c,
                comments: Math.max(0, ((c as any).comments ?? 0) + delta),
              } as AnimalCardVM)
            : c,
        ),
      );
    });
    return off;
  }, []);

  /* Filtrado local inmediato (sin redibujar skeleton) */
  const viewCards = useMemo(() => {
    if (!cards.length) return cards;

    const bySpecies =
      filters.species != null
        ? (x: AnimalCardVM) => (x as any).species === filters.species
        : () => true;

    const bySize =
      filters.size != null
        ? (x: AnimalCardVM) => (x as any).size === filters.size
        : () => true;

    const byUrgent = filters.urgent
      ? (x: AnimalCardVM) => !!(x as any).urgent
      : () => true;

    const byCity =
      filters.city && filters.cityWasExplicit === true
        ? (x: AnimalCardVM) =>
            norm(String((x as any).city ?? '')).includes(norm(filters.city!))
        : () => true;

    const byText =
      filters.text && filters.text.length > 0
        ? (x: AnimalCardVM) => {
            const hay =
              [
                (x as any).name,
                (x as any).title,
                (x as any).breed,
                (x as any).city,
                (x as any).description,
              ]
                .filter(Boolean)
                .map(v => norm(String(v)))
                .join(' ') || '';
            return hay.includes(norm(filters.text!));
          }
        : () => true;

    return cards.filter(
      c => bySpecies(c) && bySize(c) && byUrgent(c) && byCity(c) && byText(c),
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
    | {} = hasDistanceActive
    ? { distanceKm: filters.distanceKm!, onClearDistance: clearDistance }
    : {};

  const header = useMemo(() => {
    return (
      <View style={styles.headerWrap}>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {SPECIES_META.map(s => {
            const selected = filters.species === s.key;
            return (
              <Chip
                key={s.key}
                selected={selected}
                onPress={() => toggleSpecies(s.key)}
                icon={selected ? 'check' : s.icon}
                style={styles.chip}
              >
                {s.label}
              </Chip>
            );
          })}

          <Chip
            selected={Boolean(filters.urgent)}
            onPress={toggleUrgent}
            icon={filters.urgent ? 'check' : 'alert'}
            style={styles.chip}
          >
            Urgente
          </Chip>
        </ScrollView>

        {/* Indicador de sync en background (opcional) */}
        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.syncText}>Actualizando resultados…</Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    searchOpen,
    filters.text,
    filters.species,
    filters.urgent,
    setText,
    toggleSpecies,
    toggleUrgent,
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
    syncing,
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

  return (
    <Screen>
      <FiltersModal
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        onApply={() => {
          // No hacemos fetch aquí; el efecto con debounce se encarga.
          // Filtrado local es inmediato vía `viewCards`.
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
          ListHeaderComponent={header}
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
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          onMomentumScrollBegin={() => {
            endReachedDuringMomentum.current = false;
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 12,
            paddingBottom: 96,
          }}
          // Rendimiento / memoria:
          removeClippedSubviews={Platform.OS === 'ios'}
          windowSize={9}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={60}
          initialNumToRender={8}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerWrap: { gap: 8, marginBottom: 4 },
  chipsScroll: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingBottom: 0,
    alignItems: 'center',
    gap: 8,
  },
  chip: { marginRight: 8 },

  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
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
