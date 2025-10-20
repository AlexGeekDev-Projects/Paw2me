import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { View, StyleSheet, Pressable, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useTheme } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import ReactionPicker, { type PickerAnchor } from './ReactionPicker';
import { REACTIONS, pickReactions } from '@reactions/assets';
import type { ReactionCounts, ReactionKey } from '@reactions/types';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReactionBreakdownModal from './ReactionBreakdownModal';

export type ReactionFooterProps = Readonly<{
  id: string;
  current?: ReactionKey | null;
  counts?: ReactionCounts;
  commentsCount?: number;
  sharesCount?: number;
  onReact?: (id: string, r: ReactionKey, active: boolean) => void;
  onCommentPress?: (id: string) => void;
  onSharePress?: (id: string) => void;
  availableKeys?: ReactionKey[];
}>;

const PRIMARY: ReactionKey = 'like';
const LONG_MS = 280;

/** Misma normalización visual que el picker, aplicada a resumen y botón */
const NORMALIZE_SCALE: Readonly<Partial<Record<ReactionKey, number>>> = {
  like: 1.7,
  love: 1.6,
  happy: 0.95,
  wow: 0.95,
  sad: 0.75,
  angry: 0.7,
  match: 1.45,
};

/** Burbujas + total (estilo FB), normalizadas */
const ReactionSummary: React.FC<
  Readonly<{ counts: Required<ReactionCounts>; availableKeys?: ReactionKey[] }>
> = ({ counts, availableKeys }) => {
  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  const top = useMemo<ReactionKey[]>(() => {
    return RX.map<[ReactionKey, number]>(r => [r.key, counts[r.key] ?? 0])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
  }, [RX, counts]);

  const total = useMemo<number>(
    () => RX.reduce((sum, r) => sum + (counts[r.key] ?? 0), 0),
    [RX, counts],
  );

  if (total === 0) return null;

  return (
    <View style={styles.summaryWrap}>
      <View
        style={[
          styles.bubbles,
          { width: top.length > 0 ? 16 + (top.length - 1) * 12 : 0 },
        ]}
        pointerEvents="none"
      >
        {top.map((k, i) => {
          const meta = REACTIONS.find(r => r.key === k)!;
          const sc = NORMALIZE_SCALE[k] ?? 1;
          return (
            <View
              key={k}
              style={[styles.bubble, { left: i * 12, zIndex: 10 - i }]}
            >
              <LottieView
                source={meta.lottie}
                autoPlay
                loop
                style={{
                  width: 16,
                  height: 16,
                  transform: [{ scale: sc }],
                }}
              />
            </View>
          );
        })}
      </View>
      <Text variant="labelMedium" style={styles.summaryText}>
        {total}
      </Text>
    </View>
  );
};

const ReactionFooter: React.FC<ReactionFooterProps> = ({
  id,
  current = null,
  counts,
  commentsCount = 0,
  sharesCount = 0,
  onReact,
  onCommentPress,
  onSharePress,
  availableKeys,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Reacción local (optimista) y del servidor
  const [currentLocal, setCurrentLocal] = useState<ReactionKey | null>(current);
  const serverCurrentRef = useRef<ReactionKey | null>(current ?? null);
  useEffect(() => {
    serverCurrentRef.current = current ?? null;
    setCurrentLocal(current ?? null);
  }, [current]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | undefined>(
    undefined,
  );
  const [hoverX, setHoverX] = useState<number | null>(null);
  const hoverKeyRef = useRef<ReactionKey | null>(null);
  const startXRef = useRef<number>(0);
  const [animKey, setAnimKey] = useState(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  // Medición de anclas y bounds del contenedor (para centrar el picker en el card)
  const likeAnchorRef = useRef<View>(null);
  const wrapRef = useRef<View>(null);
  const [containerBounds, setContainerBounds] = useState<
    Readonly<{ x: number; width: number }> | undefined
  >(undefined);

  const measureAll = useCallback(() => {
    const view = likeAnchorRef.current as unknown as {
      measureInWindow?: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
    } | null;
    const wrap = wrapRef.current as unknown as {
      measureInWindow?: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
    } | null;

    if (view?.measureInWindow) {
      view.measureInWindow((x, y, w, h) => {
        // ⚠️ sin restar insets: Portal se posiciona en coordenadas de ventana
        const anchor: PickerAnchor = { x, y, width: w, height: h };
        setPickerAnchor(anchor);
      });
    } else {
      setPickerAnchor(undefined);
    }

    if (wrap?.measureInWindow) {
      wrap.measureInWindow((x, _y, w, _h) => {
        setContainerBounds({ x, width: w });
      });
    } else {
      setContainerBounds(undefined);
    }
  }, []);

  const openPicker = useCallback(() => {
    requestAnimationFrame(() => {
      measureAll();
      setPickerOpen(true);
    });
  }, [measureAll]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setHoverX(null);
    hoverKeyRef.current = null;
  }, []);

  // Conteos optimistas
  const countsBase = useMemo<Required<ReactionCounts>>(
    () => ({
      like: 0,
      love: 0,
      happy: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      match: 0,
      ...(counts ?? {}),
    }),
    [counts],
  );

  const countsOptimistic = useMemo<Required<ReactionCounts>>(() => {
    const out = { ...countsBase };
    const prev = serverCurrentRef.current;
    const now = currentLocal;
    if (prev && out[prev] > 0) out[prev] -= 1;
    if (now) out[now] += 1;
    return out;
  }, [countsBase, currentLocal]);

  const currentMeta = useMemo(
    () =>
      currentLocal
        ? (REACTIONS.find(r => r.key === currentLocal) ?? null)
        : null,
    [currentLocal],
  );

  const weight: TextStyle['fontWeight'] = currentLocal ? '700' : '500';

  // Tap rápido = like / deshacer like
  const quickLike = useCallback((): void => {
    const was = currentLocal;
    const next: ReactionKey | null = was === PRIMARY ? null : PRIMARY;
    setCurrentLocal(next);
    if (next) setAnimKey(k => k + 1);
    onReact?.(id, PRIMARY, Boolean(next));
  }, [currentLocal, id, onReact]);

  // Gestos: Tap vs Pan tras long-press con histéresis
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(180)
        .onEnd((_e, success) => {
          if (success) quickLike();
        })
        .runOnJS(true),
    [quickLike],
  );

  const pan = useMemo(() => {
    let active = false;
    return Gesture.Pan()
      .activateAfterLongPress(LONG_MS)
      .shouldCancelWhenOutside(false)
      .activeOffsetX([-2, 2])
      .failOffsetY([-8, 8])
      .cancelsTouchesInView(true)
      .onStart(e => {
        active = true;
        startXRef.current = e.absoluteX;
        openPicker();
        // al abrir, que empiece en la primera reacción; dejamos que el picker haga snap al índice 0
        setHoverX(null);
      })
      .onChange(e => {
        if (!active) return;
        const dx = Math.abs(e.absoluteX - startXRef.current);
        if (dx >= 6) setHoverX(e.absoluteX);
      })
      .onEnd(() => {
        active = false;
        const k = hoverKeyRef.current;
        if (k) {
          setCurrentLocal(k);
          setAnimKey(v => v + 1);
          onReact?.(id, k, true);
        }
        closePicker();
      })
      .onFinalize(() => {
        active = false;
      })
      .runOnJS(true);
  }, [closePicker, id, onReact, openPicker]);

  const combo = useMemo(() => Gesture.Race(tap, pan), [pan, tap]);

  return (
    <View ref={wrapRef} collapsable={false} style={styles.wrap}>
      {/* Resumen estilo FB */}
      <View style={styles.topRow}>
        {/** Sólo si hay reacciones: el resumen ya devuelve null si total===0 */}
        <Pressable
          onPress={() => setBreakdownOpen(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Ver desglose de reacciones"
          style={styles.summaryWrap}
        >
          <ReactionSummary
            counts={countsOptimistic}
            {...(availableKeys ? ({ availableKeys } as const) : {})}
          />
        </Pressable>

        <Text variant="labelSmall" style={styles.topStats}>
          {commentsCount > 0 ? `${commentsCount} comentarios` : ''}
          {commentsCount > 0 && sharesCount > 0 ? '  •  ' : ''}
          {sharesCount > 0 ? `Compartido ${sharesCount}` : ''}
        </Text>
      </View>

      {/* Acciones distribuidas a tercios (más compacto) */}
      <View style={styles.actionsRow}>
        <GestureDetector gesture={combo}>
          <View ref={likeAnchorRef} collapsable={false} style={styles.btnFlex}>
            {currentMeta ? (
              <LottieView
                key={animKey}
                source={currentMeta.lottie}
                autoPlay
                loop={false}
                style={{
                  width: 22,
                  height: 22,
                  marginRight: 6,
                  transform: [{ scale: NORMALIZE_SCALE[currentLocal!] ?? 1 }],
                }}
              />
            ) : null}
            <Text
              variant="labelLarge"
              style={{
                color: currentLocal
                  ? theme.colors.primary
                  : theme.colors.onSurface,
                fontWeight: weight,
              }}
            >
              {currentLocal
                ? (REACTIONS.find(r => r.key === currentLocal)?.label ??
                  'Me gusta')
                : 'Me gusta'}
            </Text>
          </View>
        </GestureDetector>

        <Pressable style={styles.btnFlex} onPress={() => onCommentPress?.(id)}>
          <Text variant="labelLarge" style={styles.mutedCenter}>
            Comentar
          </Text>
        </Pressable>

        <Pressable style={styles.btnFlex} onPress={() => onSharePress?.(id)}>
          <Text variant="labelLarge" style={styles.mutedCenter}>
            Compartir
          </Text>
        </Pressable>
      </View>

      {/* Picker anclado al botón y centrado dentro del card */}
      <ReactionPicker
        visible={pickerOpen}
        initial={currentLocal}
        onPick={() => {
          /* pick final se confirma en onEnd del Pan padre */
        }}
        onRequestClose={closePicker}
        {...(pickerAnchor ? ({ anchor: pickerAnchor } as const) : {})}
        availableKeys={RX.map(r => r.key)}
        hoverX={hoverX}
        onHoverKeyChange={k => {
          hoverKeyRef.current = k;
        }}
        initialIndex={0}
        showIndicator={false}
        {...(containerBounds ? ({ containerBounds } as const) : {})}
        containerPadding={12}
      />
      <ReactionBreakdownModal
        visible={breakdownOpen}
        onDismiss={() => setBreakdownOpen(false)}
        counts={countsOptimistic}
        availableKeys={RX.map(r => r.key)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    minHeight: 18,
  },
  summaryWrap: { flexDirection: 'row', alignItems: 'center' },

  bubbles: { position: 'relative', height: 16 },
  bubble: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  summaryText: { marginLeft: 6, fontWeight: '700' },
  topStats: { marginLeft: 'auto', opacity: 0.7 },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },

  btnFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  mutedCenter: { opacity: 0.8, textAlign: 'center' },
});

export default ReactionFooter;
