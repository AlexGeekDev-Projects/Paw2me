// src/screens/FeedScreen.tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Animated,
  FlatList as RNFlatList,
  RefreshControl,
  StyleSheet,
  View,
  type ViewToken,
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
  getReactionCounts as getPostReactionCounts,
  setMyReactionKey as setMyPostReactionKey,
} from '@services/postReactionsService';

import type { PostDoc, PostCardVM } from '@models/post';
import { getAuth, getFirestore, doc, getDoc } from '@services/firebase';
import type { FirebaseFirestoreTypes } from '@services/firebase';

import type { ReactionCounts, ReactionKey } from '@reactions/types';
import type { PostReactionKey } from '@services/postReactionsService';

type UIReactionKey = ReactionKey;

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
const userRef = (uid: string) =>
  doc(
    getFirestore(),
    'users',
    uid,
  ) as FirebaseFirestoreTypes.DocumentReference<UserLight>;

const displayFromUser = (u: UserLight | undefined | null): string => {
  if (u?.fullName && u.fullName.trim()) return u.fullName;
  if (u?.displayName && u.displayName.trim()) return u.displayName;
  if (u?.username && u.username.trim()) return u.username;
  return 'Usuario';
};

/* Item animado tipado para PostCard (UIReactionKey) */
const AnimatedPostItem: React.FC<{
  item: PostCardVM;
  index: number;
  author?: Readonly<{ name: string; photoURL?: string }>;
  onToggleReact: (postId: string, next: boolean) => void | Promise<void>;
  currentReaction: UIReactionKey | null;
  counts?: Partial<Record<UIReactionKey, number>>;
  onReactKey: (
    postId: string,
    key: UIReactionKey | null,
  ) => void | Promise<void>;
  isVisible: boolean;
}> = ({
  item,
  index,
  author,
  onToggleReact,
  currentReaction,
  counts,
  onReactKey,
  isVisible,
}) => {
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
        currentReaction={currentReaction}
        {...(counts ? ({ counts } as const) : {})}
        onReactKey={onReactKey}
        availableKeys={['like', 'love', 'happy', 'sad', 'wow', 'angry']}
        isVisible={isVisible}
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
  const [me, setMe] = useState<Readonly<{ name?: string; photoURL?: string }>>(
    {},
  );

  // 🔒 Reacciones (estado por post)
  const [currentByPostId, setCurrentByPostId] = useState<
    Record<string, PostReactionKey | null>
  >({});
  const [countsByPostId, setCountsByPostId] = useState<
    Record<string, ReactionCounts>
  >({});

  // Visibilidad por post (autopreview)
  const [visibleMap, setVisibleMap] = useState<Record<string, true>>({});

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const listRef = useRef<RNFlatList<PostCardVM>>(null);
  const lastLoadMoreAtRef = useRef(0);
  const endReachedDuringMomentum = useRef(false);

  // cargar mi usuario (para composer)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid) {
        if (alive) setMe({});
        return;
      }
      const snap = await getDoc(userRef(uid));
      const u = snap.exists() ? (snap.data() as UserLight) : undefined;
      const name = displayFromUser(u ?? null);
      const next: Readonly<{ name?: string; photoURL?: string }> = u?.photoURL
        ? ({ name, photoURL: u.photoURL } as const)
        : ({ name } as const);
      if (alive) setMe(next);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  // Cache por uid
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
        if (s.exists()) userCacheRef.current.set(s.id, s.data() as UserLight);
        else userCacheRef.current.set(s.id, { uid: s.id } as UserLight);
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

  const prefetchFirstImages = useCallback((vms: PostCardVM[]) => {
    const urls = vms
      .map(vm => (Array.isArray(vm.imageUrls) ? vm.imageUrls[0] : undefined))
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    urls.forEach(u => Image.prefetch(u).catch(() => {}));
  }, []);

  const sumCounts = (c: ReactionCounts | undefined): number =>
    (c?.like ?? 0) +
    (c?.love ?? 0) +
    (c?.happy ?? 0) +
    (c?.sad ?? 0) +
    (c?.wow ?? 0) +
    (c?.angry ?? 0);

  /* Primera página */
  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const raw = (await listPostsPublic({ limit: PAGE_SIZE })) as PostsPage;
      const { items, nextCursor } = normalizePostsPage(raw);

      const vms: PostCardVM[] = await Promise.all(
        items.map(async (p: PostDoc) => {
          const [myKey, counts] = await Promise.all([
            uid ? getUserPostReacted(p.id, uid) : Promise.resolve(null),
            getPostReactionCounts(p.id),
          ]);
          const rcTotal = sumCounts(counts);
          const vm = toPostVM(
            { ...p, reactionCount: rcTotal },
            myKey === 'love',
          );
          setCurrentByPostId(prev => ({ ...prev, [p.id]: myKey }));
          setCountsByPostId(prev => ({ ...prev, [p.id]: counts }));
          return vm;
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
          const [myKey, counts] = await Promise.all([
            uid ? getUserPostReacted(p.id, uid) : Promise.resolve(null),
            getPostReactionCounts(p.id),
          ]);
          const rcTotal = sumCounts(counts);
          const vm = toPostVM(
            { ...p, reactionCount: rcTotal },
            myKey === 'love',
          );
          setCurrentByPostId(prev => ({ ...prev, [p.id]: myKey }));
          setCountsByPostId(prev => ({ ...prev, [p.id]: counts }));
          return vm;
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
    setCurrentByPostId({});
    setCountsByPostId({});
    await fetchFirstPage();
    setRefreshing(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [fetchFirstPage]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  // alias claro para usar dentro del handler
  const setMyReactionKey = setMyPostReactionKey;

  /* ---------- Reacciones: handler exacto (PostReactionKey) ---------- */
  const handleReactKeyExact = useCallback(
    async (postId: string, nextKey: PostReactionKey | null) => {
      if (!uid) return;

      const prevKey: PostReactionKey | null = currentByPostId?.[postId] ?? null;
      const delta = (nextKey ? 1 : 0) - (prevKey ? 1 : 0); // +1,0,-1

      // 0) Optimista: evita “love” fantasma
      setCards(prev =>
        prev.map(it =>
          it.id === postId
            ? {
                ...it,
                reactedByMe: nextKey === 'love',
                reactionCount: Math.max(0, it.reactionCount + delta),
              }
            : it,
        ),
      );

      // 1) estado inmediato
      setCurrentByPostId(prev => ({ ...prev, [postId]: nextKey }));

      // 2) optimista en contadores por clave
      setCountsByPostId(prev => {
        const base = prev[postId] ?? {
          like: 0,
          love: 0,
          happy: 0,
          sad: 0,
          wow: 0,
          angry: 0,
        };
        const next = { ...base };
        if (prevKey) next[prevKey] = Math.max(0, (next[prevKey] ?? 0) - 1);
        if (nextKey) next[nextKey] = (next[nextKey] ?? 0) + 1;
        return { ...prev, [postId]: next };
      });

      // 3) persistencia + reconciliación
      await setMyReactionKey(postId, nextKey);
      const [finalKey, finalCounts] = await Promise.all([
        uid ? getUserPostReacted(postId, uid) : Promise.resolve(null),
        getPostReactionCounts(postId),
      ]);

      setCurrentByPostId(prev => ({ ...prev, [postId]: finalKey }));
      setCountsByPostId(prev => ({ ...prev, [postId]: finalCounts }));

      const total =
        (finalCounts.like ?? 0) +
        (finalCounts.love ?? 0) +
        (finalCounts.happy ?? 0) +
        (finalCounts.sad ?? 0) +
        (finalCounts.wow ?? 0) +
        (finalCounts.angry ?? 0);

      setCards(prev =>
        prev.map(it =>
          it.id === postId
            ? { ...it, reactionCount: total, reactedByMe: finalKey === 'love' }
            : it,
        ),
      );
    },
    [uid, currentByPostId],
  );

  /* Adaptador UI (filtra "match") */
  const handleReactKeyUI = useCallback(
    async (postId: string, key: UIReactionKey | null) => {
      const nextKey: PostReactionKey | null =
        key && key !== 'match' ? (key as PostReactionKey) : null;
      return handleReactKeyExact(postId, nextKey);
    },
    [handleReactKeyExact],
  );

  /* Compat: toggle “love” */
  const onToggleReact = useCallback(
    async (postId: string, next: boolean) => {
      if (!uid) return;
      const key: PostReactionKey | null = next ? 'love' : null;
      await handleReactKeyExact(postId, key);
    },
    [uid, handleReactKeyExact],
  );

  /* Convertir ReactionCounts → counts UI parciales */
  const toUICounts = (
    c: ReactionCounts | undefined,
  ): Partial<Record<UIReactionKey, number>> => ({
    like: c?.like ?? 0,
    love: c?.love ?? 0,
    happy: c?.happy ?? 0,
    sad: c?.sad ?? 0,
    wow: c?.wow ?? 0,
    angry: c?.angry ?? 0,
  });

  /* Viewability para auto-preview de video */
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 85 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const next: Record<string, true> = {};
      for (const v of viewableItems) {
        if (v.isViewable) {
          const it = v.item as PostCardVM;
          next[it.id] = true;
        }
      }
      setVisibleMap(next);
    },
  ).current;

  /* Render */
  const renderItem: ListRenderItem<PostCardVM> = useCallback(
    ({ item, index }) => {
      const author = authorByPostId[item.id];
      const current = (currentByPostId[item.id] ??
        null) as UIReactionKey | null;
      const counts = toUICounts(countsByPostId[item.id]);
      const isVisible = !!visibleMap[item.id];
      return (
        <AnimatedPostItem
          item={item}
          index={index}
          {...(author ? ({ author } as const) : {})}
          onToggleReact={onToggleReact}
          currentReaction={current}
          {...(counts ? ({ counts } as const) : {})}
          onReactKey={handleReactKeyUI}
          isVisible={isVisible}
        />
      );
    },
    [
      onToggleReact,
      authorByPostId,
      currentByPostId,
      countsByPostId,
      handleReactKeyUI,
      visibleMap,
    ],
  );

  return (
    <Screen edges={['bottom']}>
      {/* Overlay bajo el notch visible solo al hacer pull */}
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
          <Text
            variant="bodyMedium"
            style={{
              textAlign: 'center',
              opacity: 0.6,
              fontSize: 14,
              marginBottom: 12,
            }}
          >
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
          ref={listRef as any}
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
                {...(me.name ? ({ name: me.name } as const) : {})}
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
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
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
  emptyImage: { width: 96, height: 96, opacity: 0.3, marginBottom: 16 },
  emptyText: { fontWeight: '600', marginBottom: 4, fontSize: 18 },
  footer: { paddingVertical: 16 },
});

export default FeedScreen;
