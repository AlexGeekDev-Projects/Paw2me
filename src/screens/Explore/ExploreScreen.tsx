import React, {
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
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import {
  Text,
  useTheme,
  Button,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import AnimalCard from '@components/AnimalCard';
import type { AnimalCardVM, Species } from '@models/animal';
import { listAnimalsPublic } from '@services/animalsService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import ExploreTopBar from '@components/explore/ExploreTopBar';
import FiltersModal from '@components/explore/FiltersModal';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
import { useUserLocation } from '@hooks/useUserLocation';

const emptyPaw = require('@assets/empty-paw.png') as number;

const PAGE_SIZE = 24;
const LOAD_MORE_COOLDOWN_MS = 900;

const STAGGER_MAX_ITEMS = 12;
const STAGGER_STEP_MS = 55;
const STAGGER_DURATION_MS = 220;

type NavParamList = RootStackParamList & { AnimalDetail: { id: string } };
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

const AnimatedCardItem: React.FC<{
  item: AnimalCardVM;
  index: number;
  onPress: (id: string) => void;
}> = ({ item, index, onPress }) => {
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
};

const ExploreScreen: React.FC = () => {
  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<NavParamList>>();
  const listRef = useRef<FlatList<AnimalCardVM>>(null);

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

  const skipNextFiltersReloadRef = useRef(false);

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
    const urls = items
      .map(i => i.coverUrl)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    urls.forEach(u => {
      Image.prefetch(u).catch(() => {});
    });
  }, []);

  const fetchFirstPage = useCallback(
    async (override?: Parameters<typeof listAnimalsPublic>[0]) => {
      setLoading(true);
      try {
        const res = (await listAnimalsPublic({
          limit: PAGE_SIZE,
          ...buildParams(),
          ...(override ?? {}),
        })) as PublicAnimalsResponse;

        prefetchCoverImages(res.cards);
        setCards(res.cards);
        setCursor(res.nextCursor ?? null);
        setHasMore(Boolean(res.nextCursor));
      } finally {
        setLoading(false);
      }
    },
    [buildParams, prefetchCoverImages],
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

      prefetchCoverImages(res.cards);
      setCards(prev => prev.concat(res.cards));
      setCursor(res.nextCursor ?? null);
      setHasMore(Boolean(res.nextCursor));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, buildParams, prefetchCoverImages]);

  const handleEndReached = useCallback(() => {
    if (endReachedDuringMomentum.current) return;
    endReachedDuringMomentum.current = true;
    void fetchNextPage();
  }, [fetchNextPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage();
    setRefreshing(false);
  }, [fetchFirstPage]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        try {
          await locateMe({ strategy: 'balanced' });
        } catch {}
        restoreFromLastApplied();
        skipNextFiltersReloadRef.current = true;
        await fetchFirstPage();
      } finally {
        if (alive) setBootstrapped(true);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (skipNextFiltersReloadRef.current) {
      skipNextFiltersReloadRef.current = false;
      return;
    }
    void (async () => {
      await fetchFirstPage();
      scrollToTop();
    })();
  }, [filters, bootstrapped, fetchFirstPage, scrollToTop]);

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
          {SPECIES_META.map(s => (
            <Chip
              key={s.key}
              selected={filters.species === s.key}
              onPress={() => toggleSpecies(s.key)}
              icon={s.icon}
              style={styles.chip}
            >
              {s.label}
            </Chip>
          ))}
          <Chip
            selected={Boolean(filters.urgent)}
            onPress={toggleUrgent}
            icon="alert"
            style={styles.chip}
          >
            Urgente
          </Chip>
        </ScrollView>
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
  ]);

  const navigationPress = useCallback(
    (id: string) => navigation.navigate('AnimalDetail', { id }),
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
        onApply={() => void fetchFirstPage()}
      />

      {loading ? (
        <Loading variant="skeleton-card-list" count={6} />
      ) : cards.length === 0 ? (
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
          data={cards}
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
          removeClippedSubviews
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerWrap: { gap: 8, marginBottom: 8 },
  chipsScroll: { paddingVertical: 4, paddingRight: 8, alignItems: 'center' },
  chip: { marginRight: 8 },
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
