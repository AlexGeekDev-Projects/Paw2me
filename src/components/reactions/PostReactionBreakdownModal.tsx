// src/components/reactions/PostReactionBreakdownModal.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Modal, Portal, Text, useTheme, Divider } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { REACTIONS, pickReactions } from '@reactions/assets';
import type { ReactionCounts, ReactionKey } from '@reactions/types';
import {
  getFirestore,
  doc,
  getDoc,
  type FirebaseFirestoreTypes,
} from '@services/firebase';

import {
  listenPostReactorsAll,
  listenPostReactorsByKey,
  type PostReactionDoc,
  type PostReactionKey,
} from '@services/postReactionsService'; // ← nombre correcto

type Props = Readonly<{
  visible: boolean;
  onDismiss: () => void;
  postId: string;
  counts: Required<ReactionCounts>;
  availableKeys?: ReactionKey[];
}>;

type TabKey = 'all' | ReactionKey;
type Order = 'desc' | 'asc';
type LottieSource = React.ComponentProps<typeof LottieView>['source'];

type RowItem = Readonly<{
  key: ReactionKey;
  label: string;
  lottie: LottieSource;
  n: number;
}>;

type UserLight = Readonly<{
  uid: string;
  displayName?: string;
  fullName?: string;
  username?: string;
}>;

type ReactorView = Readonly<{
  userId: string;
  name: string;
  key?: PostReactionKey | null;
  at?: FirebaseFirestoreTypes.Timestamp | FirebaseFirestoreTypes.FieldValue;
}>;

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

const isPostKey = (k: ReactionKey): k is PostReactionKey =>
  k === 'like' ||
  k === 'love' ||
  k === 'happy' ||
  k === 'sad' ||
  k === 'wow' ||
  k === 'angry';

const userRef = (
  uid: string,
): FirebaseFirestoreTypes.DocumentReference<UserLight> =>
  doc(
    getFirestore(),
    'users',
    uid,
  ) as FirebaseFirestoreTypes.DocumentReference<UserLight>;

const displayFromUser = (
  u: UserLight | undefined,
  fallback: string,
): string => {
  if (u?.fullName && u.fullName.trim()) return u.fullName;
  if (u?.displayName && u.displayName.trim()) return u.displayName;
  if (u?.username && u.username.trim()) return u.username;
  return fallback;
};

function isTimestamp(
  v:
    | FirebaseFirestoreTypes.Timestamp
    | FirebaseFirestoreTypes.FieldValue
    | undefined,
): v is FirebaseFirestoreTypes.Timestamp {
  return (
    Boolean(v) &&
    typeof (v as FirebaseFirestoreTypes.Timestamp).toMillis === 'function'
  );
}

const PostReactionBreakdownModal: React.FC<Props> = ({
  visible,
  onDismiss,
  postId,
  counts,
  availableKeys,
}) => {
  const theme = useTheme();
  const RX = useMemo(() => pickReactions(availableKeys), [availableKeys]);

  const withCount = useMemo(
    () =>
      RX.map(r => [r.key, counts[r.key] || 0] as const)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k),
    [RX, counts],
  );

  const tabs: TabKey[] = ['all', ...withCount];

  const [tab, setTab] = useState<TabKey>('all');
  const [order, setOrder] = useState<Order>('desc');

  const total = useMemo(
    () => RX.reduce((s, r) => s + (counts[r.key] || 0), 0),
    [RX, counts],
  );

  const allItems = useMemo<RowItem[]>(() => {
    const items: RowItem[] = RX.map<RowItem>(r => ({
      key: r.key,
      label: r.label,
      lottie: r.lottie as LottieSource,
      n: counts[r.key] || 0,
    }));
    return items.filter(it => it.n > 0);
  }, [RX, counts]);

  const sortedAll = useMemo<RowItem[]>(
    () =>
      [...allItems].sort((a, b) => (order === 'desc' ? b.n - a.n : a.n - b.n)),
    [allItems, order],
  );

  const [reactors, setReactors] = useState<ReadonlyArray<ReactorView>>([]);
  const namesCacheRef = useRef<Map<string, string>>(new Map());

  const resolveNames = useCallback(
    async (
      docs: ReadonlyArray<PostReactionDoc & { id: string }>,
    ): Promise<ReadonlyArray<ReactorView>> => {
      const missing = docs
        .map(d => d.userId)
        .filter(uid => !namesCacheRef.current.has(uid));

      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map(async uid => {
            const s = await getDoc(userRef(uid));
            const name = s.exists()
              ? displayFromUser(s.data(), 'Usuario')
              : 'Usuario';
            return [uid, name] as const;
          }),
        );
        results.forEach(([uid, name]) => namesCacheRef.current.set(uid, name));
      }

      return docs.map(d => ({
        userId: d.userId,
        name: namesCacheRef.current.get(d.userId) ?? 'Usuario',
        key: d.key,
        at: d.updatedAt,
      }));
    },
    [],
  );

  useEffect(() => {
    if (!visible) return;

    if (tab === 'all') {
      const unsub = listenPostReactorsAll(
        postId,
        async docs => {
          const seen = new Set<string>();
          const dedup: Array<PostReactionDoc & { id: string }> = [];
          for (const d of docs) {
            if (!seen.has(d.userId)) {
              seen.add(d.userId);
              dedup.push(d);
            }
          }
          const views = await resolveNames(dedup);
          setReactors(views);
        },
        { limit: 120, order },
      );
      return () => unsub();
    }

    if (isPostKey(tab)) {
      const unsub = listenPostReactorsByKey(
        postId,
        tab,
        async docs => {
          const views = await resolveNames(docs);
          setReactors(views);
        },
        { limit: 80, order },
      );
      return () => unsub();
    }

    setReactors([]);
    return;
  }, [visible, postId, tab, order, resolveNames]);

  useEffect(() => {
    if (!visible) setReactors([]);
  }, [visible]);

  const reactorsSorted = useMemo(() => {
    const arr = reactors.slice();
    arr.sort((a, b) => {
      const am = isTimestamp(a.at) ? a.at.toMillis() : 0;
      const bm = isTimestamp(b.at) ? b.at.toMillis() : 0;
      return order === 'asc' ? am - bm : bm - am;
    });
    return arr;
  }, [reactors, order]);

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

        {/* Orden */}
        <View style={styles.orderRow}>
          {(['desc', 'asc'] as const).map(o => {
            const active = o === order;
            return (
              <Pressable
                key={o}
                onPress={() => setOrder(o)}
                style={[
                  styles.orderChip,
                  {
                    backgroundColor: active
                      ? theme.colors.primaryContainer
                      : theme.colors.surfaceVariant,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <Text
                  variant="labelMedium"
                  style={{
                    color: active
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  {o === 'desc' ? 'Más recientes' : 'Más antiguas'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Divider style={{ opacity: 0.4 }} />

        {/* Contenido */}
        {tab === 'all' ? (
          <View style={styles.list}>
            {[...sortedAll].map(item => {
              const adj = NORMALIZE[item.key] || {};
              return (
                <View key={item.key} style={styles.row}>
                  <View style={styles.iconCell}>
                    <View style={styles.iconBox}>
                      <View
                        style={{
                          transform: [
                            { scale: adj.scale ?? 1 },
                            { translateY: adj.dy ?? 0 },
                          ],
                        }}
                      >
                        <LottieView
                          source={item.lottie as LottieSource}
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

            <Divider style={{ opacity: 0.3, marginTop: 8 }} />

            <Text
              variant="titleSmall"
              style={{ marginTop: 8, marginBottom: 4, opacity: 0.8 }}
            >
              Usuarios
            </Text>

            {reactorsSorted.length === 0 ? (
              <Text variant="bodyMedium" style={{ opacity: 0.7, marginTop: 6 }}>
                Aún no hay reacciones.
              </Text>
            ) : (
              <View style={{ marginTop: 2, gap: 8 }}>
                {reactorsSorted.map(r => {
                  const meta = r.key
                    ? REACTIONS.find(m => m.key === r.key)
                    : undefined;
                  const adj = meta ? NORMALIZE[meta.key] || {} : undefined;
                  return (
                    <View
                      key={`all-${r.userId}`}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      {meta ? (
                        <View style={[styles.iconCell, { marginRight: 4 }]}>
                          <View style={styles.iconBox}>
                            <View
                              style={{
                                transform: [
                                  { scale: (adj?.scale ?? 1) * 0.85 },
                                  { translateY: (adj?.dy ?? 0) * 0.85 },
                                ],
                              }}
                            >
                              <LottieView
                                source={meta.lottie as LottieSource}
                                autoPlay
                                loop
                                style={{ width: 24, height: 24 }}
                              />
                            </View>
                          </View>
                        </View>
                      ) : null}
                      <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                        {r.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {(() => {
              const meta = REACTIONS.find(r => r.key === tab)!;
              const n = counts[tab] || 0;
              const adj = NORMALIZE[tab] || {};
              return (
                <>
                  <View style={[styles.row, { marginBottom: 6 }]}>
                    <View style={styles.iconCell}>
                      <View style={styles.iconBox}>
                        <View
                          style={{
                            transform: [
                              { scale: adj.scale ?? 1 },
                              { translateY: adj.dy ?? 0 },
                            ],
                          }}
                        >
                          <LottieView
                            source={meta.lottie as LottieSource}
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

                  {reactorsSorted.length === 0 ? (
                    <Text
                      variant="bodyMedium"
                      style={{ opacity: 0.7, marginTop: 12 }}
                    >
                      Nadie ha reaccionado aún.
                    </Text>
                  ) : (
                    <View style={{ marginTop: 8, gap: 8 }}>
                      {reactorsSorted.map(r => (
                        <View
                          key={`${tab}-${r.userId}`}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <Text
                            variant="bodyLarge"
                            style={{ fontWeight: '600' }}
                          >
                            {r.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
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
  container: { marginHorizontal: 16, borderRadius: 16, padding: 12 },
  tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  orderRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  orderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconCell: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1 },
  rowCount: { fontWeight: '700' },
});

export default PostReactionBreakdownModal;
