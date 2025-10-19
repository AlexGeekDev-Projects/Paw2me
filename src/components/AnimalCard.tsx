import React, { useEffect, useRef, useState, memo } from 'react';
import { View, Image, StyleSheet, Pressable, Animated } from 'react-native';
import { Card, Text, useTheme, Chip } from 'react-native-paper';
import type { AnimalCardVM } from '@models/animal';
import { PawIconAnimated } from '@components/feedback/Loading';
import ReactionFooter from '@components/reactions/ReactionFooter';

interface Props {
  data: AnimalCardVM;
  onPress?: (id: string) => void;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

const FADE_MS = 220;
const THUMB_FADE_MS = 120;
const SPINNER_DELAY_MS = 120;

const ratioCache = new Map<string, number>();

const AnimalCardComponent: React.FC<Props> = ({ data, onPress }) => {
  const theme = useTheme();
  const thumbUrl: string | undefined =
    (('thumbUrl' in data && (data as any).thumbUrl) ||
      ('coverThumbUrl' in data && (data as any).coverThumbUrl)) ??
    undefined;

  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);

  const fullOpacity = useRef(new Animated.Value(0)).current;
  const thumbOpacity = useRef(new Animated.Value(0)).current;
  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const url = data.coverUrl;
    if (!url) {
      setAspectRatio(undefined);
      return;
    }
    const cached = ratioCache.get(url);
    if (cached) {
      setAspectRatio(cached);
      return;
    }
    Image.getSize(
      url,
      (w, h) => {
        if (w > 0 && h > 0) {
          const r = w / h;
          ratioCache.set(url, r);
          setAspectRatio(r);
        } else {
          setAspectRatio(undefined);
        }
      },
      () => setAspectRatio(undefined),
    );
  }, [data.coverUrl]);

  useEffect(() => {
    return () => {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
    };
  }, []);

  const onThumbLoadStart = () => {
    setIsLoading(true);
    if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
    spinnerTimerRef.current = setTimeout(
      () => setShowSpinner(true),
      SPINNER_DELAY_MS,
    );
  };
  const onThumbLoadEnd = () => {
    setThumbLoaded(true);
    if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
    setShowSpinner(false);
    thumbOpacity.setValue(0);
    Animated.timing(thumbOpacity, {
      toValue: 1,
      duration: THUMB_FADE_MS,
      useNativeDriver: true,
    }).start();
  };
  const onThumbError = () => {
    setThumbLoaded(false);
  };

  const onFullLoadStart = () => {
    setIsLoading(true);
    if (!thumbLoaded) {
      if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
      spinnerTimerRef.current = setTimeout(
        () => setShowSpinner(true),
        SPINNER_DELAY_MS,
      );
    }
  };
  const onFullLoadEnd = () => {
    setIsLoading(false);
    if (spinnerTimerRef.current) clearTimeout(spinnerTimerRef.current);
    setShowSpinner(false);
    fullOpacity.setValue(0);
    Animated.timing(fullOpacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  };

  const thumbLayer =
    thumbUrl && data.coverUrl ? (
      <AnimatedImage
        source={{ uri: thumbUrl }}
        style={[
          styles.coverBase,
          aspectRatio ? { aspectRatio } : styles.coverFallback,
          { opacity: thumbOpacity },
        ]}
        resizeMode="cover"
        blurRadius={12}
        onLoadStart={onThumbLoadStart}
        onLoadEnd={onThumbLoadEnd}
        onError={onThumbError}
        progressiveRenderingEnabled
      />
    ) : (
      <View
        style={[
          styles.coverBase,
          styles.coverFallback,
          { backgroundColor: '#eee' },
        ]}
      />
    );

  const fullLayer = data.coverUrl ? (
    <AnimatedImage
      source={{ uri: data.coverUrl }}
      style={[
        styles.coverBase,
        aspectRatio ? { aspectRatio } : styles.coverFallback,
        {
          opacity: fullOpacity,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        },
      ]}
      resizeMode="cover"
      onLoadStart={onFullLoadStart}
      onLoadEnd={onFullLoadEnd}
      onError={onFullLoadEnd}
      progressiveRenderingEnabled
    />
  ) : null;

  const breed = (data as any).breed as string | undefined;
  const size = (data as any).size as string | undefined;

  return (
    <Pressable onPress={() => onPress?.(data.id)} accessibilityRole="button">
      <Card
        mode="elevated"
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.coverWrap}>
          {thumbLayer}
          {fullLayer}
          {isLoading && showSpinner && (
            <View style={styles.overlay}>
              <PawIconAnimated
                size={36}
                color={theme.colors.primary as string}
              />
            </View>
          )}

          {/* Overlay inferior (nombre + chips) */}
          <View style={styles.bottomOverlay}>
            <View style={styles.titleRow}>
              <Text
                variant="titleMedium"
                numberOfLines={1}
                style={[styles.title, { color: '#fff' }]}
              >
                {data.name}
              </Text>
              <View style={styles.chipsRow}>
                {breed ? (
                  <Chip compact style={[styles.chip, styles.chipOnPhoto]}>
                    {breed}
                  </Chip>
                ) : null}
                {size ? (
                  <Chip compact style={[styles.chip, styles.chipOnPhoto]}>
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

        {/* Footer compacto */}
        <ReactionFooter
          id={data.id}
          commentsCount={(data as any).comments ?? 0}
          sharesCount={(data as any).shares ?? 0}
          availableKeys={[
            'love',
            'sad',
            'angry',
            'happy',
            'like',
            'wow',
            'match',
          ]}
          onReact={(id, r, active) => {
            /* TODO Firestore */
          }}
          onCommentPress={id => {
            /* TODO comentarios */
          }}
          onSharePress={id => {
            /* TODO compartir */
          }}
        />
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverWrap: { position: 'relative', width: '100%' },
  coverBase: { width: '100%', backgroundColor: '#eee' },
  coverFallback: { height: 300 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '700', marginRight: 8 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  chip: { marginRight: 6 },
  chipOnPhoto: { backgroundColor: 'rgba(255,255,255,0.85)' },
  subtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 2 },
});

export default memo(AnimalCardComponent, (a, b) => {
  const x = a.data;
  const y = b.data;
  const ax = (x as any).thumbUrl ?? (x as any).coverThumbUrl;
  const ay = (y as any).thumbUrl ?? (y as any).coverThumbUrl;
  return (
    x.id === y.id &&
    x.coverUrl === y.coverUrl &&
    ax === ay &&
    x.name === y.name &&
    x.city === y.city &&
    x.species === y.species &&
    x.urgent === y.urgent &&
    x.chips.join('|') === y.chips.join('|') &&
    a.onPress === b.onPress
  );
});
