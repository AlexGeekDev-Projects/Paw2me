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
  ScrollView,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import ReactionFooter from '@components/reactions/ReactionFooter';
import type { PostCardVM } from '@models/post';
import {
  clampAspectRatio,
  getRemoteAspectRatio,
  heightFromWidthAndAR,
  str,
} from '@utils/media';
import { buildCdnUrl, type CdnProvider } from '@utils/cdn';

// ───── Cargas opcionales (sin romper tipado estricto en services)
let FastImage: any = null;
try {
  FastImage = require('react-native-fast-image').default;
} catch {}
const ImageComponent: any = FastImage ?? require('react-native').Image;
const AnimatedImage = Animated.createAnimatedComponent(ImageComponent);

let RNVideo: any = null;
try {
  RNVideo = require('react-native-video').default;
} catch {}

type Props = Readonly<{
  data: PostCardVM;
  onToggleReact: (postId: string, next: boolean) => void; // boolean (love on/off)
}>;

const PROVIDER: CdnProvider = 'auto';
const FADE_MS = 220;
const THUMB_FADE_MS = 120;

const PostCard: React.FC<Props> = ({ data, onToggleReact }) => {
  const theme = useTheme();
  const { width: winW } = useWindowDimensions();
  const cardW = useMemo(() => winW - 24, [winW]);
  const dpr = PixelRatio.get();

  // Medios combinados: primero imágenes luego videos (puedes cambiar el orden)
  const images = Array.isArray(data.imageUrls) ? data.imageUrls : [];
  const videos = Array.isArray(data.videoUrls) ? data.videoUrls! : [];
  const media: ReadonlyArray<{ type: 'image' | 'video'; url: string }> = [
    ...images.map(u => ({ type: 'image' as const, url: u })),
    ...videos.map(u => ({ type: 'video' as const, url: u })),
  ];

  // Progressive para el primer elemento (como Explore)
  const rawCover = str(media[0]?.url);
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

  const thumbUrl = rawCover
    ? buildCdnUrl(
        rawCover,
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

  // Altura clamped (4:5..1.91:1) como en Explore
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

  // Fades
  const fullOpacity = useRef(new Animated.Value(0)).current;
  const thumbOpacity = useRef(new Animated.Value(0)).current;
  const onThumbEnd = (): void => {
    Animated.timing(thumbOpacity, {
      toValue: 1,
      duration: THUMB_FADE_MS,
      useNativeDriver: true,
    }).start();
  };
  const onFullEnd = (): void => {
    Animated.timing(fullOpacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  };

  // Carrusel
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / cardW);
      if (i !== index) setIndex(i);
    },
    [cardW, index],
  );

  return (
    <Card
      mode="elevated"
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
    >
      {/* Media */}
      <View style={[styles.media, { height: targetH }]}>
        {/* Thumb + cover para el primer elemento (como Explore) */}
        {thumbUrl ? (
          <AnimatedImage
            source={{ uri: thumbUrl }}
            style={[styles.image, { opacity: thumbOpacity }]}
            resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
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
            resizeMode={FastImage ? FastImage.resizeMode.cover : 'cover'}
            onLoadEnd={onFullEnd}
          />
        ) : null}

        {/* Carrusel (si hay >1 elemento) */}
        {media.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={StyleSheet.absoluteFill}
          >
            {media.map((m, i) => {
              const uri =
                m.type === 'image'
                  ? buildCdnUrl(
                      m.url,
                      {
                        w: Math.min(1920, Math.ceil(cardW * dpr)),
                        q: 80,
                        fit: 'cover',
                        gravity: 'faces',
                        dpr,
                      },
                      PROVIDER,
                    )
                  : m.url;

              return (
                <View
                  key={`${m.type}-${i}`}
                  style={{ width: cardW, height: targetH }}
                >
                  {m.type === 'image' ? (
                    <ImageComponent
                      source={{ uri }}
                      style={styles.image}
                      resizeMode={
                        FastImage ? FastImage.resizeMode.cover : 'cover'
                      }
                    />
                  ) : RNVideo ? (
                    <RNVideo
                      source={{ uri }}
                      style={styles.image}
                      paused
                      muted
                      repeat
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.image, { backgroundColor: '#000' }]} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Indicadores (dots) */}
        {media.length > 1 ? (
          <View style={styles.dots}>
            {media.map((_m, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.dot,
                  {
                    opacity: index === i ? 0.95 : 0.35,
                    backgroundColor: '#fff',
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Contenido simple (texto del post) */}
      {data.content ? (
        <View
          style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}
        >
          <Text variant="bodyLarge">{data.content}</Text>
        </View>
      ) : null}

      {/* Footer de reacciones reutilizado */}
      <View style={styles.topBorder} />
      <ReactionFooter
        id={data.id}
        current={data.reactedByMe ? 'love' : null}
        counts={{ love: data.reactionCount }} // si luego persistes meta, puedes pasar per-key
        availableKeys={['like', 'love', 'happy', 'sad', 'wow', 'angry']}
        scope="posts" // 👈 importante
        onReact={async (id, key, active) => {
          // hoy sólo conmuta "love"; puedes abrir más cuando tengas UI para elegir.
          if (key !== 'love') return;
          onToggleReact(id, active);
        }}
        commentsCount={data.commentCount}
        sharesCount={data.shareCount}
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
  dots: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  topBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
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
    a.onToggleReact === b.onToggleReact
  );
});
