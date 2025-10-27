// src/components/comments/CommentsSheet.tsx
import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal as RNModal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import type { ListRenderItem } from 'react-native';

import { useComments } from '@hooks/comments/useComments';
import type { CommentDoc } from '@models/comment';
import { getAuth } from '@services/firebase';

import CommentItem from './CommentItem';
import CommentComposer from './CommentComposer';

type Props = Readonly<{
  visible: boolean;
  postId: string;
  onDismiss: () => void;
}>;

const CommentsSheet: React.FC<Props> = ({ visible, postId, onDismiss }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const auth = getAuth();
  const uid = auth.currentUser?.uid ?? null;
  const mePhoto = auth.currentUser?.photoURL ?? null;

  const { comments, loading, error, add, edit, remove } = useComments(
    postId,
    uid,
    visible && !!postId,
  );

  const send = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    await add({ content: value });
  };

  const renderItem: ListRenderItem<CommentDoc> = ({ item }) => (
    <CommentItem
      data={item}
      canEdit={uid === item.authorUid}
      onEdit={c => {
        // aquí podrías abrir un modal de edición si quieres
        // por ahora, solo como ejemplo rápido: conservar contenido actual
        void edit(c.id, c.content);
      }}
      onDelete={c => void remove(c.id)}
    />
  );

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onDismiss}
    >
      {/* Backdrop */}
      <View style={styles.backdrop} />

      {/* Sheet */}
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
          {/* Handle + Header */}
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              Comentarios
            </Text>
            <IconButton
              icon="close"
              onPress={onDismiss}
              accessibilityLabel="Cerrar comentarios"
            />
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text variant="bodyMedium" style={{ opacity: 0.75 }}>
                {error}
              </Text>
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                Sé el primero en comentar
              </Text>
              <Text variant="bodyMedium" style={{ opacity: 0.6, marginTop: 4 }}>
                Comparte algo amable ✨
              </Text>
            </View>
          ) : (
            <FlatList
              data={comments as readonly CommentDoc[]}
              keyExtractor={c => c.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Composer — estilizado + avatar por defecto */}
          <View style={styles.composerWrap}>
            <CommentComposer
              disabled={!uid}
              onSubmit={send}
              avatarURL={mePhoto}
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
  title: { flex: 1, marginLeft: 8, fontWeight: '800', letterSpacing: 0.2 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  empty: { alignItems: 'center', paddingVertical: 36 },
  listContent: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'transparent',
  },
});

export default CommentsSheet;
