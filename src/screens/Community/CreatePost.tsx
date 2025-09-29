import React, { useState } from 'react';
import Screen from '@components/layout/Screen';
import { TextInput, Button, Text, Chip } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/types';
import type { RouteProp } from '@react-navigation/native';
import {
  createPostUsingUploaded,
  updatePostUsingUploaded,
} from '@services/communityService';
import type { PostMedia } from '@models/community';

type R = RouteProp<RootStackParamList, 'CreatePost'>;

const CreatePost: React.FC = () => {
  const nav = useNavigation();
  const route = useRoute<R>();
  const editId = route.params?.editPostId;

  const [text, setText] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<ReadonlyArray<PostMedia>>([]);

  // Placeholder: aquí iría el picker de imágenes/video; por ahora simulamos 1 imagen.
  const addMockImage = () => {
    setUploaded([
      {
        kind: 'image',
        downloadURL: 'https://placekitten.com/800/600',
        storagePath: 'posts/mock/kitten.jpg',
        contentType: 'image/jpeg',
        width: 800,
        height: 600,
        sizeBytes: 123456,
      },
    ]);
  };

  const onSave = async () => {
    if (editId) {
      await updatePostUsingUploaded({ postId: editId, text, links, uploaded });
    } else {
      await createPostUsingUploaded({ text, links, uploaded });
    }
    nav.goBack();
  };

  return (
    <Screen>
      <Text variant="headlineSmall">
        {editId ? 'Editar publicación' : 'Nueva publicación'}
      </Text>

      <TextInput
        label="Texto"
        mode="outlined"
        value={text}
        onChangeText={setText}
        multiline
        style={{ marginTop: 12 }}
      />

      <Button
        style={{ marginTop: 12 }}
        onPress={addMockImage}
        icon="image-multiple"
      >
        Añadir imagen de ejemplo
      </Button>

      <Text style={{ marginTop: 12 }}>Adjuntos: {uploaded.length}</Text>
      {uploaded.map((m, i) => (
        <Chip key={i} style={{ marginTop: 6 }}>
          {m.kind.toUpperCase()}
        </Chip>
      ))}

      <Button mode="contained" onPress={onSave} style={{ marginTop: 16 }}>
        Guardar
      </Button>
    </Screen>
  );
};

export default CreatePost;
