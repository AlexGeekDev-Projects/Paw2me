// src/components/comments/CommentItem.tsx
import React, { memo, useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import type { CommentDoc } from '@models/comment';
import {
  doc,
  getDoc,
  getFirestore,
  type FirebaseFirestoreTypes,
} from '@services/firebase';

type UserLight = Readonly<{
  uid: string;
  fullName?: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
}>;
const userRef = (uid: string) =>
  doc(
    getFirestore(),
    'users',
    uid,
  ) as FirebaseFirestoreTypes.DocumentReference<UserLight>;

const nameOf = (u?: UserLight | null): string =>
  (u?.fullName && u.fullName.trim()) ||
  (u?.displayName && u.displayName.trim()) ||
  (u?.username && u.username.trim()) ||
  'Usuario';

type Props = Readonly<{
  data: CommentDoc;
  canEdit?: boolean;
  onEdit?: (c: CommentDoc) => void;
  onDelete?: (c: CommentDoc) => void;
}>;

const CommentItem: React.FC<Props> = ({
  data,
  canEdit = false,
  onEdit,
  onDelete,
}) => {
  const [author, setAuthor] = useState<UserLight | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(userRef(data.authorUid));
        if (alive) setAuthor(snap.exists() ? (snap.data() as UserLight) : null);
      } catch {
        if (alive) setAuthor(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [data.authorUid]);

  return (
    <View style={styles.row}>
      <Image
        source={
          author?.photoURL
            ? { uri: author.photoURL }
            : require('@assets/images/user.png')
        }
        style={styles.avatar}
      />
      <View style={{ flex: 1 }}>
        <Text variant="labelLarge" style={styles.name}>
          {nameOf(author)}
        </Text>
        <Text variant="bodyMedium">{data.content}</Text>
      </View>
      {canEdit ? (
        <View style={styles.actions}>
          <IconButton size={18} icon="pencil" onPress={() => onEdit?.(data)} />
          <IconButton
            size={18}
            icon="delete"
            onPress={() => onDelete?.(data)}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#ddd',
  },
  name: { fontWeight: '700', marginBottom: 2 },
  actions: { flexDirection: 'row', marginLeft: 4 },
});

export default memo(CommentItem);
