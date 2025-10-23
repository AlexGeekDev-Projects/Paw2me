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
  Modal as RNModal,
  FlatList,
} from 'react-native';
import type {
  ListRenderItem,
  ViewToken,
  ViewabilityConfig,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  Text,
  useTheme,
  Portal,
  Divider,
  Button,
  IconButton,
} from 'react-native-paper';

import ReactionFooter from '@components/reactions/ReactionFooterPosts';
import type { PostCardVM } from '@models/post';
import { buildCdnUrl, type CdnProvider } from '@utils/cdn';
import CommentsSheet, {
  type CommentItem,
} from '@components/comments/CommentsSheet';

// ── FastImage opcional
let FastImage: any = null;
try {
  FastImage = require('react-native-fast-image').default;
} catch {}
const ImageComponent: any = FastImage ?? RNImage;

// ── Video opcional
type VideoPropsLite = Readonly<{
  source: { uri: string };
  style: { width: number | string; height: number | string };
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'none' | 'center';
  controls?: boolean;
}>;
let RNVideo: React.ComponentType<VideoPropsLite> | null = null;
try {
  RNVideo = require('react-native-video')
    .default as React.ComponentType<VideoPropsLite>;
} catch {
  RNVideo = null;
}

// ── Zoom de imágenes (pinch-to-zoom) con react-native-image-viewing
let ImageViewing: any = null;
try {
  ImageViewing = require('react-native-image-viewing').default;
} catch {
  ImageViewing = null;
}

/* ───────────────────────────────────────────────────────────── */
type MediaItem = Readonly<{ type: 'image' | 'video'; url: string }>;
type AuthorLite = Readonly<{ name: string; photoURL?: string }>;

type Props = Readonly<{
  data: PostCardVM;
  author?: AuthorLite;
  onToggleReact: (postId: string, next: boolean) => void | Promise<void>;
}>;

const PROVIDER: CdnProvider = 'auto';
const GAP = 2;
const HEADER_BAR_H = 44;
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

function at<T>(arr: readonly T[], idx: number): T {
  const v = arr[idx];
  if (v === undefined) throw new Error(`Index out of bounds: ${idx}`);
  return v;
}

/* ─────────────────────────────────────────────────────────────
 * Tiles del feed
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
  const isVideo = item.type === 'video';

  return (
    <View style={{ width: w, height: h, backgroundColor: '#000' }}>
      {item.type === 'image' ? (
        <ImageComponent
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
        />
      ) : RNVideo ? (
        <RNVideo
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

      {overlayPlus === 0 && isVideo ? (
        <View style={styles.playBadge}>
          <Text style={styles.playGlyph}>▶︎</Text>
        </View>
      ) : null}
      {overlayPlus > 0 ? (
        <View style={styles.plusOverlay}>
          <Text variant="headlineMedium" style={styles.plusText}>
            +{overlayPlus}
          </Text>
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
  ) : RNVideo ? (
    <RNVideo
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
 * MAIN
 * ───────────────────────────────────────────────────────────── */
const PostCard: React.FC<Props> = ({ data, author, onToggleReact }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const cardW = winW;
  const dpr = PixelRatio.get();

  const images = Array.isArray(data.imageUrls) ? data.imageUrls : [];
  const videos = Array.isArray(data.videoUrls) ? data.videoUrls : [];
  const media: readonly MediaItem[] = [
    ...images.map(u => ({ type: 'image' as const, url: u })),
    ...videos.map(u => ({ type: 'video' as const, url: u })),
  ];
  const hasMany = media.length > 1;

  // grilla feed
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

    const thirdW = Math.floor((cardW - GAP * 2) / 3);
    const rowTopH = thirdW;
    const top: Pos[] = [
      { idx: 0, x: 0, y: 0, w: colW, h: rowTopH },
      { idx: 1, x: colW + GAP, y: 0, w: colW, h: rowTopH },
    ];
    const bottomCount = Math.min(3, len - 2);
    const bottom: Pos[] = Array.from({ length: bottomCount }).map((_, i) => ({
      idx: 2 + i,
      x: i * (thirdW + GAP),
      y: rowTopH + GAP,
      w: thirdW,
      h: thirdW,
    }));
    const remaining = Math.max(0, len - 5);
    if (remaining > 0 && bottom.length === 3) {
      bottom[2] = { ...bottom[2]!, overlay: remaining };
    }
    return { gridH: rowTopH + GAP + thirdW, positions: [...top, ...bottom] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMany, cardW, GAP, media.length]);

  // visor vertical
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [imgZoomOpen, setImgZoomOpen] = useState(false);
  const [imgZoomUri, setImgZoomUri] = useState<string | null>(null);

  const openViewerAt = useCallback((i: number) => {
    setViewerIndex(i);
    setViewerOpen(true);
  }, []);

  const totalHeader = insets.top + HEADER_BAR_H;
  const pageH = Math.max(1, Math.round(winH - totalHeader)); // cada página visible

  // comentarios (sheet general del post)
  const [commentsOpen, setCommentsOpen] = useState(false);
  const fakeComments = useRef<ReadonlyArray<CommentItem>>([
    {
      id: 'c1',
      author: 'Ana',
      text: '¡Qué ternura!',
      createdAt: Date.now() - 300000,
    },
    {
      id: 'c2',
      author: 'Luis',
      text: 'Hermosas fotos 😍',
      createdAt: Date.now() - 120000,
    },
  ]).current;

  // viewability correcto
  const onViewableItemsChanged = useRef(
    (info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      const first = info.viewableItems.find(v => v.isViewable);
      const idx = first?.index;
      if (typeof idx === 'number') setViewerIndex(idx);
    },
  ).current;

  const viewabilityConfig = useRef<ViewabilityConfig>({
    itemVisiblePercentThreshold: 90,
  }).current;

  const renderViewerItem: ListRenderItem<MediaItem> = useCallback(
    ({ item: m, index: i }) => {
      const body =
        m.type === 'image' ? (
          <Pressable
            onPress={() => {
              if (!ImageViewing) return;
              setImgZoomUri(m.url);
              setImgZoomOpen(true);
            }}
            style={{
              width: cardW,
              height: pageH,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ImageComponent
              source={{ uri: cdnImg(m.url, cardW, PixelRatio.get(), 92) }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={FastImage ? FastImage.resizeMode.contain : 'contain'}
            />
          </Pressable>
        ) : RNVideo ? (
          <View
            style={{ width: cardW, height: pageH, backgroundColor: '#000' }}
          >
            <RNVideo
              source={{ uri: m.url }}
              style={{ width: '100%', height: '100%' }}
              controls
              paused={viewerIndex !== i}
              muted={viewerIndex !== i}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View
            style={{ width: cardW, height: pageH, backgroundColor: '#000' }}
          />
        );

      return (
        <View style={{ width: cardW, height: pageH, backgroundColor: '#000' }}>
          {body}
        </View>
      );
    },
    [cardW, pageH, viewerIndex],
  );

  return (
    <Card
      mode="elevated"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: 0,
          marginHorizontal: 0,
        },
      ]}
    >
      {/* HEADER POST */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderColor: 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <RNImage
          source={
            author?.photoURL
              ? { uri: author.photoURL }
              : (defaultAvatar as number)
          }
          style={styles.avatar}
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

      {/* TEXTO */}
      {data.content ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text variant="bodyLarge">{data.content}</Text>
        </View>
      ) : null}

      {/* MEDIA (feed) */}
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
        <Pressable
          style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}
          onPress={() => openViewerAt(0)}
        >
          <SingleMedia item={at(media, 0)} cardW={cardW} dpr={dpr} />
        </Pressable>
      )}

      {/* FOOTER feed (reacciones + abrir comments) */}
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
        <View
          style={{
            alignItems: 'flex-start',
            paddingHorizontal: 12,
            paddingTop: 2,
          }}
        >
          <Button
            mode="text"
            compact
            icon="comment-outline"
            onPress={() => setCommentsOpen(true)}
          >
            Ver comentarios
          </Button>
        </View>
        <Divider style={{ opacity: 0.06 }} />
      </View>

      {/* VISOR VERTICAL: puro media + header fijo */}
      <Portal>
        <RNModal
          visible={viewerOpen}
          onRequestClose={() => setViewerOpen(false)}
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          transparent={false}
        >
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* Listado vertical detrás del header */}
            <FlatList
              style={{ flex: 1, marginTop: totalHeader }} // <- SIN paddingTop
              data={media as MediaItem[]}
              keyExtractor={(_m, i) => `media-${i}`}
              renderItem={renderViewerItem}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_d, index) => ({
                length: pageH,
                offset: pageH * index,
                index,
              })}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              removeClippedSubviews
              windowSize={3}
            />

            {/* Header fijo, pegado al notch sin huecos */}
            <View
              style={[
                styles.viewerHeaderBar,
                { paddingTop: insets.top, height: totalHeader },
              ]}
            >
              <Pressable
                onPress={() => setViewerOpen(false)}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Regresar a la publicación"
              >
                <Text style={{ color: '#fff', fontSize: 20 }}>{'‹'}</Text>
              </Pressable>

              <RNImage
                source={
                  author?.photoURL
                    ? { uri: author.photoURL }
                    : (defaultAvatar as number)
                }
                style={styles.viewerAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text
                  variant="titleSmall"
                  style={[styles.authorName, { color: '#fff' }]}
                >
                  {author?.name ?? 'Usuario'}
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ opacity: 0.85, color: '#fff' }}
                >
                  {new Date(data.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </View>

          {/* Zoom individual de imagen (lib externa) */}
          {ImageViewing && imgZoomUri ? (
            <ImageViewing
              images={[{ uri: imgZoomUri }]}
              imageIndex={0}
              visible={imgZoomOpen}
              onRequestClose={() => setImgZoomOpen(false)}
              backgroundColor="#000"
              swipeToCloseEnabled
              doubleTapToZoomEnabled
            />
          ) : null}
        </RNModal>
      </Portal>

      {/* SHEET DE COMENTARIOS (generales del post) */}
      <CommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={data.id}
        comments={fakeComments}
        onSend={async t => {
          console.log('send comment', { postId: data.id, text: t });
        }}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginVertical: 8, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
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

  // Header fijo del visor
  viewerHeaderBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  viewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#333',
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
