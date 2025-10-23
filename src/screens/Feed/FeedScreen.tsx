import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Animated,
  FlatList, // tipos
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import PostCard from '@components/feed/PostCard';
import FeedHeaderBanner from '@components/feed/FeedHeaderBanner';
import FeedComposerBar from '@components/feed/FeedComposerBar';

import { listPostsPublic, toPostVM } from '@services/postsService';
import {
  getUserReacted as getUserPostReacted,
  countReactions as countPostReactions,
  toggleReaction as togglePostReaction,
} from '@services/postsReactionsService';

import type { PostDoc, PostCardVM } from '@models/post';
import { getAuth, getFirestore, doc, getDoc } from '@services/firebase';

/* ───────────────────────────────────────────────────────────── */
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

/* Autor light */
type UserLight = Readonly<{
  uid: string;
  displayName?: string;
  fullName?: string;
  username?: string;
  photoURL?: string;
}>;
const userRef = (uid: string) => doc(getFirestore(), 'users', uid);
const displayFromUser = (u: UserLight | undefined | null): string => {
  if (u?.fullName && u.fullName.trim()) return u.fullName;
  if (u?.displayName && u.displayName.trim()) return u.displayName;
  if (u?.username && u.username.trim()) return u.username;
  return 'Usuario';
};

/* Item animado */
const AnimatedPostItem: React.FC<{
  item: PostCardVM;
  index: number;
  author?: Readonly<{ name: string; photoURL?: string }>;
  onToggleReact: (postId: string, next: boolean) => void | Promise<void>;
}> = ({ item, index, author, onToggleReact }) => {
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
      <PostCard
        data={item}
        {...(author ? ({ author } as const) : {})}
        onToggleReact={onToggleReact}
      />
    </Animated.View>
  );
};

/* Pantalla */
const FeedScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? null;

  // 🔸 Animated scroll para efectos del header
  const scrollY = useRef(new Animated.Value(0)).current;

  const bannerScale = scrollY.interpolate({
    inputRange: [-120, 0],
    outputRange: [1.1, 1],
    extrapolate: 'clamp',
  });
  const bannerTranslateY = scrollY.interpolate({
    inputRange: [-120, 0, 60],
    outputRange: [-12, 0, -12],
    extrapolate: 'clamp',
  });
  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const notchFadeOpacity = scrollY.interpolate({
    inputRange: [-40, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const [cards, setCards] = useState<PostCardVM[]>([]);
  const [authorByPostId, setAuthorByPostId] = useState<
    Record<string, Readonly<{ name: string; photoURL?: string }>>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);

  // Sólo avatar para el composer
  const [me, setMe] = useState<Readonly<{ photoURL?: string }>>({});

  const listRef = useRef<FlatList<PostCardVM>>(null);
  const lastLoadMoreAtRef = useRef(0);
  const endReachedDuringMomentum = useRef(false);

  // Cache usuarios
  const userCacheRef = useRef<Map<string, UserLight>>(new Map());

  const resolveAuthorsFor = useCallback(async (posts: PostDoc[]) => {
    const uids = Array.from(
      new Set(
        posts
          .map(p => p.authorUid)
          .filter((s): s is string => typeof s === 'string' && s.length > 0),
      ),
    );
    const missing = uids.filter(id => !userCacheRef.current.has(id));
    if (missing.length > 0) {
      const snaps = await Promise.all(missing.map(id => getDoc(userRef(id))));
      snaps.forEach(s => {
        if (s.exists())
          userCacheRef.current.set(s.id as string, s.data() as UserLight);
        else
          userCacheRef.current.set(s.id as string, { uid: s.id } as UserLight);
      });
    }
    const map: Record<
      string,
      Readonly<{ name: string; photoURL?: string }>
    > = {};
    for (const p of posts) {
      const u =
        typeof p.authorUid === 'string'
          ? userCacheRef.current.get(p.authorUid)
          : undefined;
      const name = displayFromUser(u ?? null);
      const photoURL = u?.photoURL;
      map[p.id] = photoURL
        ? ({ name, photoURL } as const)
        : ({ name } as const);
    }
    setAuthorByPostId(prev => ({ ...prev, ...map }));
  }, []);

  // Avatar para composer (solo set si existe)
  useEffect(() => {
    (async () => {
      const id = auth.currentUser?.uid;
      if (!id) {
        setMe({});
        return;
      }
      const s = await getDoc(userRef(id));
      const u = s.exists() ? (s.data() as UserLight) : undefined;
      const next = {} as { photoURL?: string };
      if (u?.photoURL) next.photoURL = u.photoURL;
      setMe(next);
    })().catch(() => setMe({}));
  }, [auth.currentUser?.uid]);

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
            uid ? getUserPostReacted(p.id, uid) : Promise.resolve(null),
            countPostReactions(p.id),
          ]);
          return toPostVM(
            { ...p, reactionCount: rc },
            Boolean(reacted === 'love'),
          );
        }),
      );

      await resolveAuthorsFor(items);
      prefetchFirstImages(vms);
      setCards(vms);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } finally {
      setLoading(false);
    }
  }, [uid, prefetchFirstImages, resolveAuthorsFor]);

  /* Paginación */
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
            uid ? getUserPostReacted(p.id, uid) : Promise.resolve(null),
            countPostReactions(p.id),
          ]);
          return toPostVM(
            { ...p, reactionCount: rc },
            Boolean(reacted === 'love'),
          );
        }),
      );

      await resolveAuthorsFor(items);
      prefetchFirstImages(vms);
      setCards(prev => prev.concat(vms));
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } finally {
      setLoadingMore(false);
    }
  }, [
    cursor,
    hasMore,
    loadingMore,
    uid,
    prefetchFirstImages,
    resolveAuthorsFor,
  ]);

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

  /* Reacción optimista + reconciliación */
  const onToggleReact = useCallback(
    async (postId: string, next: boolean) => {
      if (!uid) return;
      setCards(prev =>
        prev.map(it =>
          it.id === postId
            ? {
                ...it,
                reactedByMe: next,
                reactionCount: Math.max(0, it.reactionCount + (next ? 1 : -1)),
              }
            : it,
        ),
      );
      const final = await togglePostReaction(postId, uid);
      const rc = await countPostReactions(postId);
      setCards(prev =>
        prev.map(it =>
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
    ({ item, index }) => {
      const author = authorByPostId[item.id];
      return (
        <AnimatedPostItem
          item={item}
          index={index}
          {...(author ? ({ author } as const) : {})}
          onToggleReact={onToggleReact}
        />
      );
    },
    [onToggleReact, authorByPostId],
  );

  return (
    <Screen edges={['bottom']}>
      {/* Overlay bajo el notch sólo al hacer pull */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: theme.colors.background,
          opacity: notchFadeOpacity as any,
          zIndex: 2,
        }}
      />

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
            onPress={() => navigation?.navigate?.('CreatePost')}
            style={{ marginTop: 8 }}
            icon="plus"
          >
            Nueva actualización
          </Button>
        </View>
      ) : (
        <Animated.FlatList
          ref={listRef}
          data={cards}
          keyExtractor={it => it.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <Animated.View
              style={{
                transform: [
                  { translateY: bannerTranslateY as any },
                  { scale: bannerScale as any },
                ],
                opacity: bannerOpacity as any,
              }}
            >
              <FeedHeaderBanner />
              <FeedComposerBar
                {...(me.photoURL ? ({ photoURL: me.photoURL } as const) : {})}
                onPress={() => navigation?.navigate?.('CreatePost')}
              />
            </Animated.View>
          }
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
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            paddingTop: 0,
            paddingHorizontal: 0,
            paddingBottom: 96,
          }}
          removeClippedSubviews
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
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
