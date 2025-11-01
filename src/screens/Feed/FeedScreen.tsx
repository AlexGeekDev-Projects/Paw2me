// src/screens/FeedScreen.tsx
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import {
  Animated,
  Image,
  RefreshControl,
  StyleSheet,
  View,
  Platform,
  FlatList,
  type StyleProp,
  type ViewStyle,
  type ListRenderItem,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useScrollToTop } from '@react-navigation/native';

import Screen from '@components/layout/Screen';
import Loading from '@components/feedback/Loading';
import PostCard from '@components/feed/PostCard';
import FeedHeaderBanner from '@components/feed/FeedHeaderBanner';
import FeedComposerBar from '@components/feed/FeedComposerBar';
import CommentsSheet from '@components/comments/CommentsSheet';

import { listPostsPublic, toPostVM } from '@services/postsService';
import { getCommentsCount } from '@services/postCommentsService';
import {
  getUserReacted as getUserPostReacted,
  getReactionCounts as getPostReactionCounts,
  setMyReactionKey as setMyPostReactionKey,
  type PostReactionKey,
} from '@services/postReactionsService';

import {
  getAuth,
  getFirestore,
  doc,
  getDoc,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import type { PostDoc, PostCardVM } from '@models/post';
import type { ReactionCounts, ReactionKey } from '@reactions/types';
import { onPostCommentAdded } from '@utils/commentsEvents';

/* ──────────────────────────────────────────────────────────────
   FlashList: tipado forwardRef + ref seguro (scrollToOffset REQUERIDO)
   ────────────────────────────────────────────────────────────── */
type UIReactionKey = ReactionKey;

type FlashListPropsLocal<T> = {
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  estimatedItemSize?: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  onViewableItemsChanged?: (info: { viewableItems: ViewToken[] }) => void;
  viewabilityConfig?: { itemVisiblePercentThreshold?: number };
  ListHeaderComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  refreshControl?: React.ReactElement | null;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onMomentumScrollBegin?: () => void;
  showsVerticalScrollIndicator?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// ⬇️ REQUERIDO (no opcional) para que cumpla con ScrollableWrapper
type FlashListRefLike = {
  scrollToOffset(options: { offset: number; animated?: boolean }): void;
};

type FlashListComponent<T> = React.ForwardRefExoticComponent<
  FlashListPropsLocal<T> & React.RefAttributes<FlashListRefLike>
> | null;

type StrictOnScroll = NonNullable<FlashListPropsLocal<PostCardVM>['onScroll']>;

/* ────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 20;
const LOAD_MORE_COOLDOWN_MS = 900;

/** Android: sin stagger (costoso) */
const ENABLE_STAGGER = Platform.OS === 'ios';

/** Stagger (solo iOS) */
const STAGGER_MAX_ITEMS = 12;
const STAGGER_STEP_MS = 55;
const STAGGER_DURATION_MS = 220;

/** Tuning lista */
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

const VIEWABILITY_THROTTLE_MS = 120;

const emptyInbox = require('@assets/empty-paw.png') as number;

/** Soporte a respuestas antiguas y nuevas del servicio */
type PostsPage =
  | PostDoc[]
  | Readonly<{ items: PostDoc[]; nextCursor?: string | null }>;

const normalizePostsPage = (
  res: PostsPage,
): { items: PostDoc[]; nextCursor: string | null } => {
  if (Array.isArray(res)) return { items: res, nextCursor: null };
  return { items: res.items, nextCursor: res.nextCursor ?? null };
};

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

/* Util: primera imagen de un VM (para prefetch) */
const firstImageUrlOf = (vm: PostCardVM): string | null => {
  const u =
    Array.isArray(vm.imageUrls) && vm.imageUrls.length > 0
      ? vm.imageUrls[0]
      : null;
  return typeof u === 'string' && u.length > 0 ? u : null;
};

/* WeakMap para cachear mapeo UI de counts */
const uiCountsCache = new WeakMap<
  ReactionCounts,
  Partial<Record<UIReactionKey, number>>
>();
const getUICountsMemo = (
  c: ReactionCounts | undefined,
): Partial<Record<UIReactionKey, number>> => {
  if (!c) return {};
  const cached = uiCountsCache.get(c);
  if (cached) return cached;
  const mapped: Partial<Record<UIReactionKey, number>> = {
    like: c.like ?? 0,
    love: c.love ?? 0,
    happy: c.happy ?? 0,
    sad: c.sad ?? 0,
    wow: c.wow ?? 0,
    angry: c.angry ?? 0,
  };
  uiCountsCache.set(c, mapped);
  return mapped;
};

/* requestIdleCallback (fallback) */
type IdleHandle = number;
const runIdle = (cb: () => void, timeout = 500): IdleHandle => {
  const ric = (
    globalThis as unknown as {
      requestIdleCallback?: (
        cb: (deadline: {
          didTimeout: boolean;
          timeRemaining: () => number;
        }) => void,
        opts?: { timeout: number },
      ) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === 'function') return ric(() => cb(), { timeout });
  return setTimeout(cb, 0) as unknown as IdleHandle;
};

/* FlashList flag + carga perezosa */
const PREFER_FLASHLIST = true;

let FlashListComp: FlashListComponent<PostCardVM> = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('@shopify/flash-list') as {
    FlashList: React.ForwardRefExoticComponent<
      FlashListPropsLocal<PostCardVM> & React.RefAttributes<FlashListRefLike>
    >;
  };
  FlashListComp = m?.FlashList ?? null;
} catch {
  FlashListComp = null;
}

/* ───────────────── Item animado (envuelve PostCard) ───────────────── */
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
  onCommentPress: (postId: string) => void;
}> = memo(
  ({
    item,
    index,
    author,
    onToggleReact,
    currentReaction,
    counts,
    onReactKey,
    isVisible,
    onCommentPress,
  }) => {
    if (!ENABLE_STAGGER) {
      return (
        <PostCard
          data={item}
          {...(author ? ({ author } as const) : {})}
          onToggleReact={onToggleReact}
          currentReaction={currentReaction}
          {...(counts ? ({ counts } as const) : {})}
          onReactKey={onReactKey}
          availableKeys={['like', 'love', 'happy', 'sad', 'wow', 'angry']}
          isVisible={isVisible}
          onCommentPress={onCommentPress}
        />
      );
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
          onCommentPress={onCommentPress}
        />
      </Animated.View>
    );
  },
  (a, b) =>
    a.item.id === b.item.id &&
    a.currentReaction === b.currentReaction &&
    a.isVisible === b.isVisible &&
    a.onReactKey === b.onReactKey &&
    a.onToggleReact === b.onToggleReact &&
    a.onCommentPress === b.onCommentPress &&
    (a.author?.name ?? '') === (b.author?.name ?? '') &&
    (a.author?.photoURL ?? '') === (b.author?.photoURL ?? '') &&
    a.counts === b.counts,
);

/* ─────────────────────────── Pantalla ─────────────────────────── */
const FeedScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Refs de lista (ambas compatibles con useScrollToTop)
  const flatRef = useRef<FlatList<PostCardVM>>(null);
  const flashRef = useRef<FlashListRefLike | null>(null);

  // Tap en el tab → scroll to top (sin listeners manuales)
  useScrollToTop(flatRef); // ✅ FlatList ya cumple el tipo requerido
  useScrollToTop(flashRef as unknown as React.RefObject<FlashListRefLike>); // ✅ scrollToOffset requerido

  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? null;

  // Animación de scroll (banner + composer)
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScrollAnim = useMemo<StrictOnScroll>(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }) as unknown as StrictOnScroll,
    [scrollY],
  );
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

  // Estado principal
  const [cards, setCards] = useState<PostCardVM[]>([]);
  const [authorByPostId, setAuthorByPostId] = useState<
    Record<string, Readonly<{ name: string; photoURL?: string }>>
  >({});
  const [me, setMe] = useState<Readonly<{ name?: string; photoURL?: string }>>(
    {},
  );

  // Reacciones
  const [currentByPostId, setCurrentByPostId] = useState<
    Record<string, PostReactionKey | null>
  >({});
  const [countsByPostId, setCountsByPostId] = useState<
    Record<string, ReactionCounts>
  >({});

  // Mapa de visibilidad (auto-preview video)
  const [visibleMap, setVisibleMap] = useState<Record<string, true>>({});

  // Control de carga y paginación
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const lastLoadMoreAtRef = useRef(0);
  const endReachedDuringMomentum = useRef(false);
  const loveCooloffRef = useRef<Record<string, number>>({});

  const openCommentsForRef = useRef<string | null>(null);
  const [openCommentsFor, setOpenCommentsFor] = useState<string | null>(null);

  const openComments = useCallback((postId: string) => {
    openCommentsForRef.current = postId;
    setOpenCommentsFor(postId);
  }, []);

  /* Comentarios delta local (optimista) */
  useEffect(() => {
    const off = onPostCommentAdded(({ postId, delta = 1 }) => {
      startTransition(() => {
        setCards(prev =>
          prev.map(p =>
            p.id === postId
              ? {
                  ...p,
                  commentCount: Math.max(0, (p.commentCount ?? 0) + delta),
                }
              : p,
          ),
        );
      });
    });
    return off;
  }, []);

  /* Datos del usuario (Composer) */
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

  /* Resolución de autores con cache */
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

  /* Prefetch de primeras imágenes */
  const prefetchFirstImages = useCallback((vms: PostCardVM[]) => {
    const urls = vms
      .map(firstImageUrlOf)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    urls.forEach(u => Image.prefetch(u).catch(() => {}));
  }, []);

  const prefetchIfNew = useCallback(() => {}, []);

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

      const baseVMs: PostCardVM[] = items.map(p => toPostVM(p, false));
      setCards(baseVMs);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));

      // Enriquecer en idle
      runIdle(() => {
        void (async () => {
          const triples = await Promise.all(
            items.map(async (p: PostDoc) => {
              const [myKey, counts, cmtCount] = await Promise.all([
                uid ? getUserPostReacted(p.id, uid) : Promise.resolve(null),
                getPostReactionCounts(p.id),
                getCommentsCount(p.id),
              ]);
              const rcTotal = sumCounts(counts);
              const vm = toPostVM(
                { ...p, reactionCount: rcTotal, commentCount: cmtCount },
                myKey === 'love',
              );
              return { id: p.id, vm, myKey, counts } as const;
            }),
          );

          const nextCurrent: Record<string, PostReactionKey | null> = {};
          const nextCounts: Record<string, ReactionCounts> = {};
          const vms: PostCardVM[] = triples.map(t => {
            nextCurrent[t.id] = t.myKey;
            nextCounts[t.id] = t.counts;
            return t.vm;
          });

          startTransition(() => {
            setCurrentByPostId(prev => ({ ...prev, ...nextCurrent }));
            setCountsByPostId(prev => ({ ...prev, ...nextCounts }));
            setCards(vms);
          });
        })();
      });

      // Autores + prefetch también en idle
      runIdle(() => {
        void resolveAuthorsFor(items);
        prefetchFirstImages(baseVMs);
      });
    } finally {
      setLoading(false);
    }
  }, [uid, resolveAuthorsFor, prefetchFirstImages]);

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

      const baseVMs: PostCardVM[] = items.map(p => toPostVM(p, false));
      setCards(prev => prev.concat(baseVMs));
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));

      // Enriquecer en idle
      runIdle(() => {
        void (async () => {
          const triples = await Promise.all(
            items.map(async (p: PostDoc) => {
              const [myKey, counts, cmtCount] = await Promise.all([
                uid ? getUserPostReacted(p.id, uid) : Promise.resolve(null),
                getPostReactionCounts(p.id),
                getCommentsCount(p.id),
              ]);
              const rcTotal = sumCounts(counts);
              const vm = toPostVM(
                { ...p, reactionCount: rcTotal, commentCount: cmtCount },
                myKey === 'love',
              );
              return { id: p.id, vm, myKey, counts } as const;
            }),
          );

          const nextCurrent: Record<string, PostReactionKey | null> = {};
          const nextCounts: Record<string, ReactionCounts> = {};
          const vms: PostCardVM[] = triples.map(t => {
            nextCurrent[t.id] = t.myKey;
            nextCounts[t.id] = t.counts;
            return t.vm;
          });

          startTransition(() => {
            setCurrentByPostId(prev => ({ ...prev, ...nextCurrent }));
            setCountsByPostId(prev => ({ ...prev, ...nextCounts }));
            setCards(prev => {
              const map = new Map<string, PostCardVM>(
                vms.map(vm => [vm.id, vm]),
              );
              return prev.map(vm => map.get(vm.id) ?? vm);
            });
          });
        })();
      });

      runIdle(() => prefetchFirstImages(baseVMs));
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
    setCurrentByPostId({});
    setCountsByPostId({});
    await fetchFirstPage();
    setRefreshing(false);
  }, [fetchFirstPage]);

  useEffect(() => {
    void fetchFirstPage();
  }, [fetchFirstPage]);

  // Alias claro
  const setMyReactionKey = setMyPostReactionKey;

  /* Reacciones (exacto) */
  const handleReactKeyExact = useCallback(
    async (
      postId: string,
      incomingNext: PostReactionKey | null,
    ): Promise<void> => {
      const u = uid;
      if (!u) return;
      const prevKey: PostReactionKey | null = currentByPostId[postId] ?? null;

      if (prevKey === incomingNext) return;

      const now = Date.now();
      if (incomingNext === null) {
        // cooloff anti "love" fantasma
        loveCooloffRef.current[postId] = now + 650;
      } else if (
        incomingNext === 'love' &&
        now < (loveCooloffRef.current[postId] ?? 0)
      ) {
        return;
      }

      const nextKey: PostReactionKey | null = incomingNext;
      const delta = (nextKey ? 1 : 0) - (prevKey ? 1 : 0);

      // Optimista
      setCards(prev =>
        prev.map(it =>
          it.id === postId
            ? {
                ...it,
                reactedByMe: nextKey === 'love',
                reactionCount: Math.max(0, (it.reactionCount ?? 0) + delta),
              }
            : it,
        ),
      );
      setCurrentByPostId(prev => ({ ...prev, [postId]: nextKey }));
      setCountsByPostId(prev => {
        const base: ReactionCounts = prev[postId] ?? {
          like: 0,
          love: 0,
          happy: 0,
          sad: 0,
          wow: 0,
          angry: 0,
        };
        const next = { ...base } as ReactionCounts;
        if (prevKey) next[prevKey] = Math.max(0, (next[prevKey] ?? 0) - 1);
        if (nextKey) next[nextKey] = (next[nextKey] ?? 0) + 1;
        return { ...prev, [postId]: next };
      });

      // Persistencia
      try {
        await setMyReactionKey(postId, nextKey);
      } finally {
        // Reconciliar con servidor
        startTransition(async () => {
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
                ? {
                    ...it,
                    reactionCount: total,
                    reactedByMe: finalKey === 'love',
                  }
                : it,
            ),
          );
        });
      }
    },
    [uid, currentByPostId, setMyReactionKey],
  );

  const handleReactKeyUI = useCallback(
    async (postId: string, key: UIReactionKey | null) => {
      const nextKey: PostReactionKey | null =
        key && key !== 'match' ? (key as PostReactionKey) : null;
      return handleReactKeyExact(postId, nextKey);
    },
    [handleReactKeyExact],
  );

  const onToggleReact = useCallback(
    async (postId: string, next: boolean) => {
      if (!uid) return;
      const key: PostReactionKey | null = next ? 'love' : null;
      await handleReactKeyExact(postId, key);
    },
    [uid, handleReactKeyExact],
  );

  /* Viewability + prefetch throttle */
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 85 }).current;
  const lastVisibleIdsRef = useRef<Set<string>>(new Set());
  const rafPendingRef = useRef<number | null>(null);
  const viewabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const nextIds = new Set<string>();
      for (const v of viewableItems) {
        if (v.isViewable) {
          const it = v.item as PostCardVM;
          nextIds.add(it.id);
        }
      }
      const prevIds = lastVisibleIdsRef.current;
      let changed = nextIds.size !== prevIds.size;
      if (!changed) {
        for (const id of nextIds) {
          if (!prevIds.has(id)) {
            changed = true;
            break;
          }
        }
      }
      if (!changed) {
        // throttle de prefetch del "último"
        const last = viewableItems[viewableItems.length - 1];
        const maybeUrl =
          last && (last.item as PostCardVM)
            ? firstImageUrlOf(last.item as PostCardVM)
            : null;

        if (viewabilityTimerRef.current) return;
        viewabilityTimerRef.current = setTimeout(() => {
          if (maybeUrl) Image.prefetch(maybeUrl).catch(() => {});
          viewabilityTimerRef.current = null;
        }, VIEWABILITY_THROTTLE_MS);
        return;
      }

      lastVisibleIdsRef.current = nextIds;

      if (rafPendingRef.current != null) {
        cancelAnimationFrame(rafPendingRef.current);
      }
      rafPendingRef.current = requestAnimationFrame(() => {
        applyVisibleMap(nextIds);

        const last = viewableItems[viewableItems.length - 1];
        const maybeUrl =
          last && (last.item as PostCardVM)
            ? firstImageUrlOf(last.item as PostCardVM)
            : null;

        if (!viewabilityTimerRef.current) {
          viewabilityTimerRef.current = setTimeout(() => {
            if (maybeUrl) Image.prefetch(maybeUrl).catch(() => {});
            viewabilityTimerRef.current = null;
          }, VIEWABILITY_THROTTLE_MS);
        }

        rafPendingRef.current = null;
      });
    },
  ).current;

  useEffect(() => {
    return () => {
      if (rafPendingRef.current != null)
        cancelAnimationFrame(rafPendingRef.current);
      if (viewabilityTimerRef.current)
        clearTimeout(viewabilityTimerRef.current);
    };
  }, []);

  /* Render item */
  const renderItem: ListRenderItem<PostCardVM> = useCallback(
    ({ item, index }) => {
      const author = authorByPostId[item.id];
      const current = (currentByPostId[item.id] ??
        null) as UIReactionKey | null;
      const counts = getUICountsMemo(countsByPostId[item.id]);
      const isVisible = !!visibleMap[item.id];
      return (
        <AnimatedPostItem
          item={item}
          index={index}
          {...(author ? ({ author } as const) : {})}
          onToggleReact={onToggleReact}
          currentReaction={current}
          {...(Object.keys(counts).length ? ({ counts } as const) : {})}
          onReactKey={handleReactKeyUI}
          isVisible={isVisible}
          onCommentPress={openComments}
        />
      );
    },
    [
      authorByPostId,
      currentByPostId,
      countsByPostId,
      visibleMap,
      onToggleReact,
      handleReactKeyUI,
      openComments,
    ],
  );

  const keyExtractor = useCallback((it: PostCardVM) => it.id, []);

  const listContentStyle = useMemo(
    () =>
      ({
        paddingTop: insets.top + 8,
        paddingHorizontal: 0,
        paddingBottom: 96,
      } as const),
    [insets.top],
  );

  /* Header y Footer */
  const ListHeader = useMemo(
    () => (
      <Animated.View
        style={{
          transform: [
            { translateY: bannerTranslateY as unknown as number },
            { scale: bannerScale as unknown as number },
          ],
          opacity: bannerOpacity as unknown as number,
        }}
      >
        <FeedHeaderBanner />
        <FeedComposerBar
          {...(me.name ? ({ name: me.name } as const) : {})}
          {...(me.photoURL ? ({ photoURL: me.photoURL } as const) : {})}
          onPress={() => {
            // navegación declarativa (mantén tu ruta real)
            // @ts-expect-error – navegación acoplada fuera de este archivo
            // se resuelve en tu stack principal
            globalThis.__NAV__?.navigate?.('CreatePost');
          }}
        />
      </Animated.View>
    ),
    [bannerTranslateY, bannerScale, bannerOpacity, me],
  );

  const ListFooter = useMemo(
    () =>
      loadingMore ? (
        <View style={styles.footer}>
          <ActivityIndicator />
        </View>
      ) : null,
    [loadingMore],
  );

  /* ───────────────────────── UI ───────────────────────── */
  return (
    <Screen edges={[]}>
      {/* Overlay bajo el notch */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: theme.colors.background,
          opacity: notchFadeOpacity as unknown as number,
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
            // @ts-expect-error – navegación out-of-file
            onPress={() => globalThis.__NAV__?.navigate?.('CreatePost')}
            style={{ marginTop: 8 }}
            icon="plus"
          >
            Nueva actualización
          </Button>
        </View>
      ) : PREFER_FLASHLIST && FlashListComp ? (
        <FlashListComp
          ref={flashRef}
          data={cards}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={LIST_TUNING.onEndReachedThreshold}
          onMomentumScrollBegin={() => {
            endReachedDuringMomentum.current = false;
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={listContentStyle as StyleProp<ViewStyle>}
          estimatedItemSize={420}
          onScroll={onScrollAnim}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      ) : (
        <Animated.FlatList
          ref={flatRef}
          data={cards}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={LIST_TUNING.onEndReachedThreshold}
          onMomentumScrollBegin={() => {
            endReachedDuringMomentum.current = false;
          }}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={listContentStyle}
          removeClippedSubviews
          windowSize={LIST_TUNING.windowSize}
          maxToRenderPerBatch={LIST_TUNING.maxToRenderPerBatch}
          updateCellsBatchingPeriod={LIST_TUNING.updateCellsBatchingPeriod}
          initialNumToRender={LIST_TUNING.initialNumToRender}
          onScroll={
            Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            ) as (e: NativeSyntheticEvent<NativeScrollEvent>) => void
          }
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      <CommentsSheet
        visible={openCommentsFor !== null}
        postId={openCommentsFor ?? ''}
        onDismiss={() => setOpenCommentsFor(null)}
      />
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
