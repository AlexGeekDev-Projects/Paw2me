import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Card, Text, Button, useTheme, Chip } from 'react-native-paper';
import type { Animal } from '@models/animal';
import type { Post } from '@models/post';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = {
  animal: Animal;
  post: Post;
  onOpen: (animalId: string) => void;
  onShare?: (animal: Animal) => void;
};

const PostCard: React.FC<Props> = ({ animal, post, onOpen, onShare }) => {
  const theme = useTheme();
  const img = animal.media.images[0];

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title
        title={`${animal.name} · ${animal.breed ?? 'mestizo'}`}
        subtitle={`${animal.location.city ?? ''}${animal.location.city ? ' · ' : ''}${animal.location.state ?? ''}`}
        left={props => (
          <Icon {...props} name="paw" color={theme.colors.primary} />
        )}
      />
      {img ? (
        <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
      ) : null}
      <Card.Content>
        <View style={styles.row}>
          <Chip compact>{animal.size}</Chip>
          <View style={styles.spacer} />
          <Chip compact>{animal.ageLabel ?? 'adulto'}</Chip>
          <View style={styles.spacer} />
          <Chip compact>
            {animal.status === 'urgent' ? 'URGENTE' : 'En adopción'}
          </Chip>
        </View>
        {post.caption ? (
          <Text style={styles.caption}>{post.caption}</Text>
        ) : null}
      </Card.Content>
      <Card.Actions>
        <Button icon="eye-outline" onPress={() => onOpen(animal.id)}>
          Ver perfil
        </Button>
        <Button icon="share-variant" onPress={() => onShare?.(animal)}>
          Compartir
        </Button>
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  image: { width: '100%', height: 220, backgroundColor: '#0002' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  spacer: { width: 8 },
  caption: { marginTop: 8 },
});
export default PostCard;
