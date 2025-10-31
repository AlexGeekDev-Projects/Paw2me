// src/screens/Matches/Matches.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Image,
  FlatList,
  type ListRenderItemInfo,
  ScrollView,
  type ViewToken,
} from 'react-native';
import {
  Text,
  Chip,
  Button,
  useTheme,
  Appbar,
  Card,
  Searchbar,
  IconButton,
} from 'react-native-paper';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  useNavigation,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';

import { useAuth } from '@hooks/useAuth';
import {
  listenUserMatches,
  type UserMatchDoc,
} from '@services/reactionsService';
import {
  getFirestore,
  doc,
  setDoc,
  nowTs,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import { listPerfConfig } from '@config/appConfig';

const TAB_KEYS = ['all', 'pending', 'contacted', 'closed'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABEL: Record<TabKey, string> = {
  all: 'Todos',
  pending: 'Pendientes',
  contacted: 'Contactados',
  closed: 'Cerrados',
};

const AVATAR = 64;

/* ---------- helpers ---------- */
const applyAlpha = (hexOrRgba: string, a: number) =>
  hexOrRgba.startsWith('#')
    ? `rgba(${parseInt(hexOrRgba.slice(1, 3), 16)},${parseInt(
        hexOrRgba.slice(3, 5),
        16,
      )},${parseInt(hexOrRgba.slice(5, 7), 16)},${a})`
    : hexOrRgba.replace(/rgba?\(([^)]+)\)/, (_m, rgb) => `rgba(${rgb},${a})`);

const formatSince = (ts: UserMatchDoc['createdAt']): string => {
  const d =
    (ts as FirebaseFirestoreTypes.Timestamp)?.toDate?.() ??
    (ts as unknown as Date);
  const now = Date.now();
  const t = d instanceof Date ? d.getTime() : now;
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d`;
  return `${Math.floor(days / 7)} sem`;
};

/* ---------- UI pequeños ---------- */
const CountPill: React.FC<{ value: number }> = ({ value }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.countPill,
        {
          backgroundColor: applyAlpha(theme.colors['primary'], 0.12),
          borderColor: applyAlpha(theme.colors['primary'], 0.28),
        },
      ]}
    >
      <Text
        variant="labelSmall"
        style={[styles.countPillText, { color: theme.colors['primary'] }]}
        numberOfLines={1}
      >
        {value > 99 ? '99+' : String(value)}
      </Text>
    </View>
  );
};

type TabsRowProps = Readonly<{
  tab: TabKey;
  counts: { all: number; pending: number; contacted: number; closed: number };
  onChange: (t: TabKey) => void;
  borderColor: string;
}>;
const TabsRow: React.FC<TabsRowProps> = ({
  tab,
  counts,
  onChange,
  borderColor,
}) => {
  const theme = useTheme();
  return (
    <View style={[styles.tabsWrap, { borderColor }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        contentContainerStyle={styles.tabsRow}
      >
        {TAB_KEYS.map(k => {
          const selected = tab === k;
          return (
            <Chip
              compact
              key={k}
              selected={selected}
              onPress={() => onChange(k)}
              style={[
                styles.tabChip,
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
              {TAB_LABEL[k]}{' '}
              {counts[k] ? <CountPill value={counts[k]} /> : null}
            </Chip>
          );
        })}
      </ScrollView>
    </View>
  );
};

/* ---------- Item (memo) ---------- */
type MatchItemProps = Readonly<{
  item: UserMatchDoc & { id: string };
  onPrimary: (animalId: string, status: UserMatchDoc['status']) => void;
  onSecondary: (animalId: string, status: UserMatchDoc['status']) => void;
}>;
const MatchItem: React.FC<MatchItemProps> = memo(
  ({ item, onPrimary, onSecondary }) => {
    const theme = useTheme();

    const title = item.paw?.name || '—';
    const subtitleParts: string[] = [];
    if (item.paw?.species) subtitleParts.push(item.paw.species);
    if (item.paw?.city) subtitleParts.push(item.paw.city);
    const subtitle =
      subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined;

    const statusLabel =
      item.status === 'pending'
        ? 'Nuevo'
        : item.status === 'contacted'
        ? 'Contactado'
        : 'Cerrado';

    const primaryLabel =
      item.status === 'pending'
        ? 'Contactar'
        : item.status === 'contacted'
        ? 'Cerrar'
        : 'Reabrir';

    return (
      <Card
        mode="contained"
        style={[
          styles.card,
          { backgroundColor: theme.colors.elevation.level2 },
        ]}
        onPress={() => onPrimary(item.animalId, item.status)}
        accessible
        accessibilityLabel={`Match con ${title}. Estado ${statusLabel}.`}
      >
        <View style={styles.row}>
          <View style={styles.avatarWrap}>
            {item.paw?.coverUrl ? (
              <Image
                source={{ uri: item.paw.coverUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}
          </View>

          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <Text
                variant="titleMedium"
                style={styles.title}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text variant="labelSmall" style={styles.time}>
                {formatSince(item.createdAt)}
              </Text>
            </View>

            {subtitle ? (
              <Text
                variant="bodyMedium"
                style={styles.subtitle}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              <Chip compact>{statusLabel}</Chip>
              {item.paw?.status ? (
                <Chip compact icon="paw" style={{ marginLeft: 8 }}>
                  {item.paw.status}
                </Chip>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={() => onPrimary(item.animalId, item.status)}
            style={styles.btn}
          >
            {primaryLabel}
          </Button>
          <Button
            mode="outlined"
            onPress={() => onSecondary(item.animalId, item.status)}
            style={styles.btn}
          >
            {item.status === 'pending' ? 'Descartar' : 'Cambiar'}
          </Button>
        </View>
      </Card>
    );
  },
);
MatchItem.displayName = 'MatchItem';

/* ---------- Top bar con buscador (estilo Explorer) ---------- */
type TopBarProps = Readonly<{
  searchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  query: string;
  onChangeQuery: (q: string) => void;
}>;
const MatchesTopBar: React.FC<TopBarProps> = ({
  searchOpen,
  onOpenSearch,
  onCloseSearch,
  query,
  onChangeQuery,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (searchOpen) {
    return (
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 12,
          paddingBottom: 6,
          backgroundColor: theme.colors['background'],
        }}
      >
        <Searchbar
          placeholder="Buscar matches…"
          value={query}
          onChangeText={onChangeQuery}
          autoFocus
          style={{ borderRadius: 14 }}
          icon="arrow-left"
          onIconPress={onCloseSearch}
          right={() => (
            <IconButton
              icon="close"
              onPress={() => onChangeQuery('')}
              accessibilityLabel="Limpiar búsqueda"
            />
          )}
        />
      </View>
    );
  }

  return (
    <Appbar.Header
      statusBarHeight={0}
      mode="center-aligned"
      style={{ backgroundColor: theme.colors['background'] }}
    >
      <Appbar.Content title="Matches" />
      <Appbar.Action icon="magnify" onPress={onOpenSearch} />
    </Appbar.Header>
  );
};

/* ---------- Pantalla ---------- */
const Matches: React.FC = () => {
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const [items, setItems] = useState<
    ReadonlyArray<UserMatchDoc & { id: string }>
  >([]);
  const [tab, setTab] = useState<TabKey>('all');

  // búsqueda
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  // pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    if (!uid) return;
    setRefreshing(true);
    const unsub = listenUserMatches(uid, setItems, { limit: 200 });
    const t = setTimeout(() => {
      setRefreshing(false);
      unsub();
    }, 350);
    return () => clearTimeout(t);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = listenUserMatches(uid, setItems, { limit: 200 });
    return unsub;
  }, [uid]);

  const counts = useMemo(() => {
    const base = { all: items.length, pending: 0, contacted: 0, closed: 0 };
    for (const it of items) {
      if (it.status === 'pending') base.pending += 1;
      else if (it.status === 'contacted') base.contacted += 1;
      else if (it.status === 'closed') base.closed += 1;
    }
    return base;
  }, [items]);

  const filtered = useMemo(() => {
    const byTab = tab === 'all' ? items : items.filter(i => i.status === tab);
    const q = query.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(i => {
      const a = [
        i.paw?.name ?? '',
        i.paw?.species ?? '',
        i.paw?.city ?? '',
        i.paw?.status ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return a.includes(q);
    });
  }, [items, tab, query]);

  const updateStatus = useCallback(
    async (animalId: string, next: 'pending' | 'contacted' | 'closed') => {
      if (!uid) return;
      const db = getFirestore();
      const now = nowTs();
      await setDoc(
        doc(db, 'users', uid, 'matches', animalId),
        { status: next, createdAt: now },
        { merge: true },
      );
      await setDoc(
        doc(db, 'paws', animalId, 'matches', uid),
        { status: next, updatedAt: now },
        { merge: true },
      );
    },
    [uid],
  );

  const onPrimary = useCallback(
    (animalId: string, current: UserMatchDoc['status']) => {
      if (current === 'pending') void updateStatus(animalId, 'contacted');
      else if (current === 'contacted') void updateStatus(animalId, 'closed');
      else void updateStatus(animalId, 'pending');
    },
    [updateStatus],
  );

  const onSecondary = useCallback(
    (animalId: string, current: UserMatchDoc['status']) => {
      if (current === 'pending') void updateStatus(animalId, 'closed');
      else void updateStatus(animalId, 'pending');
    },
    [updateStatus],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UserMatchDoc & { id: string }>) => (
      <MatchItem item={item} onPrimary={onPrimary} onSecondary={onSecondary} />
    ),
    [onPrimary, onSecondary],
  );

  const keyExtractor = useCallback(
    (it: UserMatchDoc & { id: string }) => it.id,
    [],
  );

  // Prefetch de imagen del siguiente ítem
  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: ViewToken[];
      changed: ViewToken[];
    }) => {
      const last = viewableItems[viewableItems.length - 1];
      const nextUrl = (
        last?.item as (UserMatchDoc & { id: string }) | undefined
      )?.paw?.coverUrl;
      if (nextUrl) Image.prefetch(nextUrl).catch(() => {});
    },
  ).current;

  // Header (tabs sticky + search opcional)
  const renderHeader = useCallback(
    () => (
      <View>
        <View
          style={[
            styles.sticky,
            {
              backgroundColor: theme.colors['background'],
              borderColor: theme.colors['outlineVariant'],
            },
          ]}
        >
          <TabsRow
            tab={tab}
            counts={counts}
            onChange={setTab}
            borderColor={theme.colors['outlineVariant']}
          />
        </View>

        {searchOpen ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Searchbar
              placeholder="Buscar matches…"
              value={query}
              onChangeText={setQuery}
              style={{ borderRadius: 14 }}
              autoFocus
              icon="arrow-left"
              onIconPress={() => {
                setQuery('');
                setSearchOpen(false);
              }}
              right={() => (
                <IconButton
                  icon="close"
                  onPress={() => setQuery('')}
                  accessibilityLabel="Limpiar búsqueda"
                />
              )}
            />
          </View>
        ) : null}
      </View>
    ),
    [tab, counts, theme.colors, searchOpen, query],
  );

  const ListEmpty = useCallback(
    () => (
      <View style={styles.emptyWrap}>
        <Text variant="titleMedium" style={{ opacity: 0.9 }}>
          Aún no tienes matches
        </Text>
        <Text
          variant="bodyMedium"
          style={{ opacity: 0.7, marginTop: 4, textAlign: 'center' }}
        >
          Explora huellitas y toca “Match” para verlas aquí.
        </Text>
        <Button
          mode="contained"
          style={{ marginTop: 12, borderRadius: 12 }}
          onPress={() => navigation.navigate('Explore' as never)}
        >
          Ir a Explorar
        </Button>
      </View>
    ),
    [navigation],
  );

  // Soporte FlashList con fallback a FlatList (tipado estricto)
  type ItemT = Readonly<UserMatchDoc & { id: string }>;
  type FlatProps = React.ComponentProps<typeof FlatList<ItemT>>;
  type FlashLikeProps = FlatProps & { estimatedItemSize?: number };
  type FlashLike = React.ComponentType<FlashLikeProps>;
  let FlashListComp: FlashLike | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    FlashListComp = require('@shopify/flash-list').FlashList as FlashLike;
  } catch {
    FlashListComp = undefined;
  }
  const useFlash = !!FlashListComp && listPerfConfig.preferFlashList;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors['background'] }}
      edges={['top', 'left', 'right']}
    >
      <MatchesTopBar
        searchOpen={searchOpen}
        onOpenSearch={() => setSearchOpen(true)}
        onCloseSearch={() => {
          setQuery('');
          setSearchOpen(false);
        }}
        query={query}
        onChangeQuery={setQuery}
      />

      {useFlash && FlashListComp ? (
        <FlashListComp
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderHeader}
          stickyHeaderIndices={[0]}
          estimatedItemSize={listPerfConfig.estimatedItemSize}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            padding: 16,
            paddingTop: 8,
            paddingBottom: 16 + insets.bottom,
          }}
          ListEmptyComponent={ListEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.4}
        />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={renderHeader}
          stickyHeaderIndices={[0]}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            padding: 16,
            paddingTop: 8,
            paddingBottom: 16 + insets.bottom,
          }}
          ListEmptyComponent={ListEmpty}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          // rendimiento FlatList
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          windowSize={10}
          removeClippedSubviews
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.4}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // sticky header wrapper (tabs)
  sticky: {
    zIndex: 10,
    elevation: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  tabsWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    columnGap: 8,
  },
  tabChip: { borderRadius: 20 },

  countPill: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
  countPillText: { fontWeight: '700', letterSpacing: 0.2 },

  card: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', padding: 14, paddingBottom: 8 },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.08)' },

  textCol: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '700', flexShrink: 1, marginRight: 8 },
  time: { opacity: 0.6, marginLeft: 'auto' },
  subtitle: { opacity: 0.8, marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },

  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  btn: { flex: 1, borderRadius: 12 },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
});

export default Matches;
