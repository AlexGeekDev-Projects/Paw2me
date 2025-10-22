// src/components/feed/PostCard.tsx
import React, { memo, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  PixelRatio,
  Image as RNImage,
  Platform,
  FlatList,
  type ListRenderItem,
  type ViewToken,
} from 'react-native';
import {
  Card,
  Text,
  useTheme,
  Portal,
  Modal,
  IconButton,
} from 'react-native-paper';
import ReactionFooter from '@components/reactions/ReactionFooterPosts';
import type { PostCardVM } from '@models/post';
import { buildCdnUrl, type CdnProvider } from '@utils/cdn';

/* ─────────────────────────────────────────────────────────────
 * Cargas opcionales (sin romper tipado estricto)
 * ───────────────────────────────────────────────────────────── */
let FastImage: { resizeMode: { cover: 'cover'; contain: 'contain' } } | null =
  null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FastImage = require('react-native-fast-image').default;
} catch {}
const ImageComponent: React.ComponentType<
  Readonly<{
    source: { uri: string } | number;
    style: { width: number | string; height: number | string };
    resizeMode?: 'cover' | 'contain';
  }>
> =
  (FastImage as unknown as React.ComponentType<any>) ??
  (RNImage as unknown as React.ComponentType<any>);

/** Props mínimas que usaremos de react-native-video (evita any + intersecciones peligrosas) */
type SimpleVideoProps = Readonly<{
  source: Readonly<{ uri: string }>;
  style: Readonly<{ width: number | string; height: number | string }>;
  /** En grid los mostramos silenciados/pausados; en visor controlamos por índice */
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'none' | 'center';
  controls?: boolean;
}>;
let VideoComp: React.ComponentType<SimpleVideoProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-video');
  VideoComp = (mod?.default ?? mod) as React.ComponentType<SimpleVideoProps>;
} catch {}

/* ───────────────────────────────────────────────────────────── */
type MediaItem = Readonly<{ type: 'image' | 'video'; url: string }>;
type AuthorLite = Readonly<{ name: string; photoURL?: string }>;

type Props = Readonly<{
  data: PostCardVM;
  /** opcional: si no viene, se muestra nombre “Usuario” + avatar default */
  author?: AuthorLite;
  onToggleReact: (postId: string, next: boolean) => void | Promise<void>;
}>;

const PROVIDER: CdnProvider = 'auto';
const GAP = 2;
const defaultAvatar = require('@assets/images/user.png') as number;

const cdnImg = (url: string, w: number, dpr: number, q = 80): string =>
  buildCdnUrl(
    url,
    {
      w: Math.min(1920, Math.ceil(w * dpr)),
      q,
      fit: 'cover',
      gravity: 'faces',
      dpr,
    },
    PROVIDER,
  );

/* Garantiza elemento (útil con noUncheckedIndexedAccess) */
function at<T>(arr: readonly T[], idx: number): T {
  const v = arr[idx];
  if (v === undefined) throw new Error(`Index out of bounds: ${idx}`);
  return v;
}

/* ─────────────────────────────────────────────────────────────
 * Tiles (grid 2 columnas) — con overlay +N en última celda visible
 * ───────────────────────────────────────────────────────────── */
const Tile: React.FC<
  Readonly<{
    item: MediaItem;
    w: number;
    h: number;
    dpr: number;
    overlayPlus?: number;
  }>
> = ({ item, w, h, dpr, overlayPlus = 0 }) => {
  const uri = item.type === 'image' ? cdnImg(item.url, w, dpr, 80) : item.url;

  return (
    <View style={{ width: w, height: h, backgroundColor: '#eee' }}>
      {item.type === 'image' ? (
        <ImageComponent
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
        />
      ) : VideoComp ? (
        <VideoComp
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          paused
          muted
          repeat
          resizeMode="cover"
        />
      ) : (
        <View
          style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
        />
      )}

      {overlayPlus > 0 ? (
        <View style={styles.plusOverlay}>
          <Text variant="headlineMedium" style={styles.plusText}>
            +{overlayPlus}
          </Text>
        </View>
      ) : null}

      {overlayPlus === 0 && item.type === 'video' ? (
        <View style={styles.playBadge}>
          <Text style={styles.playGlyph}>▶︎</Text>
        </View>
      ) : null}
    </View>
  );
};

const SingleMedia: React.FC<
  Readonly<{ item: MediaItem; cardW: number; dpr: number }>
> = ({ item, cardW, dpr }) => {
  const uri =
    item.type === 'image' ? cdnImg(item.url, cardW, dpr, 90) : item.url;
  return item.type === 'image' ? (
    <ImageComponent
      source={{ uri }}
      style={{ width: '100%', height: '100%' }}
      resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
    />
  ) : VideoComp ? (
    <VideoComp
      source={{ uri }}
      style={{ width: '100%', height: '100%' }}
      paused
      muted
      repeat
      resizeMode="cover"
    />
  ) : (
    <View style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />
  );
};

/* ─────────────────────────────────────────────────────────────
 * Main
 * ───────────────────────────────────────────────────────────── */
const PostCard: React.FC<Props> = ({ data, author, onToggleReact }) => {
  const theme = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const cardW = winW; // ancho completo (sin márgenes)
  const dpr = PixelRatio.get();

  const images = Array.isArray(data.imageUrls) ? data.imageUrls : [];
  const videos = Array.isArray(data.videoUrls) ? data.videoUrls : [];
  const media: readonly MediaItem[] = [
    ...images.map(u => ({ type: 'image' as const, url: u })),
    ...videos.map(u => ({ type: 'video' as const, url: u })),
  ];
  const hasMany = media.length > 1;

  // Posiciones de la grilla (2 columnas) — patrones FB-like
  type Pos = Readonly<{
    idx: number;
    x: number;
    y: number;
    w: number;
    h: number;
    overlay?: number;
  }>;

  const { gridH, positions } = useMemo((): Readonly<{
    gridH: number;
    positions: readonly Pos[];
  }> => {
    if (!hasMany) return { gridH: Math.round(cardW * 0.8), positions: [] };

    const len = media.length;
    const colW = Math.floor((cardW - GAP) / 2);
    const square = colW;

    // 2 → dos altas (3:4 aprox)
    if (len === 2) {
      const tallH = Math.round((colW * 4) / 3);
      return {
        gridH: tallH,
        positions: [
          { idx: 0, x: 0, y: 0, w: colW, h: tallH },
          { idx: 1, x: colW + GAP, y: 0, w: colW, h: tallH },
        ],
      };
    }

    // 3 → L: izquierda grande + dos cuadrados derecha
    if (len === 3) {
      return {
        gridH: square * 2 + GAP,
        positions: [
          { idx: 0, x: 0, y: 0, w: colW, h: square * 2 + GAP },
          { idx: 1, x: colW + GAP, y: 0, w: colW, h: square },
          { idx: 2, x: colW + GAP, y: square + GAP, w: colW, h: square },
        ],
      };
    }

    // 4 → 2x2
    if (len === 4) {
      return {
        gridH: square * 2 + GAP,
        positions: [
          { idx: 0, x: 0, y: 0, w: colW, h: square },
          { idx: 1, x: colW + GAP, y: 0, w: colW, h: square },
          { idx: 2, x: 0, y: square + GAP, w: colW, h: square },
          { idx: 3, x: colW + GAP, y: square + GAP, w: colW, h: square },
        ],
      };
    }

    // ≥5 → 2 rectangulares arriba + 3 cuadrados abajo (overlay en el último)
    const thirdW = Math.floor((cardW - GAP * 2) / 3);
    const rowTopH = thirdW;
    const positionsTop: Pos[] = [
      { idx: 0, x: 0, y: 0, w: colW, h: rowTopH },
      { idx: 1, x: colW + GAP, y: 0, w: colW, h: rowTopH },
    ];
    const baseBottom: readonly Pos[] = [
      { idx: 2, x: 0, y: rowTopH + GAP, w: thirdW, h: thirdW },
      { idx: 3, x: thirdW + GAP, y: rowTopH + GAP, w: thirdW, h: thirdW },
      {
        idx: 4,
        x: thirdW * 2 + GAP * 2,
        y: rowTopH + GAP,
        w: thirdW,
        h: thirdW,
      },
    ];
    const remaining = Math.max(0, len - 5);
    const positionsBottom: Pos[] =
      remaining > 0
        ? baseBottom.map((p, i) => (i === 2 ? { ...p, overlay: remaining } : p))
        : baseBottom.slice();

    return {
      gridH: rowTopH + GAP + thirdW,
      positions: [...positionsTop, ...positionsBottom],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMany, cardW, media.length]);

  /* ─────────────── Visor vertical (estilo Reels) ─────────────── */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<MediaItem>>(null);

  const openViewerAt = useCallback((i: number) => {
    setViewerIndex(i);
    setActiveIndex(i);
    setViewerOpen(true);
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 95 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const v = viewableItems[0];
      if (v && typeof v.index === 'number') setActiveIndex(v.index);
    },
  ).current;

  const renderViewerItem: ListRenderItem<MediaItem> = useCallback(
    ({ item, index }) => {
      if (item.type === 'image') {
        return (
          <View
            style={{
              width: winW,
              height: winH,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageComponent
              source={{ uri: cdnImg(item.url, winW, dpr, 90) }}
              style={{ width: winW, height: winH }}
              resizeMode={FastImage ? FastImage.resizeMode.contain : 'contain'}
            />
          </View>
        );
      }
      return (
        <View style={{ width: winW, height: winH, backgroundColor: '#000' }}>
          {VideoComp ? (
            <VideoComp
              source={{ uri: item.url }}
              style={{ width: winW, height: winH }}
              controls
              paused={index !== activeIndex}
              resizeMode="contain"
            />
          ) : null}
        </View>
      );
    },
    [winW, winH, dpr, activeIndex],
  );

  return (
    <Card
      mode="elevated"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: 0,
          marginHorizontal: 0, // sin márgenes laterales
        },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderColor: 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <ImageComponent
          source={
            author?.photoURL
              ? { uri: author.photoURL }
              : (defaultAvatar as number)
          }
          style={styles.avatar}
          resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
        />
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" style={styles.authorName}>
            {author?.name ?? 'Usuario'}
          </Text>
          <Text variant="labelSmall" style={{ opacity: 0.7 }}>
            {new Date(data.createdAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </View>
        <IconButton icon="dots-horizontal" onPress={() => {}} />
      </View>

      {/* Texto arriba */}
      {data.content ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <Text variant="bodyLarge">{data.content}</Text>
        </View>
      ) : null}

      {/* Media */}
      {media.length === 0 ? null : hasMany ? (
        <View style={[styles.grid, { height: gridH }]}>
          {positions.map((p, k) => (
            <Pressable
              key={`p-${k}`}
              onPress={() => openViewerAt(p.idx)}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                width: p.w,
                height: p.h,
              }}
            >
              <Tile
                item={at(media, p.idx)}
                w={p.w}
                h={p.h}
                dpr={dpr}
                overlayPlus={p.overlay ?? 0}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <View
          style={{ width: '100%', aspectRatio: 1, backgroundColor: '#eee' }}
        >
          <SingleMedia item={at(media, 0)} cardW={cardW} dpr={dpr} />
        </View>
      )}

      {/* Footer con fondo (separado del media) */}
      <View
        style={[
          styles.footerWrap,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <ReactionFooter
          id={data.id}
          current={data.reactedByMe ? 'love' : null}
          counts={{ love: data.reactionCount }}
          availableKeys={['like', 'love', 'happy', 'sad', 'wow', 'angry']}
          onReact={(id, key, active) => {
            if (key !== 'love') return;
            void onToggleReact(id, active);
          }}
          commentsCount={data.commentCount}
          sharesCount={data.shareCount}
        />
      </View>

      {/* Visor modal vertical (pagingEnabled) */}
      <Portal>
        <Modal
          visible={viewerOpen}
          onDismiss={() => setViewerOpen(false)}
          contentContainerStyle={[
            styles.viewer,
            {
              backgroundColor:
                Platform.OS === 'web' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.95)',
            },
          ]}
        >
          <FlatList
            ref={listRef}
            data={media}
            keyExtractor={(_m, i) => `v-${i}`}
            renderItem={renderViewerItem}
            horizontal={false}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            initialScrollIndex={viewerIndex}
            getItemLayout={(_d, index) => ({
              length: winH,
              offset: winH * index,
              index,
            })}
            onScrollToIndexFailed={info => {
              // fallback robusto si RN no tiene aún medido el layout
              setTimeout(() => {
                listRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                });
              }, 0);
            }}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            style={{ width: winW, height: winH }}
          />
          <IconButton
            icon="close"
            onPress={() => setViewerOpen(false)}
            style={{ position: 'absolute', top: 8, right: 8 }}
            containerColor="rgba(0,0,0,0.6)"
            iconColor="#fff"
          />
        </Modal>
      </Portal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginVertical: 8, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#ddd',
  },
  authorName: { fontWeight: '700' },
  grid: { position: 'relative', width: '100%', backgroundColor: '#000' },
  footerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  plusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: '#fff', fontWeight: '800' },
  playBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: '#fff', fontSize: 12, marginLeft: 1 },
  viewer: {
    marginHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
});

export default memo(PostCard, (a, b) => {
  const x = a.data,
    y = b.data;
  return (
    x.id === y.id &&
    x.reactedByMe === y.reactedByMe &&
    x.reactionCount === y.reactionCount &&
    x.content === y.content &&
    (x.imageUrls?.[0] ?? '') === (y.imageUrls?.[0] ?? '') &&
    (x.videoUrls?.[0] ?? '') === (y.videoUrls?.[0] ?? '') &&
    (a.author?.name ?? '') === (b.author?.name ?? '') &&
    (a.author?.photoURL ?? '') === (b.author?.photoURL ?? '') &&
    a.onToggleReact === b.onToggleReact
  );
});
