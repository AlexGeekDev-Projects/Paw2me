import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

type Props = Readonly<{
  postId: string;
  reactedByMe: boolean;
  reactionCount: number;
  onToggle: (postId: string, next: boolean) => void;
}>;

const PostFooter: React.FC<Props> = ({
  postId,
  reactedByMe,
  reactionCount,
  onToggle,
}) => {
  return (
    <View style={styles.row}>
      <IconButton
        icon={reactedByMe ? 'heart' : 'heart-outline'}
        onPress={() => onToggle(postId, !reactedByMe)}
        size={22}
      />
      <Text style={styles.count}>{reactionCount}</Text>
      {/* hooks futuros: comentarios, compartir */}
      {/* <IconButton icon="comment-outline" onPress={...} size={22} /> */}
      {/* <IconButton icon="share-outline" onPress={...} size={22} /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  count: { marginLeft: -8, opacity: 0.7 },
});

export default PostFooter;
