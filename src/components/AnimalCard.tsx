import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
  PixelRatio,
  Share,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Card, Text, useTheme, Chip } from 'react-native-paper';
import { PawIconAnimated } from '@components/feedback/Loading';
import { useAnimalReactions } from '@hooks/useAnimalReactions';

import AnimalCommentsDrawer from '@components/comments/AnimalCommentsDrawer';
import ReactionFooter from '@components/reactions/ReactionFooter';

import { useAnimalCommentsCount } from '@hooks/useAnimalCommentsCount';

import type { AnimalCardVM } from '@models/animal';
import {
  clampAspectRatio,
  getRemoteAspectRatio,
  heightFromWidthAndAR,
  str,
  title,
} from '@utils/media';
import { buildCdnUrl, type CdnProvider } from '@utils/cdn';

type Props = Readonly<{ data: AnimalCardVM; onPress?: (id: string) => void }>;
type OptionalFields = Readonly<{
  coverUrl?: string | null;
  coverThumbUrl?: string | null;
  thumbUrl?: string | null;
  breed?: string | null;
  size?: string | null;
  chips?: readonly string[] | null;
  comments?: number | null;
  shares?: number | null;
}>;

let Img: any = null;
try {
  Img = require('react-native-fast-image');
} catch {
  Img = null;
}
const ImageComponent: any = Img?.default ?? require('react-native').Image;
const AnimatedImage = Animated.createAnimatedComponent(ImageComponent);

const MaybeGradient = (() => {
  try {
    return require('react-native-linear-gradient')
      .default as React.ComponentType<any>;
  } catch {
    return null;
  }
})();

const SIZE_WORDS = new Set(
  [
    'xs',
    'extra small',
    'mini',
    'toy',
    's',
    'small',
    'pequeño',
    'pequeno',
    'pequeña',
    'pequena',
    'chico',
    'm',
    'medium',
    'mediano',
    'mediana',
    'l',
    'large',
    'grande',
    'xl',
    'xlarge',
    'muy grande',
    'gigante',
  ].map(s => s.toLowerCase()),
);

const normalizeSize = (input?: string | null): string | undefined => {
  const t = str(input)?.toLowerCase();
  if (!t) return undefined;
  if (
    [
      'xs',
      'extra small',
      'mini',
      'toy',
      's',
      'small',
      'pequeño',
      'pequena',
      'pequeña',
      'pequeno',
      'chico',
    ].includes(t)
  )
    return 'Pequeño';
  if (['m', 'medium', 'mediano', 'mediana'].includes(t)) return 'Mediano';
  if (
    ['l', 'large', 'grande', 'xl', 'xlarge', 'muy grande', 'gigante'].includes(
      t,
    )
  )
    return 'Grande';
  return title(t) ?? t;
};

const extractFromChips = (chips?: readonly string[] | null) => {
  if (!Array.isArray(chips)) return {};
  const clean = chips.map(s => s.trim()).filter(Boolean);
  const rawSize = clean.find(s => SIZE_WORDS.has(s.toLowerCase()));
  const rawBreed = clean.find(s => !SIZE_WORDS.has(s.toLowerCase()));
  const breedV = rawBreed ? (title(rawBreed) ?? rawBreed) : undefined;
  const sizeV = normalizeSize(rawSize);
  return {
    ...(breedV ? { breed: breedV } : {}),
    ...(sizeV ? { size: sizeV } : {}),
  } as Readonly<{ breed?: string; size?: string }>;
};

const FADE_MS = 220;
const THUMB_FADE_MS = 120;
const SPINNER_DELAY_MS = 120;
const MIN_GRADIENT_H = 56;
const PAD_V = 8;
const PROVIDER: CdnProvider = 'auto';

const AnimalCardComponent: React.FC<Props> = ({ data, onPress }) => {
  const theme = useTheme();
  const { width: winW } = useWindowDimensions();

  // auth → userId para comentar
  const { useAuth } = require('@hooks/useAuth');
  const auth = typeof useAuth === 'function' ? useAuth() : undefined;
  const userId: string | null = auth?.user?.uid ?? null;

  // Reacciones
  const { counts, current, react } = useAnimalReactions(data.id, userId);

  const opt = data as OptionalFields;
  const rawCover = str(opt.coverUrl);
  const rawThumb = str(opt.coverThumbUrl) ?? str(opt.thumbUrl);

  const inferred = extractFromChips(opt.chips);
  const breed: string | undefined = str(opt.breed) ?? inferred.breed;
  const size: string | undefined =
    normalizeSize(str(opt.size)) ?? inferred.size;

  // Contadores (local optimista)
  const commentsInitial =
    typeof opt.comments === 'number' && Number.isFinite(opt.comments)
      ? opt.comments
      : 0;
  const sharesInitial =
    typeof (data as any).shares === 'number' &&
    Number.isFinite((data as any).shares)
      ? (data as any).shares
      : 0;

  const commentsCount = useAnimalCommentsCount(data.id);
  const sharesCount = sharesInitial;

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `Mira esta huellita 🐾` });
    } catch {}
  }, []);

  // Cajón de comentarios
  const [commentsOpen, setCommentsOpen] = useState(false);
  const openComments = useCallback(() => setCommentsOpen(true), []);
  const closeComments = useCallback(() => setCommentsOpen(false), []);

  const cardW = useMemo(() => winW - 24, [winW]);
  const dpr = PixelRatio.get();

  const coverUrl = rawCover
    ? buildCdnUrl(
        rawCover,
        {
          w: Math.min(1920, Math.ceil(cardW * dpr)),
          q: 75,
          fit: 'cover',
          gravity: 'faces',
          dpr,
        },
        PROVIDER,
      )
    : undefined;

  const thumbUrl = rawThumb
    ? buildCdnUrl(
        rawThumb,
        {
          w: Math.min(640, Math.ceil((cardW * dpr) / 3)),
          q: 35,
          fit: 'cover',
          gravity: 'faces',
          dpr,
        },
        PROVIDER,
      )
    : undefined;

  // Altura (clamp 4:5..1.91:1)
  const [targetH, setTargetH] = useState<number>(() => Math.round(cardW / 1.2));
  useEffect(() => {
    let alive = true;
    (async () => {
      const real = coverUrl ? await getRemoteAspectRatio(coverUrl) : undefined;
      const ar = clampAspectRatio(real ?? 1.2);
      const h = heightFromWidthAndAR(cardW, ar);
      if (alive) setTargetH(h);
    })();
    return () => {
      alive = false;
    };
  }, [cardW, coverUrl]);

  // Progressive fade
  const fullOpacity = useRef(new Animated.Value(0)).current;
  const thumbOpacity = useRef(new Animated.Value(0)).current;
  const [isLoading, setIsLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const spinnerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onThumbStart = (): void => {
    if (spinnerRef.current) clearTimeout(spinnerRef.current);
    setIsLoading(true);
    spinnerRef.current = setTimeout(
      () => setShowSpinner(true),
      SPINNER_DELAY_MS,
    );
  };
  const onThumbEnd = (): void => {
    if (spinnerRef.current) clearTimeout(spinnerRef.current);
    setShowSpinner(false);
    Animated.timing(thumbOpacity, {
      toValue: 1,
      duration: THUMB_FADE_MS,
      useNativeDriver: true,
    }).start();
  };
  const onFullStart = (): void => {
    if (spinnerRef.current) clearTimeout(spinnerRef.current);
    if (!thumbUrl) {
      setIsLoading(true);
      spinnerRef.current = setTimeout(
        () => setShowSpinner(true),
        SPINNER_DELAY_MS,
      );
    }
  };
  const onFullEnd = (): void => {
    if (spinnerRef.current) clearTimeout(spinnerRef.current);
    setIsLoading(false);
    setShowSpinner(false);
    Animated.timing(fullOpacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  };

  // Overlay: altura = contenido + padding
  const [contentH, setContentH] = useState<number>(40);
  const gradientH = Math.max(56, Math.ceil(contentH + PAD_V * 2 + 6));
  const onContentLayout = (e: LayoutChangeEvent): void =>
    setContentH(e.nativeEvent.layout.height);

  const chipBg = theme.dark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(255,255,255,0.94)';
  const chipBorder = theme.dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.06)';
  const chipTextColor = theme.colors.onSurface;

  return (
    <Card
      mode="elevated"
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
    >
      {/* Media (tap navega) */}
      <Pressable onPress={() => onPress?.(data.id)} accessibilityRole="button">
        <View style={[styles.media, { height: targetH }]}>
          {thumbUrl ? (
            <AnimatedImage
              source={{ uri: thumbUrl }}
              style={[styles.image, { opacity: thumbOpacity }]}
              resizeMode={Img ? Img.resizeMode.cover : 'cover'}
              {...(Img ? { blurRadius: 0 } : { blurRadius: 12 })}
              onLoadStart={onThumbStart}
              onLoadEnd={onThumbEnd}
            />
          ) : (
            <View style={[styles.image, { backgroundColor: '#eee' }]} />
          )}

          {coverUrl ? (
            <AnimatedImage
              source={{ uri: coverUrl }}
              style={[
                styles.image,
                StyleSheet.absoluteFill,
                { opacity: fullOpacity },
              ]}
              resizeMode={Img ? Img.resizeMode.cover : 'cover'}
              onLoadStart={onFullStart}
              onLoadEnd={onFullEnd}
            />
          ) : null}

          {MaybeGradient ? (
            <MaybeGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.58)']}
              style={[styles.gradientBottom, { height: gradientH }]}
              pointerEvents="none"
            />
          ) : (
            <View
              style={[styles.overlayBottom, { height: gradientH }]}
              pointerEvents="none"
            />
          )}

          {/* Contenido inferior */}
          <View
            style={[styles.bottomContent, { paddingVertical: PAD_V }]}
            onLayout={onContentLayout}
            pointerEvents="box-none"
          >
            <View style={styles.titleRow}>
              <Text
                variant="titleMedium"
                numberOfLines={1}
                style={[styles.title, { color: '#fff' }]}
              >
                {data.name}
              </Text>
              {(breed || size) && (
                <View style={styles.titleChipsRow}>
                  {breed ? (
                    <Chip
                      compact
                      mode="flat"
                      style={[
                        styles.chipOnPhoto,
                        { backgroundColor: chipBg, borderColor: chipBorder },
                      ]}
                      textStyle={[styles.chipText, { color: chipTextColor }]}
                    >
                      {breed}
                    </Chip>
                  ) : null}
                  {size ? (
                    <Chip
                      compact
                      mode="flat"
                      style={[
                        styles.chipOnPhoto,
                        { backgroundColor: chipBg, borderColor: chipBorder },
                      ]}
                      textStyle={[styles.chipText, { color: chipTextColor }]}
                    >
                      {size}
                    </Chip>
                  ) : null}
                </View>
              )}
            </View>
            <Text variant="bodySmall" numberOfLines={1} style={styles.subtitle}>
              {data.species}
              {data.city ? ` • ${data.city}` : ''}
            </Text>
          </View>

          {isLoading && showSpinner ? (
            <View style={styles.center} pointerEvents="none" accessible={false}>
              <View style={styles.pawBadge}>
                <PawIconAnimated />
              </View>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* Footer */}
      <View style={styles.topBorder} />
      <ReactionFooter
        id={data.id}
        current={current ?? null}
        counts={counts}
        availableKeys={['love', 'sad', 'match']}
        onReact={async (_id, key, active) => {
          if (key !== 'love' && key !== 'sad' && key !== 'match') return;
          await react(active ? key : null);
        }}
        commentsCount={commentsCount}
        sharesCount={sharesCount}
        onCommentPress={() => openComments()}
        onSharePress={handleShare}
      />

      {/* Cajón de comentarios */}
      <AnimalCommentsDrawer
        visible={commentsOpen}
        animalId={data.id}
        userId={userId}
        onClose={closeComments}
        onDismiss={closeComments}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  media: { position: 'relative', width: '100%', backgroundColor: '#eee' },
  image: { width: '100%', height: '100%' },

  gradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 1,
  },
  bottomContent: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    zIndex: 2,
  },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700', flexShrink: 1, flexGrow: 1, marginRight: 8 },
  titleChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    flexWrap: 'nowrap',
  },

  chipOnPhoto: {
    alignSelf: 'center',
    paddingVertical: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11 },

  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawBadge: {
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  topBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
});

export default memo(AnimalCardComponent, (a, b) => {
  const x = a.data,
    y = b.data;
  return (
    x.id === y.id &&
    (x as any).coverUrl === (y as any).coverUrl &&
    x.name === y.name &&
    x.city === y.city &&
    x.species === y.species &&
    a.onPress === b.onPress
  );
});
