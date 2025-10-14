// src/screens/Feed/CreatePostScreen.tsx
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { View, ScrollView, Image, StyleSheet } from 'react-native';
import {
  Appbar,
  TextInput,
  Button,
  HelperText,
  Dialog,
  Portal,
  List,
  Chip,
  Text,
} from 'react-native-paper';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import { getAuth } from '@services/firebase';
import { listMyAnimals, type MyAnimalItem } from '@services/animalsService';
import { createPost, putPostImage } from '@services/postsService';
import Loading from '@components/feedback/Loading';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePost'>;

const imgPickerOpts: ImageLibraryOptions = {
  selectionLimit: 0,
  mediaType: 'photo',
  includeBase64: false,
  quality: 0.9,
};

const hasUri = (a: Asset): a is Asset & { uri: string } =>
  typeof a.uri === 'string' && a.uri.length > 0;

const CreatePostScreen: React.FC<Props> = ({ navigation, route }) => {
  const uid = getAuth().currentUser?.uid ?? 'dev';
  const presetAnimalId: string | undefined = route.params?.animalId;

  const [myAnimals, setMyAnimals] = useState<MyAnimalItem[]>([]);
  const [animal, setAnimal] = useState<MyAnimalItem | null>(null);

  const [content, setContent] = useState<string>('');
  const [gallery, setGallery] = useState<Asset[]>([]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const list = await listMyAnimals(uid);
      setMyAnimals(list);
      if (presetAnimalId) {
        const found = list.find(a => a.id === presetAnimalId) ?? null;
        setAnimal(found);
      }
    })();
  }, [uid, presetAnimalId]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!animal) e.push('Selecciona un animal.');
    if (!content.trim()) e.push('Escribe algo para tu actualización.');
    return e;
  }, [animal, content]);

  const openPicker = useCallback(async () => {
    const res = await launchImageLibrary(imgPickerOpts);
    const assets = (res.assets ?? []) as Asset[];
    if (assets.length > 0) {
      setGallery(prev => [...prev, ...assets.filter(Boolean)]);
    }
  }, []);

  const onSubmit = useCallback(async () => {
    if (errors.length > 0 || !animal) return;
    setSubmitting(true);
    setProgress(0);

    const postId = `${uid}_${Date.now()}`;

    try {
      const valid = gallery.filter(hasUri);
      const urls: string[] = [];
      const total = valid.length;
      let done = 0;
      const updateP = () => setProgress(total > 0 ? done / total : 0);

      for (const [i, a] of valid.entries()) {
        const fileName = `img-${i + 1}.jpg`;
        const url = await putPostImage(postId, a.uri, fileName);
        urls.push(url);
        done += 1;
        updateP();
      }

      const base = {
        animalId: animal.id,
        authorUid: uid,
        content: content.trim(),
        status: 'active' as const,
      };

      const input = urls.length > 0 ? { ...base, imageUrls: urls } : base;

      await createPost(postId, input);

      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  }, [errors.length, animal, uid, content, gallery, navigation]);

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Nueva actualización" />
      </Appbar.Header>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ padding: 12 }}
      >
        <Text variant="labelMedium" style={{ marginBottom: 6 }}>
          Animal
        </Text>
        <View style={styles.row}>
          {animal ? (
            <Chip
              mode="outlined"
              onClose={() => setAnimal(null)}
              onPress={() => setDialogOpen(true)}
            >
              {animal.name}
            </Chip>
          ) : (
            <Button mode="outlined" onPress={() => setDialogOpen(true)}>
              Seleccionar…
            </Button>
          )}
        </View>

        <TextInput
          label="¿Qué está pasando?"
          value={content}
          onChangeText={setContent}
          multiline
          style={styles.input}
        />

        <View style={styles.mediaRow}>
          <Button mode="outlined" onPress={openPicker}>
            Añadir fotos…
          </Button>
          <View style={styles.previewRow}>
            {gallery
              .slice(0, 4)
              .map((a: Asset, i: number) =>
                hasUri(a) ? (
                  <Image
                    key={`${i}-${a.uri}`}
                    source={{ uri: a.uri }}
                    style={styles.thumb}
                  />
                ) : null,
              )}
            {gallery.length > 4 ? (
              <Text variant="bodySmall">+{gallery.length - 4}</Text>
            ) : null}
          </View>
        </View>

        {errors.length > 0 ? (
          <HelperText type="error" visible>
            {errors.join('  •  ')}
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          onPress={onSubmit}
          disabled={submitting || errors.length > 0}
          style={{ marginVertical: 12 }}
        >
          Publicar
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
          <Dialog.Title>Elige un animal</Dialog.Title>
          <Dialog.Content>
            {myAnimals.length === 0 ? (
              <Text variant="bodyMedium">
                No tienes animalitos cargados aún.
              </Text>
            ) : (
              myAnimals.map((a: MyAnimalItem) => (
                <List.Item
                  key={a.id}
                  title={a.name}
                  onPress={() => {
                    setAnimal(a);
                    setDialogOpen(false);
                  }}
                  left={props => <List.Icon {...props} icon="paw" />}
                />
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {submitting ? (
        <Loading
          variant="fullscreen"
          progress={progress}
          message="Publicando…"
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  input: { marginVertical: 8 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
});

export default CreatePostScreen;
