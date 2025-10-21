// src/screens/Post/CreatePostScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import Video from 'react-native-video';
import {
  TextInput,
  Button,
  HelperText,
  Chip,
  Text,
  IconButton,
  Snackbar,
  Portal,
  Dialog,
  List,
  Divider,
  ProgressBar,
  Card,
} from 'react-native-paper';

import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

import Screen from '@components/layout/Screen';
import PageHeader from '@components/layout/PageHeader';
import Loading from '@components/feedback/Loading';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { FeedStackParamList } from '@navigation/RootNavigator';

import { getAuth } from '@services/firebase';
import { listMyAnimals, type MyAnimalItem } from '@services/animalsService';
import {
  createPost,
  updatePostPartial,
  newPostId,
} from '@services/postsService';

import {
  putPostImage,
  putPostVideo,
  type ImgContentType,
  type VidContentType,
} from '@services/postsStorageService';

// ————————————————————————————————————————————————
// Picker config (mixto) — siguiendo tu guía
// ————————————————————————————————————————————————
const pickerMixed: ImageLibraryOptions = {
  selectionLimit: 0,
  mediaType: 'mixed',
  includeBase64: true,
  includeExtra: true,
  quality: 0.9,
};

// ————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————
const hasUri = (a: Asset): a is Asset & { uri: string } =>
  typeof a.uri === 'string' && a.uri.length > 0;
const hasBase64 = (a: Asset): a is Asset & { base64: string } =>
  typeof a.base64 === 'string' && a.base64.length > 0;

const notEmpty = <T,>(v: T | null | undefined): v is T => v != null;

const MAX_IMAGES = 4;
const MAX_VIDEOS = 1;

const imgCT = (name?: string): ImgContentType => {
  const n = (name ?? '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
};
const vidCT = (name?: string): VidContentType => {
  const n = (name ?? '').toLowerCase();
  if (n.endsWith('.mov')) return 'video/quicktime';
  if (n.endsWith('.webm')) return 'video/webm';
  if (n.endsWith('.3gp')) return 'video/3gpp';
  return 'video/mp4';
};

// Tipos de upload explícitos para TS
type ImgUpload = Parameters<typeof putPostImage>[0];
type VidUpload = Readonly<{
  postId: string;
  fileName: string;
  localUri: string;
  contentType?: VidContentType;
}>;

type Props = NativeStackScreenProps<FeedStackParamList, 'CreatePost'>;

export default function CreatePostScreen({ navigation, route }: Props) {
  // Core
  const [content, setContent] = useState('');
  const [images, setImages] = useState<Asset[]>([]);
  const [videos, setVideos] = useState<Asset[]>([]);
  const [myAnimals, setMyAnimals] = useState<MyAnimalItem[]>([]);
  const [animal, setAnimal] = useState<MyAnimalItem | null>(null);

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({
    visible: false,
    msg: '',
  });
  const [pickAnimalOpen, setPickAnimalOpen] = useState(false);

  // ——— Validaciones
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!getAuth().currentUser?.uid) e.push('Debes iniciar sesión.');
    if (!content.trim()) e.push('Escribe algo para tu actualización.');
    return e;
  }, [content]);

  // ——— Cargar huellitas del usuario al abrir el diálogo
  const loadMyAnimals = useCallback(async () => {
    const uid = getAuth().currentUser?.uid ?? '';
    if (!uid) {
      setMyAnimals([]);
      return;
    }
    const list = await listMyAnimals(uid);
    setMyAnimals(list);
    if (animal && !list.find(a => a.id === animal.id)) setAnimal(null);
  }, [animal]);

  // ——— Selector mixto (fotos + videos), con rutas file:// para videos
  const pickMixed = useCallback(async () => {
    const res = await launchImageLibrary(pickerMixed);
    const assets = (res.assets ?? []) as Asset[];
    if (assets.length === 0) return;

    const imgs: Asset[] = [];
    const vids: Asset[] = [];

    // cupos restantes
    const imgCap = Math.max(0, MAX_IMAGES - images.length);
    const vidCap = Math.max(0, MAX_VIDEOS - videos.length);

    let ignoredImgs = 0;
    let ignoredVids = 0;

    for (const a of assets) {
      const mime = (a.type ?? '').toLowerCase();
      const uri = a.uri ?? '';
      const scheme = uri.split(':')[0]?.toLowerCase() ?? '';

      if (mime.startsWith('image/')) {
        if (imgs.length >= imgCap) {
          ignoredImgs++;
          continue;
        }
        if (scheme === 'ph' && !hasBase64(a)) {
          ignoredImgs++;
          continue;
        } // iOS PH sin base64
        imgs.push(a);
        continue;
      }

      if (mime.startsWith('video/')) {
        if (vids.length >= vidCap) {
          ignoredVids++;
          continue;
        }
        const fileCopyUri = (a as any).fileCopyUri as string | undefined;
        const originalPath = (a as any).originalPath as string | undefined;
        if (fileCopyUri?.startsWith('file://')) {
          a.uri = fileCopyUri;
        } else if (originalPath) {
          a.uri = originalPath.startsWith('file://')
            ? originalPath
            : `file://${originalPath}`;
        }
        vids.push(a);
      }
    }

    if (imgs.length) setImages(prev => [...prev, ...imgs]);
    if (vids.length) setVideos(prev => [...prev, ...vids]);

    if (ignoredImgs || ignoredVids) {
      const parts = [];
      if (ignoredImgs)
        parts.push(`${ignoredImgs} foto${ignoredImgs > 1 ? 's' : ''}`);
      if (ignoredVids)
        parts.push(`${ignoredVids} video${ignoredVids > 1 ? 's' : ''}`);
      setSnack({
        visible: true,
        msg: `Límite alcanzado: se omitieron ${parts.join(' y ')}`,
      });
    }
  }, [images.length, videos.length]);

  // ——— Eliminar media
  const removeImage = useCallback(
    (uri: string) => setImages(prev => prev.filter(a => a.uri !== uri)),
    [],
  );
  const removeVideo = useCallback(
    (uri: string) => setVideos(prev => prev.filter(a => a.uri !== uri)),
    [],
  );

  // ——— Submit (con progreso estilo CreateAnimalScreen)
  const onSubmit = useCallback(async () => {
    if (errors.length > 0) return;

    setSubmitting(true);
    setProgress(0);

    const uid = getAuth().currentUser!.uid;
    const postId = newPostId();

    // Normalizamos uploads (SÓLO con type guard para evitar null)
    const imgUploads: ImgUpload[] = images
      .map((a, i) => {
        const ct = imgCT(a.fileName);
        const ext =
          ct === 'image/png'
            ? 'png'
            : ct === 'image/webp'
              ? 'webp'
              : ct === 'image/heic' || ct === 'image/heif'
                ? 'heic'
                : 'jpg';

        if (hasBase64(a))
          return {
            kind: 'base64' as const,
            postId,
            fileName: `img-${i + 1}.${ext}`,
            base64: a.base64!,
            contentType: ct,
          };
        if (hasUri(a))
          return {
            kind: 'local' as const,
            postId,
            fileName: `img-${i + 1}.${ext}`,
            localUri: a.uri!,
            contentType: ct,
          };
        return null;
      })
      .filter(notEmpty);

    const vidUploads: VidUpload[] = videos
      .map((a, i) => {
        if (!hasUri(a)) return null;
        const ct = vidCT(a.fileName);
        const ext =
          ct === 'video/quicktime'
            ? 'mov'
            : ct === 'video/webm'
              ? 'webm'
              : ct === 'video/3gpp'
                ? '3gp'
                : 'mp4';
        return {
          postId,
          fileName: `vid-${i + 1}.${ext}`,
          localUri: a.uri!,
          contentType: ct,
        };
      })
      .filter(notEmpty);

    const total = imgUploads.length + vidUploads.length;
    let done = 0;
    const tick = () => setProgress(total > 0 ? done / total : 0);

    try {
      await createPost(postId, {
        authorUid: uid,
        content: content.trim(),
        status: 'active',
        ...(animal ? { animalId: animal.id } : {}),
        imageUrls: [],
        videoUrls: [],
      });

      const imageUrls: string[] = [];
      for (const u of imgUploads) {
        try {
          const url = await putPostImage(u);
          imageUrls.push(url);
        } finally {
          done += 1;
          tick();
        }
      }
      if (imageUrls.length) await updatePostPartial(postId, { imageUrls });

      const videoUrls: string[] = [];
      for (const v of vidUploads) {
        try {
          const url = await putPostVideo(v);
          videoUrls.push(url);
        } finally {
          done += 1;
          tick();
        }
      }
      if (videoUrls.length) await updatePostPartial(postId, { videoUrls });

      setSnack({ visible: true, msg: 'Publicado con éxito' });
      // TODO: navegación de vuelta o limpiar formulario
      setContent('');
      setImages([]);
      setVideos([]);
      setAnimal(null);
      navigation.navigate('Feed'); // <- tipado si CreatePost vive en FeedStack
      // Alternativa robusta:
      navigation.popToTop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[CreatePost] fatal:', msg);
      setSnack({ visible: true, msg });
    } finally {
      setSubmitting(false);
    }
  }, [errors.length, images, videos, content, animal]);

  const disabled = submitting || errors.length > 0;

  // ————————————————————————————————————————————————
  // UI
  // ————————————————————————————————————————————————
  return (
    <Screen style={styles.container}>
      <PageHeader
        title="Nueva actualización"
        subtitle="Comparte fotos o videos de tu huellita"
      />

      {/* Progreso como en CreateAnimal */}
      {submitting ? (
        <View style={styles.progressWrap}>
          <ProgressBar progress={progress} style={styles.progress} />
          <Text variant="bodySmall" style={styles.progressText}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Huellita */}
        <View style={styles.row}>
          <Chip
            icon="paw"
            onPress={() => {
              setPickAnimalOpen(true);
              void loadMyAnimals();
            }}
          >
            Elegir huellita…
          </Chip>
          {animal ? (
            <Chip
              selected
              onClose={() => setAnimal(null)}
              compact
              style={styles.animalChip}
            >
              {animal.name}
            </Chip>
          ) : null}
        </View>

        {/* Contenido */}
        <TextInput
          label="¿Qué está pasando?"
          value={content}
          onChangeText={setContent}
          multiline
          mode="outlined"
          style={styles.input}
          right={<TextInput.Affix text={`${content.length}/800`} />}
          maxLength={800}
        />
        <Text variant="bodySmall" style={styles.helperNote}>
          Consejito: mensajes breves + una buena portada generan más
          interacción.
        </Text>

        {/* Media */}
        <View style={[styles.mediaRow, { padding: 8 }]}>
          <Button
            mode="outlined"
            icon="image-multiple-outline"
            onPress={pickMixed}
            disabled={
              images.length >= MAX_IMAGES && videos.length >= MAX_VIDEOS
            }
          >
            Añadir fotos o videos…
          </Button>
        </View>

        <Text variant="bodySmall" style={styles.counterText}>
          Fotos {images.length}/{MAX_IMAGES} · Video {videos.length}/
          {MAX_VIDEOS}
        </Text>

        {/* Previews en estilo grid */}
        {(images.length > 0 || videos.length > 0) && (
          <Card mode="contained" style={styles.previewCard}>
            <Card.Content>
              <View style={styles.previewGrid}>
                {images.map(a =>
                  hasUri(a) ? (
                    <View key={`img-${a.uri}`} style={styles.tile}>
                      <Image source={{ uri: a.uri }} style={styles.tileImg} />
                      <IconButton
                        icon="close"
                        size={16}
                        onPress={() => removeImage(a.uri!)}
                        style={styles.tileDel}
                        containerColor="rgba(0,0,0,0.45)"
                        iconColor="#fff"
                        accessibilityLabel="Eliminar imagen"
                      />
                    </View>
                  ) : null,
                )}

                {videos.map(a =>
                  hasUri(a) ? (
                    <View key={`vid-${a.uri}`} style={styles.tile}>
                      <Video
                        source={{ uri: a.uri }}
                        style={styles.tileVid}
                        paused
                        repeat={false}
                        muted
                        resizeMode="cover"
                      />
                      <Pressable style={styles.tilePlay}>
                        <IconButton icon="play" size={18} disabled />
                      </Pressable>
                      <IconButton
                        icon="close"
                        size={16}
                        onPress={() => removeVideo(a.uri!)}
                        style={styles.tileDel}
                        containerColor="rgba(0,0,0,0.45)"
                        iconColor="#fff"
                        accessibilityLabel="Eliminar video"
                      />
                      <Text numberOfLines={1} style={styles.vidName}>
                        {(a.fileName ?? 'video').split('/').pop()}
                      </Text>
                    </View>
                  ) : null,
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Errores */}
        {errors.length > 0 ? (
          <HelperText type="error" visible style={{ marginTop: 6 }}>
            {errors.join('  •  ')}
          </HelperText>
        ) : (
          <View style={{ height: 6 }} />
        )}

        <Divider style={{ marginVertical: 8, opacity: 0.6 }} />

        {/* CTA */}
        <Button
          mode="contained"
          onPress={onSubmit}
          disabled={disabled}
          style={styles.cta}
          contentStyle={{ paddingVertical: 10 }}
          icon="check-circle"
        >
          Publicar
        </Button>
      </ScrollView>

      {/* Loading fullscreen como en CreateAnimal */}
      {submitting ? (
        <Loading
          variant="fullscreen"
          progress={progress}
          message="Publicando…"
        />
      ) : null}

      {/* Diálogo para elegir huellita */}
      <Portal>
        <Dialog
          visible={pickAnimalOpen}
          onDismiss={() => setPickAnimalOpen(false)}
        >
          <Dialog.Title>Elegir huellita</Dialog.Title>
          <Dialog.Content>
            {myAnimals.length === 0 ? (
              <Text variant="bodyMedium">No tienes huellitas activas.</Text>
            ) : (
              myAnimals.map(a => (
                <List.Item
                  key={a.id}
                  title={a.name}
                  left={p => <List.Icon {...p} icon="paw" />}
                  onPress={() => setAnimal(a)}
                  right={p =>
                    animal?.id === a.id ? (
                      <List.Icon {...p} icon="check" />
                    ) : null
                  }
                />
              ))
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPickAnimalOpen(false)}>Cerrar</Button>
            <Button onPress={() => setPickAnimalOpen(false)} disabled={!animal}>
              Usar selección
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: '' })}
        duration={2500}
      >
        {snack.msg}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  progressWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progress: { flex: 1, height: 6, borderRadius: 999 },
  progressText: { opacity: 0.7 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { marginTop: 8, backgroundColor: 'transparent' },

  helperNote: { marginTop: 6, opacity: 0.7 },

  mediaRow: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.18)',
  },

  previewCard: { marginTop: 12, borderRadius: 12 },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: Platform.OS === 'web' ? 140 : 110,
    alignItems: 'center',
    position: 'relative',
  },
  tileImg: {
    width: '100%',
    height: Platform.select({ ios: 110, android: 110, default: 130 }) as number,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#bbb',
  },
  tileVid: {
    width: '100%',
    height: Platform.select({ ios: 110, android: 110, default: 130 }) as number,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  tileDel: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 2,
  },
  tilePlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 18,
  },
  vidName: { marginTop: 4, fontSize: 12, maxWidth: 120, opacity: 0.8 },

  cta: { marginTop: 12, borderRadius: 14 },

  animalChip: { marginLeft: 6, borderRadius: 16 },
  counterText: { marginTop: 6, opacity: 0.7, alignSelf: 'flex-start' },
});
