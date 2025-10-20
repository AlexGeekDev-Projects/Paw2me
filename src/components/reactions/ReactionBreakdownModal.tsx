import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Modal, Portal, Text, useTheme, Divider } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { REACTIONS, pickReactions } from '@reactions/assets';
import type { ReactionCounts, ReactionKey } from '@reactions/types';

type Props = Readonly<{
  visible: boolean;
  onDismiss: () => void;
  counts: Required<ReactionCounts>;
  availableKeys?: ReactionKey[];
}>;

/** Ajustes visuales para igualar “peso” entre lotties en el modal */
const NORMALIZE: Readonly<
  Partial<Record<ReactionKey, { scale?: number; dy?: number }>>
> = {
  like: { scale: 1.1 },
  love: { scale: 1.0 },
  happy: { scale: 0.9 },
  wow: { scale: 0.9 },
  sad: { scale: 0.85, dy: -1 },
  angry: { scale: 0.85 },
  match: { scale: 1.05 },
};

type TabKey = 'all' | ReactionKey;

const ReactionBreakdownModal: React.FC<Props> = ({
  visible,
  onDismiss,
  counts,
  availableKeys,
}) => {
  const theme = useTheme();
  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  const tabs = useMemo<readonly TabKey[]>(() => {
    const withCount = RX.map(r => [r.key, counts[r.key] ?? 0] as const)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    return (
      withCount.length ? (['all', ...withCount] as const) : (['all'] as const)
    ) as readonly TabKey[];
  }, [RX, counts]);

  const [tab, setTab] = useState<TabKey>('all');

  const total = useMemo(
    () => RX.reduce((s, r) => s + (counts[r.key] ?? 0), 0),
    [RX, counts],
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {/* Tabs */}
        <View style={styles.tabsRow}>
          {tabs.map(k => {
            const active = k === tab;
            const label =
              k === 'all'
                ? `Todas (${total})`
                : `${REACTIONS.find(r => r.key === k)?.label ?? k}`;
            return (
              <Pressable
                key={k}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active
                      ? theme.colors.secondaryContainer
                      : theme.colors.surfaceVariant,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
                onPress={() => setTab(k)}
              >
                <Text
                  variant="labelMedium"
                  style={{
                    color: active
                      ? theme.colors.onSecondaryContainer
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Divider style={{ opacity: 0.4 }} />

        {/* Contenido */}
        {tab === 'all' ? (
          <View style={styles.list}>
            {RX.map(r => ({
              key: r.key,
              label: r.label,
              lottie: r.lottie,
              n: counts[r.key] ?? 0,
            }))
              .filter(item => item.n > 0)
              .sort((a, b) => b.n - a.n)
              .map(item => {
                const adj = NORMALIZE[item.key] ?? {};
                return (
                  <View key={item.key} style={styles.row}>
                    <View style={styles.iconCell}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            transform: [
                              { scale: adj.scale ?? 1 },
                              { translateY: adj.dy ?? 0 },
                            ],
                          }}
                        >
                          <LottieView
                            source={item.lottie}
                            autoPlay
                            loop
                            style={{ width: 28, height: 28 }}
                          />
                        </View>
                      </View>
                    </View>
                    <Text variant="bodyLarge" style={styles.rowLabel}>
                      {item.label}
                    </Text>
                    <Text variant="bodyLarge" style={styles.rowCount}>
                      {item.n}
                    </Text>
                  </View>
                );
              })}
            {total === 0 ? (
              <Text
                variant="bodyMedium"
                style={{ opacity: 0.7, textAlign: 'center', marginTop: 16 }}
              >
                Aún no hay reacciones.
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {(() => {
              const meta = REACTIONS.find(r => r.key === tab)!;
              const n = counts[tab] ?? 0;
              const adj = NORMALIZE[tab] ?? {};
              return (
                <>
                  <View style={[styles.row, { marginBottom: 6 }]}>
                    <View style={styles.iconCell}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            transform: [
                              { scale: adj.scale ?? 1 },
                              { translateY: adj.dy ?? 0 },
                            ],
                          }}
                        >
                          <LottieView
                            source={meta.lottie}
                            autoPlay
                            loop
                            style={{ width: 28, height: 28 }}
                          />
                        </View>
                      </View>
                    </View>
                    <Text variant="titleMedium" style={styles.rowLabel}>
                      {meta.label}
                    </Text>
                    <Text variant="titleMedium" style={styles.rowCount}>
                      {n}
                    </Text>
                  </View>
                  <Divider style={{ opacity: 0.3 }} />
                  <Text
                    variant="bodyMedium"
                    style={{ opacity: 0.7, marginTop: 12 }}
                  >
                    (Aquí puedes listar usuarios cuando tengas esa data.)
                  </Text>
                </>
              );
            })()}
          </View>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconCell: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1 },
  rowCount: { fontWeight: '700' },
});

export default ReactionBreakdownModal;
