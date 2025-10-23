// src/components/comments/CommentsSheet.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  StyleSheet,
  TextInput as RNTextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import {
  Modal,
  Portal,
  Text,
  IconButton,
  Divider,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type CommentItem = Readonly<{
  id: string;
  author: string;
  avatarURL?: string;
  text: string;
  createdAt: number;
}>;

type Props = Readonly<{
  visible: boolean;
  onClose: () => void;
  postId: string;
  comments?: ReadonlyArray<CommentItem>;
  onSend?: (text: string) => void | Promise<void>;
  initialSnap?: 'peek' | 'half' | 'full';
}>;

const DRAG_DISMISS_THRESHOLD = 140;

const CommentsSheet: React.FC<Props> = ({
  visible,
  onClose,
  postId,
  comments = [],
  onSend,
  initialSnap = 'half',
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH, width } = useWindowDimensions();

  const snaps = useMemo(() => {
    const peek = Math.round(winH * 0.3);
    const half = Math.round(winH * 0.56);
    const full = Math.max(320, winH - 80);
    return { peek, half, full };
  }, [winH]);

  const startH =
    initialSnap === 'full'
      ? snaps.full
      : initialSnap === 'peek'
        ? snaps.peek
        : snaps.half;

  // Altura animada del contenedor (desde bottom)
  const sheetH = useRef(new Animated.Value(startH)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.spring(sheetH, {
      toValue: startH,
      useNativeDriver: false,
      damping: 20,
      stiffness: 180,
      mass: 0.9,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, startH]);

  const snapTo = (h: number) => {
    Animated.spring(sheetH, {
      toValue: h,
      useNativeDriver: false,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
    }).start();
  };

  // Drag
  const dragY = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_e, g) => {
        dragY.current = g.dy;
        const next = Math.max(120, Math.min(winH - insets.top, startH - g.dy));
        sheetH.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        // cerrar si arrastra mucho hacia abajo
        if (g.dy > DRAG_DISMISS_THRESHOLD) {
          onClose();
          return;
        }
        // snap al más cercano
        const current = startH - g.dy;
        const targets = [snaps.peek, snaps.half, snaps.full];
        const nearest = targets.reduce((a, b) =>
          Math.abs(b - current) < Math.abs(a - current) ? b : a,
        );
        snapTo(nearest);
      },
    }),
  ).current;

  // Lista
  const renderItem: ListRenderItem<CommentItem> = ({ item }) => (
    <View style={styles.row}>
      <View style={styles.avatar} />
      <View style={styles.bubble}>
        <Text variant="labelLarge" style={styles.name}>
          {item.author}
        </Text>
        <Text variant="bodyMedium">{item.text}</Text>
      </View>
    </View>
  );

  const [text, setText] = useState('');
  const send = async () => {
    const t = text.trim();
    if (!t) return;
    try {
      await onSend?.(t);
    } finally {
      setText('');
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={[
          styles.modalBackdrop,
          { paddingTop: insets.top, paddingBottom: 0 },
        ]}
      >
        {/* Fondo semitransparente */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* solo color */}
        </View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH,
              backgroundColor: theme.colors.surface,
              borderTopColor: 'rgba(0,0,0,0.1)',
            },
          ]}
          {...pan.panHandlers}
        >
          {/* Handle + Header */}
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              Comentarios
            </Text>
            <IconButton icon="close" onPress={onClose} />
          </View>
          <Divider />

          <FlatList
            data={comments as CommentItem[]}
            keyExtractor={c => c.id}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <Text style={{ opacity: 0.6 }}>Sé el primero en comentar</Text>
              </View>
            }
          />

          {/* Composer */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          >
            <Divider />
            <View
              style={[
                styles.composer,
                { paddingBottom: Math.max(insets.bottom - 8, 8) },
              ]}
            >
              <RNTextInput
                placeholder="Escribe un comentario…"
                value={text}
                onChangeText={setText}
                style={styles.input}
                placeholderTextColor={'#999'}
              />
              <IconButton
                icon="send"
                onPress={send}
                disabled={!text.trim()}
                accessibilityLabel="Enviar comentario"
              />
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 6, paddingBottom: 2 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', paddingVertical: 8, gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ddd' },
  bubble: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  name: { marginBottom: 2, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});

export default CommentsSheet;
