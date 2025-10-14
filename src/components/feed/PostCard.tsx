import React, { useMemo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Card, Text, IconButton } from 'react-native-paper';
import type { PostCardVM } from '@models/post';

interface Props {
  data: PostCardVM;
  onToggleReact: (postId: string, nextState: boolean) => void;
  onShare?: (postId: string) => void;
}

const PostCard: React.FC<Props> = ({ data, onToggleReact, onShare }) => {
  const likeIcon = data.reactedByMe ? 'heart' : 'heart-outline';
  const imageGrid = useMemo(
    () => (data.imageUrls ?? []).slice(0, 4),
    [data.imageUrls],
  );

  return (
    <Card style={styles.card} mode="contained">
      {imageGrid.length > 0 ? (
        <View style={styles.grid}>
          {imageGrid.map(u => (
            <Image key={u} source={{ uri: u }} style={styles.img} />
          ))}
        </View>
      ) : null}
      <Card.Content style={{ gap: 10 }}>
        <Text variant="bodyMedium">{data.content}</Text>
        <View style={styles.row}>
          <IconButton
            icon={likeIcon}
            onPress={() => onToggleReact(data.id, !data.reactedByMe)}
            accessibilityLabel="Reaccionar"
          />
          <Text>{data.reactionCount}</Text>
          <IconButton icon="share-variant" onPress={() => onShare?.(data.id)} />
          <Text>{data.shareCount}</Text>
        </View>
        <Text variant="labelSmall">
          {new Date(data.createdAt).toLocaleString()}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginVertical: 8, borderRadius: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  img: { width: '48%', aspectRatio: 1, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

export default PostCard;
