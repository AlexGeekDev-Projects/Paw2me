// src/components/comments/AnimalCommentsDrawer.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  TextInput as RNTextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  Modal as RNModal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  IconButton,
  TextInput,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import type { ListRenderItem } from 'react-native';
import type { CommentDoc } from '@models/comment';
import { useAnimalComments } from '@hooks/useAnimalComments';
import { useUserLite } from '@hooks/useUserLite';

const defaultAvatar = require('@assets/images/user.png') as number;

type Props = Readonly<{
  visible: boolean;
  animalId: string;
  userId: string | null;
  onClose?: () => void;
  onDismiss?: () => void;
}>;

const CommentItem: React.FC<Readonly<{ c: CommentDoc }>> = ({ c }) => {
  // 🔹 Usa el hook que ya normaliza {displayName|name} y varias keys de foto
  const { name, photoURL } = useUserLite(c.authorUid);
  const hasPhoto = typeof photoURL === 'string' && photoURL.length > 4;

  return (
    <View style={styles.row}>
      {hasPhoto ? (
        <Image source={{ uri: photoURL! }} style={styles.avatarImg} />
      ) : (
        <Image source={defaultAvatar} style={styles.avatarImg} />
      )}
      <View style={styles.bubble}>
        <Text variant="labelMedium" style={styles.name}>
          {name}
        </Text>
        <Text variant="bodyMedium">{c.content}</Text>
      </View>
    </View>
  );
};

const AnimalCommentsDrawer: React.FC<Props> = ({
  visible,
  animalId,
  userId,
  onClose,
  onDismiss,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<CommentDoc>>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<RNTextInput>(null);

  const { items, loading, sending, add } = useAnimalComments(animalId, userId, {
    onFirstLoad: () => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: false });
      });
    },
  });

  const safeDismiss = onDismiss || onClose || (() => {});
  const close = () => safeDismiss();

  const scrollToBottom = useCallback(() => {
    const anyList = listRef.current as unknown as {
      scrollToEnd?: (o: { animated: boolean }) => void;
      scrollToOffset?: (o: { offset: number; animated: boolean }) => void;
    } | null;
    if (anyList?.scrollToEnd) {
      anyList.scrollToEnd({ animated: true });
    } else {
      anyList?.scrollToOffset?.({
        offset: Number.MAX_SAFE_INTEGER,
        animated: true,
      });
    }
  }, []);

  const send = useCallback(async () => {
    const v = text.trim();
    if (!v || !userId || sending) return;
    try {
      await add(v); // RT hará que aparezca de inmediato
      setText('');
      requestAnimationFrame(scrollToBottom);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (e) {
      console.warn('add comment error', e);
    }
  }, [text, userId, sending, add, scrollToBottom]);

  const renderItem: ListRenderItem<CommentDoc> = ({ item }) => (
    <CommentItem c={item} />
  );

  const listData = useMemo(() => items, [items]);

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={close}
    >
      {/* Backdrop */}
      <View style={styles.backdrop} />

      {/* Sheet (idéntico al feed) */}
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.sheetWrap}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              paddingBottom: insets.bottom + 6,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.headerTitle}>
              Comentarios
            </Text>
            <IconButton icon="close" onPress={close} />
          </View>

          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            ) : listData.length === 0 ? (
              <View style={styles.center}>
                <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                  Sé el primero en comentar
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ opacity: 0.6, marginTop: 4 }}
                >
                  Comparte algo amable ✨
                </Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={listData}
                keyExtractor={c => c.id}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() =>
                  requestAnimationFrame(scrollToBottom)
                }
                ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          <View
            style={[
              styles.composerWrap,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <TextInput
              ref={inputRef}
              mode="outlined"
              dense
              placeholder={
                userId
                  ? 'Escribe un comentario…'
                  : 'Inicia sesión para comentar'
              }
              value={text}
              onChangeText={setText}
              editable={!!userId && !sending}
              returnKeyType="send"
              onSubmitEditing={send}
              style={{ flex: 1 }}
            />
            <IconButton
              icon="send"
              onPress={send}
              disabled={!userId || sending || !text.trim()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.18)',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  listContent: { paddingTop: 8, paddingBottom: 6, paddingHorizontal: 12 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },

  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  avatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e7e7e7',
  },
  bubble: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  name: { fontWeight: '700', marginBottom: 2 },

  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

export default AnimalCommentsDrawer;
