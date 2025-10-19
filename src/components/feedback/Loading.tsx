import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, useTheme, Card, ProgressBar } from 'react-native-paper';

// usa el componente separado y re-exporta para compatibilidad
import PawIconAnimated from './PawIconAnimated';
export { default as PawIconAnimated } from './PawIconAnimated';
export type { PawIconAnimatedProps } from './PawIconAnimated';

type LoadingVariant = 'fullscreen' | 'inline' | 'skeleton-card-list';

// Tipo correcto para width en Animated.View
type WidthSpec = number | `${number}%` | 'auto';

interface BaseProps {
  variant: LoadingVariant;
  message?: string;
}
interface FullscreenProps extends BaseProps {
  variant: 'fullscreen';
  progress?: number;
}
interface InlineProps extends BaseProps {
  variant: 'inline';
  progress?: number;
}
interface SkeletonProps extends BaseProps {
  variant: 'skeleton-card-list';
  count?: number;
}
type LoadingProps = FullscreenProps | InlineProps | SkeletonProps;

const SkeletonLine: React.FC<{
  width: WidthSpec;
  height: number;
  radius?: number;
}> = ({ width, height, radius = 8 }) => {
  const pulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: '#E6E6E6',
        opacity: pulse,
      }}
    />
  );
};

const SkeletonAnimalCard: React.FC = () => {
  return (
    <Card style={styles.skelCard} mode="contained">
      <View style={styles.skelCover} />
      <Card.Content style={{ gap: 10 }}>
        <SkeletonLine width={160} height={16} />
        <SkeletonLine width={100} height={12} />
        <View style={styles.skelChipsRow}>
          <SkeletonLine width={70} height={22} radius={12} />
          <SkeletonLine width={60} height={22} radius={12} />
          <SkeletonLine width={'30%'} height={22} radius={12} />
        </View>
      </Card.Content>
    </Card>
  );
};

const Loading: React.FC<LoadingProps> = props => {
  const theme = useTheme();

  if (props.variant === 'skeleton-card-list') {
    const count = props.count ?? 4;
    return (
      <View style={{ paddingVertical: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonAnimalCard key={`sk-${i}`} />
        ))}
      </View>
    );
  }

  if (props.variant === 'inline') {
    return (
      <View style={styles.inline}>
        <PawIconAnimated />
        {typeof props.progress === 'number' ? (
          <ProgressBar progress={props.progress} style={styles.progress} />
        ) : null}
        {props.message ? <Text style={styles.msg}>{props.message}</Text> : null}
      </View>
    );
  }

  // fullscreen
  return (
    <View style={[styles.full, { backgroundColor: theme.colors.background }]}>
      <View style={styles.center}>
        <PawIconAnimated />
        {typeof props.progress === 'number' ? (
          <ProgressBar progress={props.progress} style={styles.progressFull} />
        ) : null}
        {props.message ? (
          <Text style={[styles.msg, { color: theme.colors.onBackground }]}>
            {props.message}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { width: '70%', maxWidth: 420, alignItems: 'center', gap: 12 },
  inline: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  progress: { width: 180, height: 6, borderRadius: 4 },
  progressFull: { alignSelf: 'stretch', height: 6, borderRadius: 4 },
  msg: { marginTop: 4 },
  skelCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  skelCover: { width: '100%', height: 180, backgroundColor: '#ECECEC' },
  skelChipsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
});

export default Loading;
