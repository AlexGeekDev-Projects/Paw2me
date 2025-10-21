// src/screens/FeedScreen.tsx
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
  Animated,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import PostCard from '@components/feed/PostCard';

import {
  listPostsPublic,
  getUserReacted,
  countReactions,
  toggleReaction,
  toPostVM,
} from '@services/postsService';

import type { PostDoc, PostCardVM } from '@models/post';
import { getAuth } from '@services/firebase';

const PAGE_SIZE = 20;
const LOAD_MORE_COOLDOWN_MS = 900;

const STAGGER_MAX_ITEMS = 12;
const STAGGER_STEP_MS = 55;
const STAGGER_DURATION_MS = 220;

const emptyInbox = require('@assets/empty-paw.png') as number;

/* Normalizador (v1/v2) */
type PostsPage =
  | PostDoc[]
  | Readonly<{ items: PostDoc[]; nextCursor?: string | null }>;

function normalizePostsPage(res: PostsPage): {
  items: PostDoc[];
  nextCursor: string | null;
} {
  if (Array.isArray(res)) return { items: res, nextCursor: null };
  return { items: res.items, nextCursor: res.nextCursor ?? null };
}

/* Tarjeta animada */
const AnimatedPostItem: React.FC<{
  item: PostCardVM;
  index: number;
  onToggleReact: (postId: string, next: boolean) => void;
}> = ({ item, index, onToggleReact }) => {
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
      <PostCard data={item} onToggleReact={onToggleReact} />
    </Animated.View>
  );
};

const FeedScreen: React.FC = () => {
  const theme = useTheme();
  const uid = getAuth().currentUser?.uid ?? 'dev';

  const [cards, setCards] = useState<PostCardVM[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const listRef = useRef<FlatList<PostCardVM>>(null);
  const lastLoadMoreAtRef = useRef(0);
  const endReachedDuringMomentum = useRef(false);

  const prefetchFirstImages = useCallback((vms: PostCardVM[]) => {
    const urls = vms
      .map(vm => (Array.isArray(vm.imageUrls) ? vm.imageUrls[0] : undefined))
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    urls.forEach(u => Image.prefetch(u).catch(() => {}));
  }, []);

  /* Primera página */
  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const raw = (await listPostsPublic({ limit: PAGE_SIZE })) as PostsPage;
      const { items, nextCursor } = normalizePostsPage(raw);

      const vms: PostCardVM[] = await Promise.all(
        items.map(async (p: PostDoc) => {
          const [reacted, rc] = await Promise.all([
            getUserReacted(p.id, uid),
            countReactions(p.id),
          ]);
          return toPostVM({ ...p, reactionCount: rc }, reacted);
        }),
      );

      prefetchFirstImages(vms);
      setCards(vms);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } finally {
      setLoading(false);
    }
  }, [uid, prefetchFirstImages]);

  /* Siguientes páginas */
  const fetchNextPage = useCallback(async () => {
    const now = Date.now();
    if (!hasMore || loadingMore) return;
    if (now - lastLoadMoreAtRef.current < LOAD_MORE_COOLDOWN_MS) return;

    lastLoadMoreAtRef.current = now;
    setLoadingMore(true);
    try {
      const raw = (await listPostsPublic({
        limit: PAGE_SIZE,
        ...(cursor ? { after: cursor } : {}),
      })) as PostsPage;

      const { items, nextCursor } = normalizePostsPage(raw);

      const vms: PostCardVM[] = await Promise.all(
        items.map(async (p: PostDoc) => {
          const [reacted, rc] = await Promise.all([
            getUserReacted(p.id, uid),
            countReactions(p.id),
          ]);
          return toPostVM({ ...p, reactionCount: rc }, reacted);
        }),
      );

      prefetchFirstImages(vms);
      setCards((prev: PostCardVM[]) => prev.concat(vms));
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, uid, prefetchFirstImages]);

  const handleEndReached = useCallback(() => {
    if (endReachedDuringMomentum.current) return;
    endReachedDuringMomentum.current = true;
    void fetchNextPage();
  }, [fetchNextPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFirstPage();
    setRefreshing(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [fetchFirstPage]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  /* Reacción optimista con Reconcilio */
  const onToggleReact = useCallback(
    async (postId: string, next: boolean) => {
      setCards((prev: PostCardVM[]) =>
        prev.map((it: PostCardVM) =>
          it.id === postId
            ? {
                ...it,
                reactedByMe: next,
                reactionCount: Math.max(0, it.reactionCount + (next ? 1 : -1)),
              }
            : it,
        ),
      );

      const final = await toggleReaction(postId, uid);
      const rc = await countReactions(postId);

      setCards((prev: PostCardVM[]) =>
        prev.map((it: PostCardVM) =>
          it.id === postId
            ? { ...it, reactedByMe: final, reactionCount: rc }
            : it,
        ),
      );
    },
    [uid],
  );

  /* Render */
  const renderItem: ListRenderItem<PostCardVM> = useCallback(
    ({ item, index }) => (
      <AnimatedPostItem
        item={item}
        index={index}
        onToggleReact={onToggleReact}
      />
    ),
    [onToggleReact],
  );

  return (
    <Screen>
      {loading ? (
        <Loading variant="skeleton-card-list" count={6} />
      ) : cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image
            source={emptyInbox}
            style={styles.emptyImage}
            resizeMode="contain"
          />
          <Text variant="titleMedium" style={styles.emptyText}>
            Aún no hay actualizaciones
          </Text>
          <Text variant="bodyMedium" style={styles.emptyHint}>
            Comparte fotos o videos de tus huellitas para romper el hielo.
          </Text>
          <Button
            mode="contained"
            onPress={() => {}}
            style={{ marginTop: 8 }}
            icon="plus"
          >
            Nueva actualización
          </Button>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={cards}
          keyExtractor={(item: PostCardVM) => item.id}
          renderItem={renderItem}
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
  footer: { paddingVertical: 16 },
});

export default FeedScreen;
