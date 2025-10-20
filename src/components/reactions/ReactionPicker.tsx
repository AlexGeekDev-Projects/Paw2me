import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  useWindowDimensions,
  Pressable,
  Vibration,
  Platform,
  Easing,
  type LayoutChangeEvent,
} from 'react-native';
import { Portal, useTheme, Text } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { pickReactions } from '@reactions/assets';
import type { ReactionKey } from '@reactions/types';

export type PickerAnchor = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;
type ContainerBounds = Readonly<{ x: number; width: number }>;

type Props = Readonly<{
  visible: boolean;
  onPick: (r: ReactionKey | null) => void;
  onRequestClose: () => void;
  initial?: ReactionKey | null;
  anchor?: PickerAnchor;
  availableKeys?: ReactionKey[];
  hoverX?: number | null;
  onHoverKeyChange?: (k: ReactionKey | null) => void;
  initialIndex?: number;
  showIndicator?: boolean;
  containerBounds?: ContainerBounds;
  containerPadding?: number;
}>;

/** Tamaños base */
const BASE_ITEM = 46;
const MIN_ITEM = 32;
const GAP = 8;
const PAD_H = 12;

/** Curvas estilo FB */
const LIFT_ACTIVE = -28;
const LIFT_NEIGHBOR = -8;
const SCALE_ACTIVE = 3.0;
const SCALE_NEIGHBOR = 1.18;

const INDICATOR_SIZE = 54;
const LABEL_OFFSET_Y = -24;
const ABOVE_GAP_Y = 6; // separación visual exacta sobre el botón

/** Duración del “snap” visual al soltar */
const SNAP_MS = 110;

/** Normalización por reacción (ajuste visual) */
const NORMALIZE: Readonly<
  Partial<Record<ReactionKey, { scale?: number; dy?: number }>>
> = {
  like: { scale: 1.25 },
  love: { scale: 0.75, dy: -1 },
  happy: { scale: 0.95 },
  wow: { scale: 0.95 },
  sad: { scale: 0.75, dy: -1 },
  angry: { scale: 0.7 },
  match: { scale: 0.85 },
};

type HapticModule = {
  default: {
    trigger: (
      type: 'selection' | string,
      options?: {
        enableVibrateFallback?: boolean;
        ignoreAndroidSystemSettings?: boolean;
      },
    ) => void;
  };
};

const ReactionPicker: React.FC<Props> = ({
  visible,
  onPick,
  onRequestClose,
  initial = null,
  anchor,
  availableKeys,
  hoverX = null,
  onHoverKeyChange,
  initialIndex = 0,
  showIndicator = false,
  containerBounds,
  containerPadding = 12,
}) => {
  const theme = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();
  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  // --- tray/backdrop
  const trayScale = useRef(new Animated.Value(0.94)).current;
  const trayOpacity = useRef(new Animated.Value(0)).current;
  const trayTranslate = useRef(new Animated.Value(6)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(trayScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }),
      Animated.timing(trayOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(trayTranslate, {
        toValue: 0,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }),
    ]).start();
  }, [backdrop, trayOpacity, trayScale, trayTranslate, visible]);

  // --- tamaño/anchura del tray (ancho del contenedor)
  const sizes = useMemo(() => {
    const n = Math.max(1, RX.length);
    const containerW = containerBounds?.width ?? winW;
    const maxAvail = Math.max(220, containerW - containerPadding * 2);
    const step = Math.floor((maxAvail - PAD_H * 2 - GAP * (n - 1)) / n);
    const itemSize = Math.max(MIN_ITEM, Math.min(BASE_ITEM, step));
    const totalWidth = n * itemSize + (n - 1) * GAP + PAD_H * 2;
    return {
      itemSize,
      totalWidth: Math.min(maxAvail, totalWidth),
      count: n,
      step: itemSize + GAP,
    } as const;
  }, [RX.length, containerBounds?.width, containerPadding, winW]);

  // --- posición del tray (clamp dentro del card)
  const [trayH, setTrayH] = useState<number>(56);
  const onLayout = useCallback(
    (e: LayoutChangeEvent): void => setTrayH(e.nativeEvent.layout.height),
    [],
  );
  const position = useMemo(() => {
    const boundX = containerBounds?.x ?? 0;
    const boundW = containerBounds?.width ?? winW;
    const clampLeft = boundX + containerPadding;
    const clampRight = boundX + boundW - containerPadding - sizes.totalWidth;

    if (!anchor) {
      const leftCenter = boundX + (boundW - sizes.totalWidth) / 2;
      return {
        left: Math.max(clampLeft, Math.min(leftCenter, clampRight)),
        top: winH / 2 - trayH / 2,
      };
    }
    const desiredLeft = anchor.x + anchor.width / 2 - sizes.totalWidth / 2;
    const left = Math.max(clampLeft, Math.min(desiredLeft, clampRight));
    const desiredTop = anchor.y - trayH - ABOVE_GAP_Y;
    const top = Math.max(12, Math.min(desiredTop, winH - trayH - 12));
    return { left, top };
  }, [
    anchor,
    containerBounds?.x,
    containerBounds?.width,
    containerPadding,
    sizes.totalWidth,
    trayH,
    winH,
    winW,
  ]);

  // --- índice y refs
  const [hoverIndex, setHoverIndex] = useState<number>(() =>
    initial ? RX.findIndex(r => r.key === initial) : -1,
  );
  const lottieRefs = useRef<Array<LottieView | null>>([]);

  // --- indicador + label
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorXVal = useRef<number>(0);
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const indicatorHalf = useRef(new Animated.Value(INDICATOR_SIZE / 2)).current;

  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTranslateY = useRef(new Animated.Value(0)).current;
  const [labelText, setLabelText] = useState<string>('');
  const [labelW, setLabelW] = useState<number>(0);
  const labelHalf = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    labelHalf.setValue(labelW / 2);
  }, [labelW, labelHalf]);

  const prevIndexRef = useRef<number>(-1);
  const indicatorVisibleRef = useRef(false);

  // --- háptica suave
  const hapticModuleRef = useRef<HapticModule['default'] | null>(null);
  useEffect(() => {
    if (Platform.OS === 'ios') {
      try {
        const mod = require('react-native-haptic-feedback') as HapticModule;
        hapticModuleRef.current = mod.default;
      } catch {
        hapticModuleRef.current = null;
      }
    }
  }, []);
  const lastHapticAt = useRef(0);
  const softHaptic = useCallback((idx: number) => {
    if (idx === prevIndexRef.current) return;
    const now = Date.now();
    if (now - lastHapticAt.current < 60) return;
    lastHapticAt.current = now;
    if (Platform.OS === 'android') Vibration.vibrate(4);
    else if (Platform.OS === 'ios' && hapticModuleRef.current)
      hapticModuleRef.current.trigger('selection', {
        enableVibrateFallback: false,
        ignoreAndroidSystemSettings: true,
      });
  }, []);

  // --- loop lotties
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(
      () => lottieRefs.current.forEach(ref => ref?.play()),
      0,
    );
    return () => clearTimeout(t);
  }, [visible]);

  // --- centros X locales
  const centers = useMemo<number[]>(() => {
    const out: number[] = [];
    for (let i = 0; i < sizes.count; i++)
      out.push(PAD_H + i * sizes.step + sizes.itemSize / 2);
    return out;
  }, [sizes.count, sizes.itemSize, sizes.step]);

  // --- normalización (constante por reacción)
  const normScaleNum = useMemo<number[]>(
    () => RX.map(r => NORMALIZE[r.key]?.scale ?? 1),
    [RX],
  );
  const normDyNum = useMemo<number[]>(
    () => RX.map(r => NORMALIZE[r.key]?.dy ?? 0),
    [RX],
  );
  const normScaleVals = useMemo(
    () => normScaleNum.map(v => new Animated.Value(v)),
    [normScaleNum],
  );
  const normDyVals = useMemo(
    () => normDyNum.map(v => new Animated.Value(v)),
    [normDyNum],
  );

  // --- interpolaciones continuas
  const scales = useMemo<ReadonlyArray<Animated.AnimatedInterpolation<number>>>(
    () =>
      centers.map(cx =>
        indicatorX.interpolate({
          inputRange: [
            cx - 1.5 * sizes.step,
            cx - 0.5 * sizes.step,
            cx,
            cx + 0.5 * sizes.step,
            cx + 1.5 * sizes.step,
          ],
          outputRange: [1, SCALE_NEIGHBOR, SCALE_ACTIVE, SCALE_NEIGHBOR, 1],
          extrapolate: 'clamp',
        }),
      ),
    [centers, indicatorX, sizes.step],
  );

  const lifts = useMemo<ReadonlyArray<Animated.AnimatedInterpolation<number>>>(
    () =>
      centers.map(cx =>
        indicatorX.interpolate({
          inputRange: [
            cx - 1.5 * sizes.step,
            cx - 0.5 * sizes.step,
            cx,
            cx + 0.5 * sizes.step,
            cx + 1.5 * sizes.step,
          ],
          outputRange: [0, LIFT_NEIGHBOR, LIFT_ACTIVE, LIFT_NEIGHBOR, 0],
          extrapolate: 'clamp',
        }),
      ),
    [centers, indicatorX, sizes.step],
  );

  // --- util: clamp center desde absoluteX -> coords locales
  const getClampedCenterFromAbsoluteX = useCallback(
    (absoluteX: number): number => {
      const xLocal = absoluteX - position.left;
      const min = PAD_H + sizes.itemSize / 2;
      const max = sizes.totalWidth - PAD_H - sizes.itemSize / 2;
      return Math.max(min, Math.min(xLocal, max));
    },
    [position.left, sizes.itemSize, sizes.totalWidth],
  );

  // --- índice por centro MÁS CERCANO
  const nearestIndexFromCenter = useCallback(
    (centerLocal: number): number => {
      const firstCenter = PAD_H + sizes.itemSize / 2;
      let idx = Math.round((centerLocal - firstCenter) / sizes.step);
      if (idx < 0) idx = 0;
      const max = RX.length - 1;
      if (idx > max) idx = max;
      return idx;
    },
    [RX.length, sizes.itemSize, sizes.step],
  );

  // --- indicador + label show/hide
  const showIndicatorAndLabel = useCallback(
    (idx: number) => {
      if (!indicatorVisibleRef.current) {
        indicatorVisibleRef.current = true;
        Animated.timing(indicatorOpacity, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }).start();
      }
      const nextLabel = RX[idx]?.label ?? '';
      if (nextLabel) setLabelText(nextLabel);
      Animated.parallel([
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.spring(labelTranslateY, {
          toValue: LABEL_OFFSET_Y,
          useNativeDriver: true,
          friction: 6,
          tension: 200,
        }),
      ]).start();
    },
    [RX, indicatorOpacity, labelOpacity, labelTranslateY],
  );

  const hideIndicatorAndLabel = useCallback(() => {
    indicatorVisibleRef.current = false;
    Animated.parallel([
      Animated.timing(indicatorOpacity, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(labelTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 180,
      }),
    ]).start();
  }, [indicatorOpacity, labelOpacity, labelTranslateY]);

  // --- arranque inicial (si no hay hoverX externo)
  useEffect(() => {
    if (!visible) return;
    if (centers.length === 0) return;
    if (hoverX != null) return;
    const idx = Math.max(0, Math.min(initialIndex, centers.length - 1));
    const cx = centers[idx]!;
    indicatorX.setValue(cx);
    indicatorXVal.current = cx;
    prevIndexRef.current = idx;
    setHoverIndex(idx);
    onHoverKeyChange?.(RX[idx]!.key);
    showIndicatorAndLabel(idx);
  }, [
    centers,
    hoverX,
    indicatorX,
    initialIndex,
    onHoverKeyChange,
    RX,
    showIndicatorAndLabel,
    visible,
  ]);

  // --- flujo continuo
  const updateHoverFromAbsoluteX = useCallback(
    (absoluteX: number): void => {
      const center = getClampedCenterFromAbsoluteX(absoluteX);
      indicatorX.setValue(center);
      indicatorXVal.current = center;

      const idx = nearestIndexFromCenter(center);
      if (idx !== prevIndexRef.current) {
        prevIndexRef.current = idx;
        setHoverIndex(idx);
        showIndicatorAndLabel(idx);
        softHaptic(idx);
        onHoverKeyChange?.(RX[idx]!.key);
      }
    },
    [
      RX,
      getClampedCenterFromAbsoluteX,
      indicatorX,
      nearestIndexFromCenter,
      onHoverKeyChange,
      showIndicatorAndLabel,
      softHaptic,
    ],
  );

  // --- reset
  const resetAll = useCallback(() => {
    setHoverIndex(-1);
    prevIndexRef.current = -1;
    hideIndicatorAndLabel();
    onHoverKeyChange?.(null);
  }, [hideIndicatorAndLabel, onHoverKeyChange]);

  // --- control externo (desde el botón)
  useEffect(() => {
    if (!visible) return;
    if (typeof hoverX !== 'number') return;
    updateHoverFromAbsoluteX(hoverX);
  }, [hoverX, updateHoverFromAbsoluteX, visible]);

  // --- pan interno con SNAP en onEnd
  const pan = useMemo(() => {
    return Gesture.Pan()
      .onBegin(e => updateHoverFromAbsoluteX(e.absoluteX))
      .onChange(e => updateHoverFromAbsoluteX(e.absoluteX))
      .onEnd(() => {
        const idx = nearestIndexFromCenter(indicatorXVal.current);
        const target = centers[idx] ?? indicatorXVal.current;

        // Snap visual corto al centro más cercano
        Animated.timing(indicatorX, {
          toValue: target,
          duration: SNAP_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          indicatorXVal.current = target;
          prevIndexRef.current = idx;
          setHoverIndex(idx);
          showIndicatorAndLabel(idx);

          const key = RX[idx]?.key ?? null;
          onPick(key);
          onRequestClose();
          resetAll();
        });
      })
      .runOnJS(true);
  }, [
    RX,
    centers,
    indicatorX,
    nearestIndexFromCenter,
    onPick,
    onRequestClose,
    resetAll,
    showIndicatorAndLabel,
    updateHoverFromAbsoluteX,
  ]);

  // --- estilos animados
  const labelStyle = useMemo(
    () => [
      styles.label,
      {
        backgroundColor: theme.colors.inverseSurface,
        borderColor: theme.colors.outlineVariant,
        opacity: labelOpacity,
        transform: [
          { translateY: labelTranslateY },
          { translateX: Animated.subtract(indicatorX, labelHalf) },
        ],
      },
    ],
    [
      indicatorX,
      labelHalf,
      labelOpacity,
      labelTranslateY,
      theme.colors.inverseSurface,
      theme.colors.outlineVariant,
    ],
  );

  if (!visible) return null;

  return (
    <Portal>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                onRequestClose();
                resetAll();
              }}
            />
          </Animated.View>

          <Animated.View
            onLayout={onLayout}
            style={[
              styles.tray,
              {
                left: position.left,
                top: position.top,
                width: sizes.totalWidth,
                backgroundColor: theme.colors.surface,
                opacity: trayOpacity,
                transform: [
                  { scale: trayScale },
                  { translateY: trayTranslate },
                ],
              },
            ]}
          >
            <View style={[styles.inner, { paddingHorizontal: PAD_H }]}>
              {/* Etiqueta flotante centrada */}
              {labelText ? (
                <Animated.View
                  pointerEvents="none"
                  style={labelStyle}
                  onLayout={(e: LayoutChangeEvent) =>
                    setLabelW(e.nativeEvent.layout.width)
                  }
                >
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.inverseOnSurface }}
                  >
                    {labelText}
                  </Text>
                </Animated.View>
              ) : null}

              {/* Indicador (opcional) */}
              {showIndicator ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.indicator,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      opacity: indicatorOpacity,
                      transform: [
                        {
                          translateX: Animated.subtract(
                            indicatorX,
                            indicatorHalf,
                          ),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}

              {RX.map((r, i) => {
                const s = scales[i]!;
                const y = lifts[i]!;
                const sNorm = Animated.multiply(s, normScaleVals[i]!);
                const yNorm = Animated.add(y, normDyVals[i]!);
                const isActive = i === hoverIndex;

                return (
                  <Animated.View
                    key={r.key}
                    style={[
                      styles.item,
                      {
                        width: sizes.itemSize,
                        height: sizes.itemSize,
                        marginRight: i < RX.length - 1 ? GAP : 0,
                        zIndex: isActive ? 2 : 1,
                        transform: [
                          { translateY: yNorm },
                          { scale: sNorm },
                        ] as unknown as any,
                        shadowOpacity: isActive ? 0.25 : 0,
                        shadowRadius: isActive ? 12 : 0,
                        shadowOffset: isActive
                          ? { width: 0, height: 6 }
                          : { width: 0, height: 0 },
                        elevation: isActive ? 9 : 0,
                      },
                    ]}
                  >
                    <LottieView
                      ref={ref => {
                        lottieRefs.current[i] = ref;
                      }}
                      style={{ width: sizes.itemSize, height: sizes.itemSize }}
                      source={r.lottie}
                      autoPlay
                      loop
                    />
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </Portal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  tray: {
    position: 'absolute',
    borderRadius: 22,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  inner: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  item: { alignItems: 'center', justifyContent: 'center' },
  indicator: {
    position: 'absolute',
    top: -4,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    opacity: 0,
  },
  label: {
    position: 'absolute',
    top: -36,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default ReactionPicker;
