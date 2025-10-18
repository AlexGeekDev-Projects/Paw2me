// src/screens/Explore/ExploreScreen.tsx
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
import type { AnimalCardVM } from '@models/animal';
import { listAnimalsPublic } from '@services/animalsService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import ExploreTopBar from '@components/explore/ExploreTopBar';
import FiltersModal from '@components/explore/FiltersModal';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const emptyPaw = require('@assets/empty-paw.png') as number;

const PAGE_SIZE = 24;
type NavParamList = RootStackParamList & { AnimalDetail: { id: string } };
type PublicAnimalsResponse = Readonly<{
  cards: AnimalCardVM[];
  nextCursor?: string | null;
}>;

const ExploreScreen: React.FC = () => {
  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<NavParamList>>();
  const listRef = useRef<FlatList<AnimalCardVM>>(null);

  const { filters, setText, toggleSpecies, toggleUrgent, buildParams } =
    useExploreFiltersStore();

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await listAnimalsPublic({
        limit: PAGE_SIZE,
        ...buildParams(),
      })) as PublicAnimalsResponse;
      setCards(res.cards);
      setCursor(res.nextCursor ?? null);
      setHasMore(Boolean(res.nextCursor));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const fetchNextPage = useCallback(async () => {
    if (!hasMore || loadingMore) return;
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
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, buildParams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage();
    setRefreshing(false);
  }, [fetchFirstPage]);

  // Cargar inicial y recargar al cambiar filtros
  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);
  useEffect(() => {
    void (async () => {
      await fetchFirstPage();
      scrollToTop();
    })();
  }, [filters, fetchFirstPage, scrollToTop]);

  // Header con título, icono de filtros (abre modal) y lupa (abre búsqueda)
  const header = useMemo(
    () => (
      <View style={styles.headerWrap}>
        <ExploreTopBar
          searchOpen={searchOpen}
          onOpenSearch={() => setSearchOpen(true)}
          onCloseSearch={() => setSearchOpen(false)}
          query={filters.text ?? ''}
          onChangeQuery={setText}
          onOpenFilters={() => setFiltersVisible(true)}
        />

        {/* Accesos rápidos (opcionales) */}
        <View style={styles.chipsRow}>
          <Chip
            selected={filters.species === 'perro'}
            onPress={() => toggleSpecies('perro')}
            icon="dog"
            style={styles.chip}
          >
            Perros
          </Chip>
          <Chip
            selected={filters.species === 'gato'}
            onPress={() => toggleSpecies('gato')}
            icon="cat"
            style={styles.chip}
          >
            Gatos
          </Chip>
          <Chip
            selected={Boolean(filters.urgent)}
            onPress={toggleUrgent}
            icon="alert"
            style={styles.chip}
          >
            Urgente
          </Chip>
        </View>
      </View>
    ),
    [
      filters.species,
      filters.urgent,
      filters.text,
      searchOpen,
      setText,
      toggleSpecies,
      toggleUrgent,
    ],
  );

  const renderItem: ListRenderItem<AnimalCardVM> = useCallback(
    ({ item }) => (
      <AnimalCard
        data={item}
        onPress={id => navigation.navigate('AnimalDetail', { id })}
      />
    ),
    [navigation],
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
            Sin huellitas aún…
          </Text>
          <Text variant="bodyMedium" style={styles.emptyHint}>
            Prueba ajustar la búsqueda o los filtros.
          </Text>
          <Button
            mode="outlined"
            style={styles.emptyButton}
            onPress={() => navigation.navigate('CreateAnimal')}
          >
            Agregar huellita
          </Button>
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
          onEndReached={fetchNextPage}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 12,
            paddingBottom: 96,
          }}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={8}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerWrap: { gap: 8, marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {},
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
  emptyButton: { marginTop: 4 },
  footer: { paddingVertical: 16 },
});

export default ExploreScreen;
