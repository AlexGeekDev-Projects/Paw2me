import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, FlatList, StyleSheet, Pressable, Image } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { ListRenderItemInfo } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  IconButton,
  Menu,
  Text,
  useTheme,
  Avatar,
  FAB,
} from 'react-native-paper';
import ImageViewing from 'react-native-image-viewing';
import PagerView from 'react-native-pager-view';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';

import type { FeedNav } from '@navigation/types';
import type { Post, PostMedia, ReactionKind } from '@models/community';
import {
  subscribeCommunityFeed,
  toggleReaction,
  deleteMyPost,
} from '@services/communityService';

// ─────────────────────────────────────────────────────────────
// Helpers y tipos locales
// ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

type ImgSource = { uri: string } | number;

function isImage(m: PostMedia): m is PostMedia & { kind: 'image' } {
  return m.kind === 'image';
}
function isVideo(m: PostMedia): m is PostMedia & { kind: 'video' } {
  return m.kind === 'video';
}

function initialFromName(name?: string): string {
  const s = (name ?? '').trim();
  return s ? s[0]!.toUpperCase() : 'U';
}

const StatChip: React.FC<{
  icon: string;
  value: number;
  onPress: () => void;
}> = ({ icon, value, onPress }) => (
  <Chip compact icon={icon} onPress={onPress} style={{ marginRight: 6 }}>
    {value}
  </Chip>
);

const Dots: React.FC<{ total: number; index: number }> = ({ total, index }) => {
  const theme = useTheme();
  if (total <= 1) return null;
  const pillBg = theme.dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.25)';
  const activeDot = '#fff';
  const inactiveDot = theme.dark ? '#ffffff80' : '#ffffff66';
  return (
    <View pointerEvents="none" style={styles.dotsWrap}>
      <View style={[styles.dotsPill, { backgroundColor: pillBg }]}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === index ? activeDot : inactiveDot },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const OwnerMenu: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({
  onEdit,
  onDelete,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={<IconButton icon="dots-vertical" onPress={() => setOpen(true)} />}
    >
      <Menu.Item
        leadingIcon="pencil"
        onPress={() => {
          setOpen(false);
          onEdit();
        }}
        title="Editar publicación"
      />
      <Menu.Item
        leadingIcon="delete"
        onPress={() => {
          setOpen(false);
          onDelete();
        }}
        title="Eliminar publicación"
      />
    </Menu>
  );
};

const PostCard: React.FC<{
  post: Readonly<Post>;
  visible: boolean;
  onOpenImageViewer: (startIndex: number, urls: string[]) => void;
  onOpenAvatar: (avatarUrl: string) => void;
  onOpenVideo: (videoUrl: string) => void;
  onToggle: (k: ReactionKind) => void;
  onComments: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({
  post,
  visible,
  onOpenImageViewer,
  onOpenAvatar,
  onOpenVideo,
  onToggle,
  onComments,
  onEdit,
  onDelete,
}) => {
  const theme = useTheme();
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);

  const media = post.media ?? [];
  const total = media.length;

  // string[] mutable (no ReadonlyArray) para el visor
  const imageUrls = useMemo(
    () => media.filter(isImage).map(m => m.downloadURL),
    [media],
  );

  const likes = post.counters?.like ?? 0;
  const recs = post.counters?.recommend ?? 0;
  const comments = post.counters?.comment ?? 0;

  const authorName = post.authorName ?? `User-${post.authorUid.slice(0, 6)}`;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        {post.authorAvatarURL ? (
          <Pressable
            onPress={() => onOpenAvatar(post.authorAvatarURL!)}
            hitSlop={8}
          >
            <Avatar.Image size={32} source={{ uri: post.authorAvatarURL }} />
          </Pressable>
        ) : (
          <Avatar.Text size={32} label={initialFromName(authorName)} />
        )}
        <View style={{ flex: 1 }}>
          <Text variant="titleSmall" numberOfLines={1}>
            {authorName}
          </Text>
        </View>
        <OwnerMenu onEdit={onEdit} onDelete={onDelete} />
      </View>

      {/* Carrusel */}
      {total > 0 && (
        <View style={{ position: 'relative' }}>
          <PagerView
            ref={pagerRef}
            style={{ height: Math.round((9 / 16) * 400) }}
            initialPage={0}
            onPageSelected={e => setPage(e.nativeEvent.position)}
          >
            {media.map((m, idx) => {
              const active = visible && page === idx;
              const key = `${post.id}_${idx}`;

              if (isImage(m)) {
                const previousImages = media
                  .slice(0, idx)
                  .filter(isImage).length;
                return (
                  <View key={key} style={{ height: '100%' }}>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() =>
                        onOpenImageViewer(previousImages, imageUrls)
                      }
                    >
                      <Image
                        source={{ uri: m.downloadURL }}
                        style={styles.media}
                        resizeMode="cover"
                      />
                    </Pressable>
                  </View>
                );
              }

              // Video
              return (
                <View key={key} style={styles.mediaBox}>
                  {active ? (
                    <Video
                      source={{ uri: m.downloadURL }}
                      style={styles.media}
                      resizeMode="cover"
                      repeat
                      muted
                      paused={!active}
                      playInBackground={false}
                      playWhenInactive={false}
                      useTextureView={false}
                    />
                  ) : (
                    <View style={[styles.media, { backgroundColor: '#111' }]} />
                  )}
                  <View pointerEvents="box-none" style={styles.playOverlay}>
                    <IconButton
                      icon="play-circle"
                      size={64}
                      mode="contained"
                      onPress={() => onOpenVideo(m.downloadURL)}
                    />
                  </View>
                </View>
              );
            })}
          </PagerView>
          <Dots total={total} index={page} />
        </View>
      )}

      {post.text ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text variant="bodyMedium">{post.text}</Text>
        </View>
      ) : null}

      {/* Resumen reacciones */}
      <View style={styles.actions}>
        <StatChip
          icon="thumb-up-outline"
          value={likes}
          onPress={() => onToggle('like')}
        />
        <StatChip
          icon="star-outline"
          value={recs}
          onPress={() => onToggle('recommend')}
        />
        <View style={{ flex: 1 }} />
        <StatChip
          icon="comment-outline"
          value={comments}
          onPress={onComments}
        />
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Componente principal (Feed)
// ─────────────────────────────────────────────────────────────

const CommunityFeed: React.FC = () => {
  const nav = useNavigation<FeedNav>();
  const theme = useTheme();

  const [items, setItems] = useState<ReadonlyArray<Post>>([]);
  const [loading, setLoading] = useState(true);
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const [imgViewer, setImgViewer] = useState<{
    visible: boolean;
    images: ImgSource[]; // ← array mutable
    index: number;
  }>({ visible: false, images: [], index: 0 });

  useEffect(() => {
    const off = subscribeCommunityFeed({
      limit: PAGE_SIZE,
      onData: list => {
        setItems(list);
        setLoading(false);
      },
      onError: () => setLoading(false),
    });
    return off;
  }, []);

  const keyExtractor = useCallback((p: Post) => p.id, []);
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 70 }),
    [],
  );
  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: ReadonlyArray<{ item: unknown }>;
    }) => {
      const first = viewableItems?.[0]?.item as Post | undefined;
      setVisibleId(first?.id ?? null);
    },
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Post>) => (
      <PostCard
        post={item}
        visible={item.id === visibleId}
        onOpenImageViewer={(startIndex, urls) => {
          const imgs: ImgSource[] = urls.map(u => ({ uri: u }));
          setImgViewer({ visible: true, images: imgs, index: startIndex });
        }}
        onOpenAvatar={url =>
          setImgViewer({ visible: true, images: [{ uri: url }], index: 0 })
        }
        onOpenVideo={() => {}}
        onToggle={(k: ReactionKind) => void toggleReaction(item.id, k)}
        onComments={() =>
          nav.navigate({ name: 'PostDetail', params: { postId: item.id } })
        }
        onEdit={() =>
          nav.navigate({ name: 'CreatePost', params: { editPostId: item.id } })
        }
        onDelete={() => void deleteMyPost(item.id)}
      />
    ),
    [visibleId, nav],
  );

  if (loading) {
    return (
      <View
        style={[styles.center, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 6, opacity: 0.7 }}>Cargando…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={['top', 'bottom', 'left', 'right']} // ← importante
    >
      <FlatList<Post>
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig}
        // deja respiración arriba y evita que el FAB tape el final
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: Math.max(96, insets.bottom + 96),
        }}
        contentInsetAdjustmentBehavior="always" // iOS notch-friendly
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={6}
        initialNumToRender={6}
      />

      <ImageViewing
        images={imgViewer.images}
        imageIndex={imgViewer.index}
        visible={imgViewer.visible}
        onRequestClose={() => setImgViewer(s => ({ ...s, visible: false }))}
        swipeToCloseEnabled
      />

      <FAB
        icon="plus"
        label="Crear"
        onPress={() => nav.navigate({ name: 'CreatePost', params: {} })}
        style={[
          styles.fab,
          {
            // se eleva sobre el home-indicator/gesture bar y respeta safe area lateral
            bottom: insets.bottom + 16,
            right: insets.right + 16,
          },
        ]}
      />
    </SafeAreaView>
  );
};

export default CommunityFeed;

// ─────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  mediaBox: { width: '100%', height: '100%', backgroundColor: '#111' },
  media: { width: '100%', height: '100%' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dotsWrap: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  dotsPill: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
