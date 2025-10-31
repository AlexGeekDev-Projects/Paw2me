// src/components/AnimalCard.android.tsx
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
  Pressable,
  Animated,
  useWindowDimensions,
  PixelRatio,
  Share,
  Image as RNImage,
} from 'react-native';
import { Card, Text, useTheme, Chip } from 'react-native-paper';

import CommentsSheetPaw from '@components/comments/CommentsSheetPaw';
import ReactionFooter from '@components/reactions/ReactionFooter';
import type { AnimalCardVM } from '@models/animal';
import {
  str,
  title,
  clampAspectRatio,
  getRemoteAspectRatio,
  heightFromWidthAndAR,
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

const PROVIDER: CdnProvider = 'auto';

const SIZE_WORDS = new Set(
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
  const breedV = rawBreed ? title(rawBreed) ?? rawBreed : undefined;
  const sizeV = normalizeSize(rawSize);
  return {
    ...(breedV ? { breed: breedV } : {}),
    ...(sizeV ? { size: sizeV } : {}),
  } as Readonly<{ breed?: string; size?: string }>;
};

const AnimalCardAndroid: React.FC<Props> = ({ data, onPress }) => {
  const theme = useTheme();
  const { width: winW } = useWindowDimensions();
  const opt = data as OptionalFields;

  const rawCover = str(opt.coverUrl);
  const inferred = extractFromChips(opt.chips);
  const breed: string | undefined = str(opt.breed) ?? inferred.breed;
  const size: string | undefined =
    normalizeSize(str(opt.size)) ?? inferred.size;

  const dpr = PixelRatio.get();
  const cardW = useMemo(() => winW - 24, [winW]);

  const coverUrl = rawCover
    ? buildCdnUrl(
        rawCover,
        {
          w: Math.min(1920, Math.ceil(cardW * dpr)),
          q: 78,
          fit: 'cover',
          gravity: 'faces',
          dpr,
        },
        PROVIDER,
      )
    : undefined;

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

  const [imgOpacity] = useState(() => new Animated.Value(0));
  const onImgLoaded = useCallback(() => {
    Animated.timing(imgOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [imgOpacity]);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const openComments = useCallback(() => setCommentsOpen(true), []);
  const closeComments = useCallback(() => setCommentsOpen(false), []);

  const commentsCount =
    typeof (data as any).comments === 'number' &&
    Number.isFinite((data as any).comments)
      ? (data as any).comments
      : 0;
  const sharesCount =
    typeof (data as any).shares === 'number' &&
    Number.isFinite((data as any).shares)
      ? (data as any).shares
      : 0;

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: 'Mira esta huellita 🐾' });
    } catch {}
  }, []);

  const gradientH = Math.max(56, 8 * 2 + 40); // simplificado

  return (
    <Card
      mode="elevated"
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
    >
      <Pressable onPress={() => onPress?.(data.id)} accessibilityRole="button">
        <View style={[styles.media, { height: targetH }]}>
          {coverUrl ? (
            <Animated.View style={{ opacity: imgOpacity }}>
              <RNImage
                source={{ uri: coverUrl }}
                style={styles.image}
                resizeMode="cover"
                onLoad={onImgLoaded}
              />
            </Animated.View>
          ) : (
            <View style={[styles.image, { backgroundColor: '#eee' }]} />
          )}

          {/* Overlay inferior simple (sin LinearGradient) */}
          <View
            style={[styles.overlayBottom, { height: gradientH }]}
            pointerEvents="none"
          />

          {/* Contenido inferior */}
          <View
            style={[styles.bottomContent, { paddingVertical: 8 }]}
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
              <View style={styles.titleChipsRow}>
                {breed ? (
                  <Chip
                    compact
                    mode="flat"
                    style={styles.chipOnPhoto}
                    textStyle={styles.chipText}
                  >
                    {breed}
                  </Chip>
                ) : null}
                {size ? (
                  <Chip
                    compact
                    mode="flat"
                    style={styles.chipOnPhoto}
                    textStyle={styles.chipText}
                  >
                    {size}
                  </Chip>
                ) : null}
              </View>
            </View>
            <Text variant="bodySmall" numberOfLines={1} style={styles.subtitle}>
              {data.species}
              {data.city ? ` • ${data.city}` : ''}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Footer */}
      <View style={styles.topBorder} />
      <ReactionFooter
        id={data.id}
        current={null /* la store interna ya maneja el estado */}
        counts={undefined}
        availableKeys={['love', 'sad', 'match']}
        onReact={() => {} /* delega al footer/hook existente */}
        commentsCount={commentsCount}
        sharesCount={sharesCount}
        onCommentPress={openComments}
        onSharePress={handleShare}
      />

      <CommentsSheetPaw
        visible={commentsOpen}
        pawId={data.id}
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

  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  chipText: { fontSize: 11 },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  topBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
});

export default memo(AnimalCardAndroid, (a, b) => {
  const x = a.data,
    y = b.data;
  return (
    x.id === y.id &&
    (x as any).coverUrl === (y as any).coverUrl &&
    x.name === y.name &&
    x.city === y.city &&
    x.species === y.species &&
    (x as any).comments === (y as any).comments &&
    (x as any).shares === (y as any).shares &&
    a.onPress === b.onPress
  );
});
