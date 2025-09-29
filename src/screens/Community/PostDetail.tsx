import React, { useEffect, useState } from 'react';
import Screen from '@components/layout/Screen';
import {
  Text,
  Card,
  Divider,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/types';
import { getPostById, deleteMyPost } from '@services/communityService';
import type { Post } from '@models/community';

type R = RouteProp<RootStackParamList, 'PostDetail'>;

const PostDetail: React.FC = () => {
  const route = useRoute<R>();
  const nav = useNavigation();
  const { postId } = route.params;

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await getPostById(postId);
      if (!cancelled) {
        setPost(p);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando publicación…</Text>
      </Screen>
    );
  }

  if (!post) {
    return (
      <Screen>
        <Text variant="titleMedium">Publicación no encontrada</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Card.Title title={post.authorName ?? 'Usuario'} subtitle={post.id} />
        <Card.Content>
          {post.text ? <Text>{post.text}</Text> : <Text>Sin texto.</Text>}
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => nav.goBack()}>Volver</Button>
          <Button
            icon="delete"
            onPress={async () => {
              await deleteMyPost(post.id);
              nav.goBack();
            }}
          >
            Eliminar
          </Button>
        </Card.Actions>
      </Card>
      <Divider style={{ marginVertical: 16 }} />
      <Text variant="titleMedium">Comentarios</Text>
      <Text style={{ opacity: 0.7, marginTop: 6 }}>
        (Pendiente: lista de comentarios)
      </Text>
    </Screen>
  );
};

export default PostDetail;
