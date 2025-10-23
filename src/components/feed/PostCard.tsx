import React, { memo, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  PixelRatio,
  Image as RNImage,
  FlatList,
  Modal as RNModal,
  type ListRenderItem,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Text, useTheme, Portal, IconButton } from 'react-native-paper';
import ReactionFooter from '@components/reactions/ReactionFooterPosts';
import type { PostCardVM } from '@models/post';
import { buildCdnUrl, type CdnProvider } from '@utils/cdn';

/* ───────── Cargas opcionales ───────── */
let FastImage: { resizeMode: { cover: 'cover'; contain: 'contain' } } | null =
  null;
try {
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

type SimpleVideoProps = Readonly<{
  source: { uri: string };
  style: { width: number | string; height: number | string };
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'none' | 'center';
  controls?: boolean;
}>;
let VideoComp: React.ComponentType<SimpleVideoProps> | null = null;
try {
  const mod = require('react-native-video');
  VideoComp = (mod?.default ?? mod) as React.ComponentType<SimpleVideoProps>;
} catch {}

let ImageViewing: React.ComponentType<any> | null = null;
try {
  ImageViewing = require('react-native-image-viewing').default;
} catch {}

/* ───────── Tipos ───────── */
type MediaItem = Readonly<{ type: 'image' | 'video'; url: string }>;
type AuthorLite = Readonly<{ name: string; photoURL?: string }>;
type UIReactionKey =
  | 'like'
  | 'love'
  | 'happy'
  | 'sad'
  | 'wow'
  | 'angry'
  | 'match';
type UIReactionCounts = Readonly<{
  like: number;
  love: number;
  happy: number;
  sad: number;
  wow: number;
  angry: number;
  match: number;
}>;

type Props = Readonly<{
  data: PostCardVM;
  author?: AuthorLite;

  /** LEGADO: solo ‘love’ */
  onToggleReact?: (postId: string, next: boolean) => void | Promise<void>;

  /** NUEVO: multi-reacción */
  currentReaction?: UIReactionKey | null;
  counts?: Partial<UIReactionCounts>;
  availableKeys?: UIReactionKey[];
  onReactKey?: (
    postId: string,
    key: UIReactionKey | null,
  ) => void | Promise<void>;
}>;

const PROVIDER: CdnProvider = 'auto';
const GAP = 2;
const HEADER_BAR_H = 44;
const defaultAvatar = require('@assets/images/user.png') as number;

/** ✅ Firma correcta: buildCdnUrl(url, opts, provider) */
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

/* helpers */
function at<T>(arr: readonly T[], idx: number): T {
  const v = arr[idx];
  if (v === undefined) throw new Error(`Index out of bounds: ${idx}`);
  return v;
}

/* ───────── Grid tiles ───────── */
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
    <View style={{ width: w, height: h, backgroundColor: '#000' }}>
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

/* ───────── Componente ───────── */
const PostCard: React.FC<Props> = ({
  data,
  author,
  onToggleReact,
  currentReaction,
  counts,
  availableKeys,
  onReactKey,
}) => {
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

  /* ───── Visor vertical ───── */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerListRef = useRef<FlatList<MediaItem>>(null);
  const [imgZoomOpen, setImgZoomOpen] = useState(false);
  const [imgZoomUri, setImgZoomUri] = useState<string | null>(null);

  const openViewerAt = useCallback((i: number) => {
    setViewerIndex(i);
    setViewerOpen(true);
  }, []);
  const totalHeader = insets.top + HEADER_BAR_H;
  const pageH = Math.max(1, Math.round(winH - totalHeader));

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find(v => v.isViewable);
      if (typeof first?.index === 'number') setViewerIndex(first.index);
    },
  ).current;

  const onScrollToIndexFailed = useCallback(
    (e: { index: number }) => {
      const safeIndex = Math.max(0, Math.min(e.index, media.length - 1));
      const offset = pageH * safeIndex;
      requestAnimationFrame(() => {
        viewerListRef.current?.scrollToOffset?.({ offset, animated: false });
      });
    },
    [media.length, pageH],
  );

  const renderViewerItem: ListRenderItem<MediaItem> = useCallback(
    ({ item, index }) => {
      if (item.type === 'image') {
        return (
          <Pressable
            onPress={() => {
              if (!ImageViewing) return;
              setImgZoomUri(item.url);
              setImgZoomOpen(true);
            }}
            style={{
              width: winW,
              height: pageH,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000',
            }}
          >
            <ImageComponent
              source={{ uri: cdnImg(item.url, winW, dpr, 92) }}
              style={{ width: winW, height: pageH }}
              resizeMode={FastImage ? FastImage.resizeMode.contain : 'contain'}
            />
          </Pressable>
        );
      }
      return (
        <View style={{ width: winW, height: pageH, backgroundColor: '#000' }}>
          {VideoComp ? (
            <VideoComp
              source={{ uri: item.url }}
              style={{ width: winW, height: pageH }}
              controls
              paused={viewerIndex !== index}
              muted={viewerIndex !== index}
              resizeMode="contain"
            />
          ) : null}
        </View>
      );
    },
    [winW, pageH, dpr, viewerIndex],
  );

  /* ───── Footer y conteos (sin “love” fantasma) ───── */
  const keysAvailable: UIReactionKey[] = availableKeys ?? [
    'like',
    'love',
    'happy',
    'sad',
    'wow',
    'angry',
  ];
  const isMulti = Boolean(onReactKey) || keysAvailable.some(k => k !== 'love');
  const zeroCounts: UIReactionCounts = {
    like: 0,
    love: 0,
    happy: 0,
    sad: 0,
    wow: 0,
    angry: 0,
    match: 0,
  };

  const countsMerged: UIReactionCounts = isMulti
    ? { ...zeroCounts, ...(counts ?? {}) } // multi → NO sembrar love
    : { ...zeroCounts, love: data.reactionCount ?? 0, ...(counts ?? {}) }; // legado → solo love

  const footerCurrent: UIReactionKey | null =
    typeof currentReaction !== 'undefined'
      ? currentReaction
      : data.reactedByMe
        ? 'love'
        : null;

  const handleReact = useCallback(
    (id: string, key: UIReactionKey, active: boolean) => {
      if (onReactKey) {
        void onReactKey(id, active ? key : null);
        return;
      }
      if (key === 'love' && onToggleReact) {
        void onToggleReact(id, active);
      }
    },
    [onReactKey, onToggleReact],
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

      {/* Texto */}
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
        <Pressable
          style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}
          onPress={() => openViewerAt(0)}
        >
          <SingleMedia item={at(media, 0)} cardW={cardW} dpr={dpr} />
        </Pressable>
      )}

      {/* Footer */}
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
          current={footerCurrent}
          counts={countsMerged}
          availableKeys={keysAvailable}
          onReact={handleReact}
          commentsCount={data.commentCount}
          sharesCount={data.shareCount}
        />
      </View>

      {/* Visor fullscreen vertical */}
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
            <FlatList
              ref={viewerListRef}
              data={media as MediaItem[]}
              keyExtractor={(_m, i) => `v-${i}`}
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
              onScrollToIndexFailed={onScrollToIndexFailed}
              style={{ flex: 1, marginTop: insets.top + HEADER_BAR_H }}
              removeClippedSubviews
              windowSize={3}
            />

            {/* Header del visor */}
            <View
              style={[
                styles.viewerHeaderBar,
                { paddingTop: insets.top, height: insets.top + HEADER_BAR_H },
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
              <ImageComponent
                source={
                  author?.photoURL
                    ? { uri: author.photoURL }
                    : (defaultAvatar as number)
                }
                style={styles.viewerAvatar}
                resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
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

          {/* Zoom de imagen si la lib existe */}
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

/* memo con props opcionales seguro para exactOptionalPropertyTypes */
export default memo(PostCard, (a, b) => {
  const x = a.data,
    y = b.data;
  const countsEq = (c1?: Props['counts'], c2?: Props['counts']) => {
    if (!c1 && !c2) return true;
    if (!c1 || !c2) return false;
    const keys: (keyof UIReactionCounts)[] = [
      'like',
      'love',
      'happy',
      'sad',
      'wow',
      'angry',
      'match',
    ];
    return keys.every(k => (c1 as any)[k] === (c2 as any)[k]);
  };
  return (
    x.id === y.id &&
    x.reactedByMe === y.reactedByMe &&
    x.reactionCount === y.reactionCount &&
    x.content === y.content &&
    (x.imageUrls?.[0] ?? '') === (y.imageUrls?.[0] ?? '') &&
    (x.videoUrls?.[0] ?? '') === (y.videoUrls?.[0] ?? '') &&
    (a.author?.name ?? '') === (b.author?.name ?? '') &&
    (a.author?.photoURL ?? '') === (b.author?.photoURL ?? '') &&
    a.onToggleReact === b.onToggleReact &&
    a.onReactKey === b.onReactKey &&
    a.currentReaction === b.currentReaction &&
    countsEq(a.counts, b.counts) &&
    String(a.availableKeys) === String(b.availableKeys)
  );
});
