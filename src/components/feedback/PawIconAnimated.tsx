import React from 'react';
import { Animated } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { StyleProp, ViewStyle } from 'react-native';

export type PawIconAnimatedProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Duración del giro completo en ms */
  durationMs?: number;
  /** Amplitud del “salto” vertical en px */
  bobDistance?: number;
};

const PawIconAnimated: React.FC<PawIconAnimatedProps> = ({
  size = 56,
  color,
  style,
  durationMs = 2200,
  bobDistance = 6,
}) => {
  const theme = useTheme();
  const spin = React.useRef(new Animated.Value(0)).current;
  const bob = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: durationMs,
        useNativeDriver: true,
      }),
    );
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -bobDistance,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    spinLoop.start();
    bobLoop.start();
    return () => {
      spinLoop.stop();
      bobLoop.stop();
    };
  }, [spin, bob, durationMs, bobDistance]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[{ transform: [{ translateY: bob }, { rotate }] }, style]}
    >
      <Icon
        name="paw"
        size={size}
        color={color ?? (theme.colors.primary as string)}
      />
    </Animated.View>
  );
};

export default PawIconAnimated;
