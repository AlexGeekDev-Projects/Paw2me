import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal as RNModal,
  Keyboard,
  TextInput as RNTextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import type { ListRenderItem } from 'react-native';

import type { CommentDoc } from '@models/comment';
import { useAnimalComments } from '@hooks/useAnimalComments';
import { getApp, getAuth } from '@services/firebase';
import { emitAnimalCommentAdded } from '@utils/commentsEvents';

import CommentItem from './CommentItem';
import CommentComposer from './CommentComposer';

type Props = Readonly<{
  visible: boolean;
  pawId: string;
  onDismiss: () => void;
}>;

const CommentsSheetPaw: React.FC<Props> = ({ visible, pawId, onDismiss }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const app = getApp();
  const auth = getAuth(app);
  const uid = auth.currentUser?.uid ?? null;
  const mePhoto = auth.currentUser?.photoURL ?? null;

  const listRef = useRef<FlatList<CommentDoc>>(null);
  const inputRef = useRef<RNTextInput>(null);

  const {
    items: comments,
    loading,
    error,
    add,
    edit,
    remove,
  } = useAnimalComments(pawId, uid, { enabled: visible && !!pawId });

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

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(scrollToBottom);
  }, [visible, scrollToBottom]);

  const onSizeChange = useCallback(() => {
    if (!visible) return;
    requestAnimationFrame(scrollToBottom);
  }, [visible, scrollToBottom]);

  useEffect(() => {
    if (!visible) return;
    const showEvt = Platform.select({
      ios: 'keyboardWillShow',
      android: 'keyboardDidShow',
      default: 'keyboardDidShow',
    }) as any;
    const sub = Keyboard.addListener(showEvt, () => {
      requestAnimationFrame(scrollToBottom);
    });
    return () => sub.remove();
  }, [visible, scrollToBottom]);

  const send = useCallback(
    async (text: string) => {
      const value = (text ?? '').trim();
      if (!value || !uid) return;

      emitAnimalCommentAdded({ pawId, delta: 1 });
      try {
        await add(value); // useAnimalComments: string
        requestAnimationFrame(scrollToBottom);
      } catch (e) {
        emitAnimalCommentAdded({ pawId, delta: -1 });
        if (__DEV__) console.warn('[CommentsSheetPaw] add error', e);
      }
    },
    [uid, pawId, add, scrollToBottom],
  );

  const renderItem: ListRenderItem<CommentDoc> = useCallback(
    ({ item }) => (
      <CommentItem
        data={item}
        canEdit={uid === item.authorUid}
        {...(edit ? { onEdit: c => void edit(c.id, c.content) } : {})}
        {...(remove ? { onDelete: c => void remove(c.id) } : {})}
      />
    ),
    [uid, edit, remove],
  );

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop} />
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
            <Text variant="titleMedium" style={styles.title}>
              Comentarios
            </Text>
            <IconButton
              icon="close"
              onPress={onDismiss}
              accessibilityLabel="Cerrar comentarios"
            />
          </View>

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
              ref={listRef}
              data={comments as readonly CommentDoc[]}
              keyExtractor={c => c.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="always" // 👈 iOS: evita el 2-tap
              keyboardDismissMode="none" // 👈 iOS: no cerrar teclado
              ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={onSizeChange}
              removeClippedSubviews={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
            />
          )}

          <View style={styles.composerWrap}>
            <CommentComposer
              ref={inputRef}
              disabled={!uid}
              onSubmit={send}
              avatarURL={mePhoto ?? null}
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

export default CommentsSheetPaw;
