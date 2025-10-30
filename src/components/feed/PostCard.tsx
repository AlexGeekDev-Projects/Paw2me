import React, {
  memo,
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  PixelRatio,
  Image as RNImage,
  FlatList,
  Modal as RNModal,
  Animated,
  Pressable,
  type ListRenderItem,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Text, useTheme, Portal, IconButton } from 'react-native-paper';

import ReactionFooter from '@components/reactions/ReactionFooterPosts';
import type { PostCardVM } from '@models/post';
import { buildCdnUrl, type CdnProvider } from '@utils/cdn';
import type { ReactionKey } from '@reactions/types';

// ✅ API nueva de RNGH
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Alias
type UIReactionKey = ReactionKey;
type UIReactionCounts = Readonly<Record<UIReactionKey, number>>;

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

  /** Visibilidad en feed (para autopreview de single video) */
  isVisible?: boolean | undefined;

  onCommentPress?: (postId: string) => void;
  onSharePress?: (postId: string) => void;
}>;

const PROVIDER: CdnProvider = 'auto';
const GAP = 2;
const HEADER_BAR_H = 44;
const defaultAvatar = require('@assets/images/user.png') as number;

/** Firma correcta: buildCdnUrl(url, opts, provider) */
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

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/* Corta por palabra y añade “…” si supera el límite */
const clampAtWord = (text: string, limit: number): string => {
  if (!text) return '';
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  const cut = slice.lastIndexOf(' ');
  const base = cut > Math.floor(limit * 0.6) ? slice.slice(0, cut) : slice;
  return base.replace(/[.,;:!?]+$/, '') + '…';
};

/* ───────── Util: leer Animated.Value sin __getValue ───────── */
const useAnimatedNumberRef = (
  v: Animated.Value,
): React.MutableRefObject<number> => {
  const ref = useRef<number>(1);
  useEffect(() => {
    const id = v.addListener(({ value }) => {
      ref.current = typeof value === 'number' ? value : Number(value);
    });
    return () => v.removeListener(id);
  }, [v]);
  return ref;
};

/* ───────── Util: límites de desplazamiento dado un scale ───────── */
const boundsFor = (scale: number, w: number, h: number) => {
  const maxX = Math.max(0, (w * scale - w) / 2);
  const maxY = Math.max(0, (h * scale - h) / 2);
  return { maxX, maxY };
};

/* ───────── ZoomableImage (Gesture API) ───────── */
const ZoomableImage: React.FC<
  Readonly<{ uri: string; width: number; height: number; contain?: boolean }>
> = ({ uri, width, height, contain = false }) => {
  const cx = width / 2;
  const cy = height / 2;

  // escala acumulada + del gesto
  const base = useRef(new Animated.Value(1)).current;
  const pinch = useRef(new Animated.Value(1)).current;
  const baseRef = useAnimatedNumberRef(base);
  const pinchRef = useAnimatedNumberRef(pinch);

  // pan acumulado + del gesto
  const panBX = useRef(new Animated.Value(0)).current;
  const panBY = useRef(new Animated.Value(0)).current;
  const panGX = useRef(new Animated.Value(0)).current;
  const panGY = useRef(new Animated.Value(0)).current;
  const panBXRef = useAnimatedNumberRef(panBX);
  const panBYRef = useAnimatedNumberRef(panBY);
  const panGXRef = useAnimatedNumberRef(panGX);
  const panGYRef = useAnimatedNumberRef(panGY);

  // compensación por foco de pellizco
  const pinchDX = useRef(new Animated.Value(0)).current;
  const pinchDY = useRef(new Animated.Value(0)).current;
  const pinchDXRef = useAnimatedNumberRef(pinchDX);
  const pinchDYRef = useAnimatedNumberRef(pinchDY);

  const scale = Animated.multiply(base, pinch);
  const transX = Animated.add(panBX, Animated.add(panGX, pinchDX));
  const transY = Animated.add(panBY, Animated.add(panGY, pinchDY));

  /* Pinch centrado en el punto del gesto */
  const pinchG = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate(e => {
          const s = e.scale ?? 1;
          const fx = e.focalX ?? cx;
          const fy = e.focalY ?? cy;

          pinch.setValue(s);

          // mantener el punto de los dedos quieto
          const dx = (fx - cx) * (1 - s);
          const dy = (fy - cy) * (1 - s);
          pinchDX.setValue(dx);
          pinchDY.setValue(dy);
        })
        .onEnd(() => {
          const nextScale = clamp(
            baseRef.current * (pinchRef.current || 1),
            1,
            4,
          );
          base.setValue(nextScale);
          pinch.setValue(1);

          // acumular desplazamiento y limitar a los bordes
          const accX = panBXRef.current + (pinchDXRef.current || 0);
          const accY = panBYRef.current + (pinchDYRef.current || 0);
          const { maxX, maxY } = boundsFor(nextScale, width, height);
          panBX.setValue(clamp(accX, -maxX, maxX));
          panBY.setValue(clamp(accY, -maxY, maxY));
          pinchDX.setValue(0);
          pinchDY.setValue(0);
        })
        .runOnJS(true),
    [
      cx,
      cy,
      width,
      height,
      base,
      pinch,
      panBX,
      panBY,
      pinchDX,
      pinchDY,
      baseRef,
      pinchRef,
      panBXRef,
      panBYRef,
      pinchDXRef,
      pinchDYRef,
    ],
  );

  /* Pan simultáneo (con o sin pinch) */
  const panG = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(2) // 👈 solo 2 dedos
        .onUpdate(e => {
          panGX.setValue(e.translationX ?? 0);
          panGY.setValue(e.translationY ?? 0);
        })
        .onEnd(() => {
          const curScale = baseRef.current * (pinchRef.current || 1);
          const { maxX, maxY } = boundsFor(curScale, width, height);
          const accX = clamp(
            panBXRef.current + (panGXRef.current || 0),
            -maxX,
            maxX,
          );
          const accY = clamp(
            panBYRef.current + (panGYRef.current || 0),
            -maxY,
            maxY,
          );
          panBX.setValue(accX);
          panBY.setValue(accY);
          panGX.setValue(0);
          panGY.setValue(0);
        })
        .runOnJS(true),
    [
      width,
      height,
      panGX,
      panGY,
      panBX,
      panBY,
      baseRef,
      pinchRef,
      panBXRef,
      panBYRef,
      panGXRef,
      panGYRef,
    ],
  );

  /* Doble tap 1x ↔ 2x centrando en el punto tocado */
  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(250)
        .onEnd((e, success) => {
          if (!success) return;
          const tx = e?.x ?? cx;
          const ty = e?.y ?? cy;
          const target = baseRef.current > 1.02 ? 1 : 2;

          // cálculo de desplazamiento para centrar el tap
          const { maxX, maxY } = boundsFor(target, width, height);
          const dx = (tx - cx) * (1 - target);
          const dy = (ty - cy) * (1 - target);
          const nextX = clamp(panBXRef.current + dx, -maxX, maxX);
          const nextY = clamp(panBYRef.current + dy, -maxY, maxY);

          Animated.parallel([
            Animated.spring(base, {
              toValue: target,
              useNativeDriver: true,
              bounciness: 6,
              speed: 12,
            }),
            Animated.spring(panBX, {
              toValue: nextX,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }),
            Animated.spring(panBY, {
              toValue: nextY,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }),
          ]).start();
        })
        .runOnJS(true),
    [base, baseRef, width, height, panBX, panBY, panBXRef, panBYRef, cx, cy],
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pinchG, panG, doubleTap),
    [pinchG, panG, doubleTap],
  );

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={{
          width,
          height,
          overflow: 'hidden',
          backgroundColor: '#000',
          transform: [
            { translateX: transX },
            { translateY: transY },
            { scale },
          ],
        }}
      >
        <ImageComponent
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={
            contain
              ? FastImage
                ? FastImage.resizeMode.contain
                : 'contain'
              : FastImage
              ? FastImage.resizeMode.cover
              : 'cover'
          }
        />
      </Animated.View>
    </GestureDetector>
  );
};

/* ───────── ZoomableVideo (mismo patrón) ───────── */
const ZoomableVideo: React.FC<
  Readonly<{ uri: string; width: number; height: number }>
> = ({ uri, width, height }) => {
  if (!VideoComp) return null;

  const cx = width / 2;
  const cy = height / 2;

  const base = useRef(new Animated.Value(1)).current;
  const pinch = useRef(new Animated.Value(1)).current;
  const baseRef = useAnimatedNumberRef(base);
  const pinchRef = useAnimatedNumberRef(pinch);

  const panBX = useRef(new Animated.Value(0)).current;
  const panBY = useRef(new Animated.Value(0)).current;
  const panGX = useRef(new Animated.Value(0)).current;
  const panGY = useRef(new Animated.Value(0)).current;
  const panBXRef = useAnimatedNumberRef(panBX);
  const panBYRef = useAnimatedNumberRef(panBY);
  const panGXRef = useAnimatedNumberRef(panGX);
  const panGYRef = useAnimatedNumberRef(panGY);

  const pinchDX = useRef(new Animated.Value(0)).current;
  const pinchDY = useRef(new Animated.Value(0)).current;
  const pinchDXRef = useAnimatedNumberRef(pinchDX);
  const pinchDYRef = useAnimatedNumberRef(pinchDY);

  const scale = Animated.multiply(base, pinch);
  const transX = Animated.add(panBX, Animated.add(panGX, pinchDX));
  const transY = Animated.add(panBY, Animated.add(panGY, pinchDY));

  const pinchG = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate(e => {
          const s = e.scale ?? 1;
          const fx = e.focalX ?? cx;
          const fy = e.focalY ?? cy;
          pinch.setValue(s);
          pinchDX.setValue((fx - cx) * (1 - s));
          pinchDY.setValue((fy - cy) * (1 - s));
        })
        .onEnd(() => {
          const nextScale = clamp(
            baseRef.current * (pinchRef.current || 1),
            1,
            4,
          );
          base.setValue(nextScale);
          pinch.setValue(1);

          const accX = panBXRef.current + (pinchDXRef.current || 0);
          const accY = panBYRef.current + (pinchDYRef.current || 0);
          const { maxX, maxY } = boundsFor(nextScale, width, height);
          panBX.setValue(clamp(accX, -maxX, maxX));
          panBY.setValue(clamp(accY, -maxY, maxY));
          pinchDX.setValue(0);
          pinchDY.setValue(0);
        })
        .runOnJS(true),
    [
      cx,
      cy,
      width,
      height,
      base,
      pinch,
      panBX,
      panBY,
      pinchDX,
      pinchDY,
      baseRef,
      pinchRef,
      panBXRef,
      panBYRef,
      pinchDXRef,
      pinchDYRef,
    ],
  );

  const panG = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(2) // 👈 solo 2 dedos
        .onUpdate(e => {
          panGX.setValue(e.translationX ?? 0);
          panGY.setValue(e.translationY ?? 0);
        })
        .onEnd(() => {
          const curScale = baseRef.current * (pinchRef.current || 1);
          const { maxX, maxY } = boundsFor(curScale, width, height);
          const accX = clamp(
            panBXRef.current + (panGXRef.current || 0),
            -maxX,
            maxX,
          );
          const accY = clamp(
            panBYRef.current + (panGYRef.current || 0),
            -maxY,
            maxY,
          );
          panBX.setValue(accX);
          panBY.setValue(accY);
          panGX.setValue(0);
          panGY.setValue(0);
        })
        .runOnJS(true),
    [
      width,
      height,
      panGX,
      panGY,
      panBX,
      panBY,
      baseRef,
      pinchRef,
      panBXRef,
      panBYRef,
      panGXRef,
      panGYRef,
    ],
  );

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(250)
        .onEnd((e, success) => {
          if (!success) return;
          const tx = e?.x ?? cx;
          const ty = e?.y ?? cy;
          const target = baseRef.current > 1.02 ? 1 : 2;

          const { maxX, maxY } = boundsFor(target, width, height);
          const dx = (tx - cx) * (1 - target);
          const dy = (ty - cy) * (1 - target);
          const nextX = clamp(panBXRef.current + dx, -maxX, maxX);
          const nextY = clamp(panBYRef.current + dy, -maxY, maxY);

          Animated.parallel([
            Animated.spring(base, {
              toValue: target,
              useNativeDriver: true,
              bounciness: 6,
              speed: 12,
            }),
            Animated.spring(panBX, {
              toValue: nextX,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }),
            Animated.spring(panBY, {
              toValue: nextY,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }),
          ]).start();
        })
        .runOnJS(true),
    [base, baseRef, width, height, panBX, panBY, panBXRef, panBYRef, cx, cy],
  );

  const composed = useMemo(
    () => Gesture.Simultaneous(pinchG, panG, doubleTap),
    [pinchG, panG, doubleTap],
  );

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={{
          width,
          height,
          backgroundColor: '#000',
          transform: [
            { translateX: transX },
            { translateY: transY },
            { scale },
          ],
        }}
      >
        <VideoComp
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
          controls
          repeat
          paused={false}
          muted={false}
        />
      </Animated.View>
    </GestureDetector>
  );
};

/* ───────── Grid tiles (SIN pinch) ───────── */
const Tile: React.FC<
  Readonly<{
    item: MediaItem;
    w: number;
    h: number;
    dpr: number;
    overlayPlus?: number;
    muted: boolean;
    onToggleMute: () => void;
    onOpen?: () => void;
  }>
> = ({ item, w, h, dpr, overlayPlus = 0, muted, onToggleMute, onOpen }) => {
  const uri = item.type === 'image' ? cdnImg(item.url, w, dpr, 80) : item.url;
  const isVideo = item.type === 'video';

  return (
    <Pressable
      onPress={onOpen}
      style={{ width: w, height: h, backgroundColor: '#000' }}
    >
      {item.type === 'image' ? (
        <ImageComponent
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
        />
      ) : VideoComp ? (
        <>
          <VideoComp
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            paused
            muted={muted}
            repeat
            resizeMode="cover"
          />
          <IconButton
            icon={muted ? 'volume-off' : 'volume-high'}
            size={18}
            onPress={onToggleMute}
            style={styles.audioBtnSmall}
            iconColor="#000"
            accessibilityLabel={muted ? 'Activar audio' : 'Silenciar audio'}
          />
        </>
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

      {overlayPlus === 0 && isVideo ? (
        <View style={styles.playBadge}>
          <Text style={styles.playGlyph}>▶︎</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

/* ───────── Single media (aquí SÍ hay pinch) ───────── */
const SingleMedia: React.FC<
  Readonly<{
    item: MediaItem;
    cardW: number;
    dpr: number;
    isVisible?: boolean;
    muted: boolean;
    onToggleMute: () => void;
    onOpenViewer: () => void;
  }>
> = ({ item, cardW, dpr, isVisible = false, muted, onToggleMute }) => {
  const uri =
    item.type === 'image' ? cdnImg(item.url, cardW, dpr, 90) : item.url;

  if (item.type === 'image') {
    return <ZoomableImage uri={uri} width={cardW} height={cardW} />;
  }

  // Video “preview” del feed (sin pinch aquí, el pinch está en el visor)
  return VideoComp ? (
    <View style={{ width: '100%', height: '100%' }}>
      <VideoComp
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        paused={!isVisible}
        muted={muted}
        repeat
        resizeMode="cover"
        controls={false}
      />

      {!isVisible ? (
        <View pointerEvents="none" style={styles.playBadgeLarge}>
          <Text style={styles.playGlyphLarge}>▶︎</Text>
        </View>
      ) : null}

      <IconButton
        icon={muted ? 'volume-off' : 'volume-high'}
        size={20}
        onPress={onToggleMute}
        style={styles.audioBtn}
        iconColor="#000"
        accessibilityLabel={muted ? 'Activar audio' : 'Silenciar audio'}
      />
    </View>
  ) : (
    <View style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />
  );
};

/* ───────── Componente principal ───────── */
const PostCard: React.FC<Props> = ({
  data,
  author,
  onToggleReact,
  currentReaction,
  counts,
  availableKeys,
  onReactKey,
  isVisible,
  onCommentPress, // 👈
  onSharePress,
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

  // Audio del previo
  const [previewMuted, setPreviewMuted] = useState<boolean>(true);
  const [gridMuted, setGridMuted] = useState<boolean>(true);

  // Anti “love fantasma” (para logs en handleReact)
  const ignoreLoveOnceRef = useRef<boolean>(false);
  const clearIgnoreLoveOnce = useCallback(() => {
    ignoreLoveOnceRef.current = false;
  }, []);

  // Ver más / Ver menos
  const [expanded, setExpanded] = useState(false);
  const MAX_PREVIEW_CHARS = 100; // ajustable
  const contentRaw = data.content ?? '';
  const needsClamp = contentRaw.length > MAX_PREVIEW_CHARS;
  const previewText = useMemo(
    () =>
      needsClamp ? clampAtWord(contentRaw, MAX_PREVIEW_CHARS) : contentRaw,
    [contentRaw, needsClamp],
  );

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

  /* ───── Visor fullscreen ───── */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const viewerListRef = useRef<FlatList<MediaItem>>(null);
  const [imgZoomOpen, setImgZoomOpen] = useState(false); // compat
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

  // Visor: pinch a TODO (imágenes y videos)
  const renderViewerItem: ListRenderItem<MediaItem> = useCallback(
    ({ item }) => {
      if (item.type === 'image') {
        return (
          <View style={{ width: winW, height: pageH, backgroundColor: '#000' }}>
            <ZoomableImage
              uri={cdnImg(item.url, winW, dpr, 92)}
              width={winW}
              height={pageH}
              contain
            />
          </View>
        );
      }
      return (
        <View style={{ width: winW, height: pageH, backgroundColor: '#000' }}>
          <ZoomableVideo uri={item.url} width={winW} height={pageH} />
        </View>
      );
    },
    [winW, pageH, dpr],
  );

  /* ───── Footer y conteos ───── */
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

  const countsForFooter: UIReactionCounts = isMulti
    ? { ...zeroCounts, ...(counts ?? {}) }
    : { ...zeroCounts, love: data.reactionCount ?? 0, ...(counts ?? {}) };

  const currentForFooter: UIReactionKey | null =
    typeof currentReaction !== 'undefined'
      ? currentReaction
      : data.reactedByMe
      ? 'love'
      : null;

  // Handler con logs para depurar “love” fantasma
  const handleReact = useCallback(
    (id: string, key: UIReactionKey, active: boolean) => {
      if (!active) {
        ignoreLoveOnceRef.current = true;
        setTimeout(clearIgnoreLoveOnce, 400);
        if (__DEV__)
          console.log('[Reactions] onRemove from PostCard.handleReact', {
            id,
            key,
          });
        if (onReactKey) {
          void onReactKey(id, null);
          return;
        }
        if (key === 'love' && onToggleReact) {
          void onToggleReact(id, false);
        }
        return;
      }
      if (ignoreLoveOnceRef.current && key === 'love') {
        if (__DEV__)
          console.log('[Reactions] swallow immediate love after remove', {
            id,
          });
        ignoreLoveOnceRef.current = false;
        return;
      }
      ignoreLoveOnceRef.current = false;
      if (onReactKey) {
        void onReactKey(id, key);
        return;
      }
      if (key === 'love' && onToggleReact) {
        void onToggleReact(id, true);
      }
    },
    [onReactKey, onToggleReact, clearIgnoreLoveOnce],
  );

  /* Single vs grid en feed */
  const single = !hasMany;

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
          {!expanded && needsClamp ? (
            <Text variant="bodyLarge">
              {previewText}
              <Text
                style={[styles.seeMore, { color: theme.colors.primary }]}
                onPress={() => setExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Ver más del texto"
              >
                {'  Ver más'}
              </Text>
            </Text>
          ) : (
            <Text variant="bodyLarge">
              {contentRaw}
              {needsClamp ? (
                <Text
                  style={[styles.seeLess, { color: theme.colors.primary }]}
                  onPress={() => setExpanded(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver menos del texto"
                >
                  {'  Ver menos'}
                </Text>
              ) : null}
            </Text>
          )}
        </View>
      ) : null}

      {/* Media */}
      {media.length === 0 ? null : !single ? (
        // GRID sin pinch
        <View style={[styles.grid, { height: gridH }]}>
          {positions.map((p, k) => {
            const it = at(media, p.idx);
            return (
              <View
                key={`p-${k}`}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: p.y,
                  width: p.w,
                  height: p.h,
                }}
              >
                <Tile
                  item={it}
                  w={p.w}
                  h={p.h}
                  dpr={dpr}
                  overlayPlus={p.overlay ?? 0}
                  muted={gridMuted}
                  onToggleMute={() => setGridMuted(m => !m)}
                  onOpen={() => openViewerAt(p.idx)}
                />
              </View>
            );
          })}
        </View>
      ) : (
        // SINGLE (tap simple fuera abre visor)
        <Pressable
          style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}
          onPress={() => openViewerAt(0)}
        >
          <SingleMedia
            item={at(media, 0)}
            cardW={cardW}
            dpr={dpr}
            isVisible={!!isVisible}
            muted={previewMuted}
            onToggleMute={() => setPreviewMuted(m => !m)}
            onOpenViewer={() => openViewerAt(0)}
          />
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
          current={currentForFooter}
          counts={countsForFooter}
          availableKeys={keysAvailable}
          onReact={handleReact}
          commentsCount={data.commentCount}
          sharesCount={data.shareCount}
          {...(onCommentPress ? ({ onCommentPress } as const) : {})} // ✅ solo si existe
          {...(onSharePress ? ({ onSharePress } as const) : {})}
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
              <IconButton
                icon="chevron-left"
                size={22}
                onPress={() => setViewerOpen(false)}
                style={styles.backBtn}
                iconColor="#fff"
                accessibilityLabel="Regresar a la publicación"
              />
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

          {/* (Opcional) compat con react-native-image-viewing */}
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
  card: { marginVertical: 8 },
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

  // Grid: insignia play
  playBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { color: '#fff', fontSize: 14, marginLeft: 1 },

  // Single video: badge grande centrado
  playBadgeLarge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyphLarge: { color: '#fff', fontSize: 30, marginLeft: 4 },

  // Audio estilo IG (blanco)
  audioBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  audioBtnSmall: {
    position: 'absolute',
    bottom: 8,
    right: 8 + 28 + 6,
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

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
    height: 44,
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

  // Ver más / Ver menos
  seeMore: { fontWeight: '700' },
  seeLess: { fontWeight: '600', opacity: 0.9 },
});

/* memo con props opcionales */
export default memo(PostCard, (a, b) => {
  const x = a.data,
    y = b.data;

  const countsEq = (c1?: Props['counts'], c2?: Props['counts']): boolean => {
    if (!c1 && !c2) return true;
    if (!c1 || !c2) return false;
    const keys: UIReactionKey[] = [
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
    x.commentCount === y.commentCount && // 👈 NUEVO
    x.shareCount === y.shareCount && // 👈 CONSISTENCIA
    x.content === y.content &&
    (x.imageUrls?.[0] ?? '') === (y.imageUrls?.[0] ?? '') &&
    (x.videoUrls?.[0] ?? '') === (y.videoUrls?.[0] ?? '') &&
    (a.author?.name ?? '') === (b.author?.name ?? '') &&
    (a.author?.photoURL ?? '') === (b.author?.photoURL ?? '') &&
    a.onToggleReact === b.onToggleReact &&
    a.onReactKey === b.onReactKey &&
    a.currentReaction === b.currentReaction &&
    countsEq(a.counts, b.counts) &&
    String(a.availableKeys) === String(b.availableKeys) &&
    a.isVisible === b.isVisible
  );
});
