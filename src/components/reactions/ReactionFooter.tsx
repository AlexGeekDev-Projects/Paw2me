import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, type TextStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import ReactionPicker, { type PickerAnchor } from './ReactionPicker';
import { REACTIONS, pickReactions } from '@reactions/assets';
import type { ReactionCounts, ReactionKey } from '@reactions/types';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
      <View style={styles.bubbles}>
        {top.map((k, i) => {
          const meta = REACTIONS.find(r => r.key === k)!;
          return (
            <View
              key={k}
              style={[styles.bubble, { left: i * 14, zIndex: 10 - i }]}
            >
              <LottieView
                source={meta.lottie}
                autoPlay
                loop
                style={{ width: 18, height: 18 }}
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
  const [currentLocal, setCurrentLocal] = useState<ReactionKey | null>(current);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState<PickerAnchor | undefined>(
    undefined,
  );
  const [hoverX, setHoverX] = useState<number | null>(null);
  const hoverKeyRef = useRef<ReactionKey | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  const likeAnchorRef = useRef<View>(null);

  const countsLocal = useMemo<Required<ReactionCounts>>(
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

  const currentMeta =
    (currentLocal && REACTIONS.find(r => r.key === currentLocal)) ||
    REACTIONS.find(r => r.key === PRIMARY)!;

  const weight: TextStyle['fontWeight'] = currentLocal ? '700' : '500';

  const quickLike = useCallback((): void => {
    const next = currentLocal === PRIMARY ? null : PRIMARY;
    setCurrentLocal(next);
    if (next) setAnimKey(k => k + 1);
    onReact?.(id, PRIMARY, Boolean(next));
  }, [currentLocal, id, onReact]);

  const measureAnchor = useCallback(() => {
    const view = likeAnchorRef.current as unknown as {
      measureInWindow?: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
    } | null;
    if (view?.measureInWindow) {
      view.measureInWindow((x, y, w, h) => {
        setPickerAnchor({ x, y, width: w, height: h });
      });
    } else {
      setPickerAnchor(undefined);
    }
  }, []);

  const openPicker = useCallback(() => {
    measureAnchor();
    setPickerOpen(true);
  }, [measureAnchor]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setHoverX(null);
    hoverKeyRef.current = null;
  }, []);

  // Gestos: Tap rápido vs Pan activado por long-press
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
        openPicker();
        setHoverX(e.absoluteX);
      })
      .onChange(e => {
        if (active) setHoverX(e.absoluteX);
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
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <ReactionSummary
          counts={countsLocal}
          {...(availableKeys ? ({ availableKeys } as const) : {})}
        />
        <Text variant="labelMedium" style={styles.topStats}>
          {commentsCount > 0 ? `${commentsCount} comentarios` : ''}
          {commentsCount > 0 && sharesCount > 0 ? '  •  ' : ''}
          {sharesCount > 0 ? `Compartido ${sharesCount}` : ''}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <GestureDetector gesture={combo}>
          <View ref={likeAnchorRef} collapsable={false} style={styles.btn}>
            <LottieView
              key={animKey}
              source={currentMeta.lottie}
              autoPlay
              loop={false}
              style={{ width: 26, height: 26, marginRight: 6 }}
            />
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
                ? REACTIONS.find(r => r.key === currentLocal)?.label
                : 'Me gusta'}
            </Text>
          </View>
        </GestureDetector>

        <Pressable style={styles.btn} onPress={() => onCommentPress?.(id)}>
          <Text variant="labelLarge" style={styles.muted}>
            Comentar
          </Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => onSharePress?.(id)}>
          <Text variant="labelLarge" style={styles.muted}>
            Compartir
          </Text>
        </Pressable>
      </View>

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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  summaryWrap: { flexDirection: 'row', alignItems: 'center' },
  bubbles: { position: 'relative', width: 40, height: 18 },
  bubble: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  summaryText: { marginLeft: 40, fontWeight: '700' },
  topStats: { marginLeft: 'auto', opacity: 0.7 },

  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  muted: { opacity: 0.75 },
});

export default ReactionFooter;
