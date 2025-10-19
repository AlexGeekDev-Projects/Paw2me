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
  type LayoutChangeEvent,
} from 'react-native';
import { Portal, useTheme } from 'react-native-paper';
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

type Props = Readonly<{
  visible: boolean;
  onPick: (r: ReactionKey | null) => void;
  onRequestClose: () => void;
  initial?: ReactionKey | null;
  /** Ancla para posicionar el tray (opcional). */
  anchor?: PickerAnchor;
  /** Subconjunto a mostrar (opcional). */
  availableKeys?: ReactionKey[];
  /** X absoluto (ventana) para controlar el hover desde el padre (Pan tras long-press). */
  hoverX?: number | null;
  /** Callback opcional para informar qué key está activa por hover. */
  onHoverKeyChange?: (k: ReactionKey | null) => void;
}>;

const BASE_ITEM = 36;
const MIN_ITEM = 26;
const GAP = 6;
const PAD_H = 10;

const LIFT_Y = -10;
const SCALE_ON = 1.25;

const ReactionPicker: React.FC<Props> = ({
  visible,
  onPick,
  onRequestClose,
  initial = null,
  anchor,
  availableKeys,
  hoverX = null,
  onHoverKeyChange,
}) => {
  const theme = useTheme();
  const { width: winW, height: winH } = useWindowDimensions();

  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  // anim tray/backdrop
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

  // tamaño/anchura del tray
  const sizes = useMemo(() => {
    const n = Math.max(1, RX.length);
    const maxAvail = Math.max(280, winW - 24 * 2);
    const step = Math.floor((maxAvail - PAD_H * 2 - GAP * (n - 1)) / n);
    const itemSize = Math.max(MIN_ITEM, Math.min(BASE_ITEM, step));
    const totalWidth = n * itemSize + (n - 1) * GAP + PAD_H * 2;
    return { itemSize, totalWidth: Math.min(maxAvail, totalWidth) };
  }, [RX.length, winW]);

  const [trayH, setTrayH] = useState<number>(56);
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    setTrayH(e.nativeEvent.layout.height);
  }, []);

  // ubicación del tray
  const position = useMemo(() => {
    if (!anchor) {
      return { left: (winW - sizes.totalWidth) / 2, top: winH / 2 - trayH / 2 };
    }
    const desiredLeft = anchor.x + anchor.width / 2 - sizes.totalWidth / 2;
    const left = Math.max(
      12,
      Math.min(desiredLeft, winW - sizes.totalWidth - 12),
    );
    const desiredTop = anchor.y - trayH - 4;
    const top = Math.max(12, Math.min(desiredTop, winH - trayH - 12));
    return { left, top };
  }, [anchor, sizes.totalWidth, trayH, winH, winW]);

  // estado y animaciones por ítem
  const [hoverIndex, setHoverIndex] = useState<number>(() =>
    initial ? RX.findIndex(r => r.key === initial) : -1,
  );

  const scales = useMemo<ReadonlyArray<Animated.Value>>(
    () => RX.map(() => new Animated.Value(1)),
    [RX],
  );
  const lifts = useMemo<ReadonlyArray<Animated.Value>>(
    () => RX.map(() => new Animated.Value(0)),
    [RX],
  );
  const lottieRefs = useRef<Array<LottieView | null>>([]);

  // loop continuo de lotties
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(
      () => lottieRefs.current.forEach(ref => ref?.play()),
      0,
    );
    return () => clearTimeout(t);
  }, [visible]);

  const animateIdx = useCallback(
    (idx: number, active: boolean): void => {
      const s = scales[idx];
      const y = lifts[idx];
      if (!s || !y) return;
      Animated.parallel([
        Animated.spring(s, {
          toValue: active ? SCALE_ON : 1,
          useNativeDriver: true,
          friction: 5,
          tension: 180,
        }),
        Animated.spring(y, {
          toValue: active ? LIFT_Y : 0,
          useNativeDriver: true,
          friction: 6,
          tension: 180,
        }),
      ]).start();
    },
    [lifts, scales],
  );

  const setActiveIndex = useCallback(
    (next: number): void => {
      setHoverIndex(prev => {
        if (prev === next) return prev;
        if (prev >= 0) animateIdx(prev, false);
        if (next >= 0 && next < RX.length) animateIdx(next, true);
        const k = next >= 0 && next < RX.length ? RX[next]!.key : null;
        if (onHoverKeyChange) onHoverKeyChange(k);
        return next;
      });
    },
    [RX, animateIdx, onHoverKeyChange],
  );

  // Convertir pageX a índice local del tray
  const getIndexFromAbsoluteX = useCallback(
    (absoluteX: number): number => {
      const xLocal = absoluteX - position.left;
      const step = sizes.itemSize + GAP;
      const rel = xLocal - PAD_H - sizes.itemSize / 2;

      let idx = Math.round(rel / step);
      if (idx < 0) idx = 0;
      const max = RX.length - 1;
      if (idx > max) idx = max;

      return idx;
    },
    [position.left, sizes.itemSize, RX.length],
  );

  // *** Control externo del hover (desde el Pan del botón) ***
  useEffect(() => {
    if (!visible) return;
    if (typeof hoverX !== 'number') return;
    setActiveIndex(getIndexFromAbsoluteX(hoverX));
  }, [getIndexFromAbsoluteX, hoverX, setActiveIndex, visible]);

  // Pan interno (fallback: tocar dentro del tray)
  const pan = useMemo(() => {
    return Gesture.Pan()
      .onBegin(e => setActiveIndex(getIndexFromAbsoluteX(e.absoluteX)))
      .onChange(e => setActiveIndex(getIndexFromAbsoluteX(e.absoluteX)))
      .onEnd(() => {
        const key = hoverIndex >= 0 ? (RX[hoverIndex]?.key ?? null) : null;
        onPick(key);
        onRequestClose();
      })
      .runOnJS(true);
  }, [
    RX,
    getIndexFromAbsoluteX,
    hoverIndex,
    onPick,
    onRequestClose,
    setActiveIndex,
  ]);

  if (!visible) return null;

  return (
    <Portal>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onRequestClose}
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
              {RX.map((r, i) => {
                const s = scales[i]!;
                const y = lifts[i]!;
                return (
                  <Animated.View
                    key={r.key}
                    style={[
                      styles.item,
                      {
                        width: sizes.itemSize,
                        height: sizes.itemSize,
                        marginRight: i < RX.length - 1 ? GAP : 0,
                        // RN types + exactOptionalPropertyTypes: cast controlado
                        transform: [
                          { scale: s },
                          { translateY: y },
                        ] as unknown as any,
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
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  item: { alignItems: 'center', justifyContent: 'center' },
});

export default ReactionPicker;
