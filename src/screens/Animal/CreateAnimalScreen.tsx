// src/screens/Animal/CreateAnimalScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import {
  TextInput,
  Button,
  Switch,
  HelperText,
  Text,
  Chip,
  Divider,
  Card,
  List,
} from 'react-native-paper';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import { getAuth } from '@services/firebase';
import {
  createAnimal,
  newAnimalId,
  updateAnimalPartial,
} from '@services/animalsService';
import { putAnimalImage } from '@services/storageService';
import Loading from '@components/feedback/Loading';
import type { NewAnimalInput, Species } from '@models/animal';
import PageHeader from '@components/layout/PageHeader';
import SelectInput from '@components/inputs/SelectInput';
import { useBreedOptions } from '@hooks/useMetaOptions';
import LocationPicker from '@components/inputs/LocationPicker';
import type { CoordChange } from '@components/inputs/LocationPicker';
import Screen from '@components/layout/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateAnimal'>;

const speciesOptions = [
  'perro',
  'gato',
  'conejo',
  'ave',
  'reptil',
  'roedor',
  'cerdo_mini',
  'caballo',
  'otro',
] as const satisfies readonly Species[];

const sizes = ['XS', 'S', 'M', 'L', 'XL'] as const;
const sexes = ['macho', 'hembra'] as const;

/** Tipos MIME permitidos para imágenes (evita usar un tipo inexistente). */
type ImgContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

/** image-picker con base64 habilitado (por si más adelante decides usarlo). */
const imgPickerOpts: ImageLibraryOptions = {
  selectionLimit: 0,
  mediaType: 'photo',
  includeBase64: true, // Esto es clave para la solución
  quality: 0.9,
};

const hasUri = (a: Asset): a is Asset & { uri: string } =>
  typeof a.uri === 'string' && a.uri.length > 0;

// Nueva comprobación para assets con Base64
const hasBase64 = (a: Asset): a is Asset & { base64: string } =>
  typeof a.base64 === 'string' && a.base64.length > 0;

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  top?: number;
}> = ({ title, children, top = 16 }) => (
  <View style={{ marginTop: top }}>
    <Text variant="labelLarge" style={styles.sectionTitle}>
      {title}
    </Text>
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

const tagOptions = [
  'juguetón',
  'tranquilo',
  'guardían',
  'cariñoso',
  'sociable',
  'tímido',
  'curioso',
  'obediente',
  'entrenado',
  'apto para niños',
  'convive con gatos',
  'convive con perros',
  'especial',
] as const;

const CreateAnimalScreen: React.FC<Props> = ({ navigation }) => {
  // core
  const [name, setName] = useState<string>('');
  const [species, setSpecies] = useState<Species>('perro');
  const [size, setSize] = useState<(typeof sizes)[number]>('M');
  const [sex, setSex] = useState<(typeof sexes)[number]>('macho');
  const [tags, setTags] = useState<string[]>([]);

  // edad
  const [ageMonths, setAgeMonths] = useState<string>('6');
  const [ageUnknown, setAgeUnknown] = useState<boolean>(false);

  // salud
  const [mixedBreed, setMixedBreed] = useState<boolean>(true);
  const [sterilized, setSterilized] = useState<boolean>(false);
  const [vaccinated, setVaccinated] = useState<boolean>(false);

  // urgencia
  const [urgent, setUrgent] = useState<boolean>(false);

  // raza
  const { options: breedOpts, loading: loadingBreeds } =
    useBreedOptions(species);
  const [breedCode, setBreedCode] = useState<string>('mestizo');
  const onToggleMixed = (v: boolean) => {
    setMixedBreed(v);
    if (v) setBreedCode('mestizo');
  };
  const onChangeBreed = (v: string) => {
    setBreedCode(v);
    if (v !== 'mestizo') setMixedBreed(false);
  };

  // ubicación
  const [geo, setGeo] = useState<{ lat: number; lng: number } | undefined>();
  const [derivedCountry, setDerivedCountry] = useState<string | undefined>();
  const [derivedCity, setDerivedCity] = useState<string | undefined>();
  const [derivedAddress, setDerivedAddress] = useState<string | undefined>();

  // media
  const [cover, setCover] = useState<Asset | undefined>();
  const [gallery, setGallery] = useState<Asset[]>([]);

  // ui
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string | undefined>();

  const errors = useMemo(() => {
    const e: string[] = [];
    const age = Number(ageMonths);
    if (!name.trim()) e.push('El nombre es obligatorio.');
    if (!ageUnknown && (!Number.isFinite(age) || age < 0 || age > 600))
      e.push('Edad (meses) inválida.');
    if (!geo) e.push('Selecciona la ubicación en el mapa.');
    return e;
  }, [name, ageMonths, ageUnknown, geo]);

  const pickImages = useCallback(async () => {
    const res = await launchImageLibrary(imgPickerOpts);
    const assets = (res.assets ?? []) as Asset[];
    if (assets.length > 0) {
      if (!cover && assets[0]) setCover(assets[0]);
      setGallery(prev => [...prev, ...assets.filter(Boolean)]);
    }
  }, [cover]);

  const toggleTag = (t: string) =>
    setTags(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
    );

  const onSubmit = useCallback(async () => {
    if (errors.length > 0 || !geo) return;
    setSubmitting(true);
    setSubmitError(undefined);
    setProgress(0);

    const auth = getAuth();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setSubmitting(false);
      setSubmitError('Debes iniciar sesión para publicar.');
      return;
    }

    const animalId = newAnimalId();

    const validGallery = gallery.filter(a => hasUri(a) || hasBase64(a));
    const coverReady = cover && (hasUri(cover) || hasBase64(cover));
    const totalUploads = (coverReady ? 1 : 0) + validGallery.length;
    let uploaded = 0;
    const tick = () =>
      setProgress(totalUploads > 0 ? uploaded / totalUploads : 0);

    try {
      const ageNum = Number(ageMonths);
      const computedAge = ageUnknown ? 0 : Number.isFinite(ageNum) ? ageNum : 0;

      const baseInput: Omit<
        NewAnimalInput,
        'status' | 'ownerType' | 'ownerUid' | 'location'
      > = {
        name: name.trim(),
        species,
        size,
        sex,
        ageMonths: computedAge,
        mixedBreed,
        sterilized,
        vaccinated,
        ...(urgent ? { urgent: true } : {}),
        ...(breedCode ? { breed: breedCode } : {}),
        mediaCount: 0,
        ...(tags.length > 0 ? { tags } : {}),
      };

      const locationPayload: NonNullable<NewAnimalInput['location']> = {
        country: (derivedCountry ?? 'XX').toUpperCase(),
        ...(derivedCity ? { city: derivedCity } : {}),
        geo: { lat: geo.lat, lng: geo.lng },
      };

      const initialDoc: NewAnimalInput = {
        ...baseInput,
        status: 'disponible',
        ownerType: 'persona',
        ownerUid: uid,
        location: locationPayload,
        ...(derivedAddress ? { address: derivedAddress } : {}),
        matchCount: 0, // nuevo
        images: [], // lo actualizaremos luego
      };

      await createAnimal(animalId, initialDoc);

      let mediaCount = 0;
      const mediaWarnings: string[] = [];
      const galleryURLs: string[] = [];

      // COVER
      if (coverReady) {
        const guessCT = ((): ImgContentType => {
          const ext = (cover?.fileName ?? '').toLowerCase();
          if (ext.endsWith('.png')) return 'image/png';
          if (ext.endsWith('.webp')) return 'image/webp';
          if (ext.endsWith('.heic') || ext.endsWith('.heif'))
            return 'image/heic';
          return 'image/jpeg';
        })();
        const fileName = 'cover.jpg';
        const isBase64Upload = hasBase64(cover!);
        const params = isBase64Upload
          ? { kind: 'base64', base64: cover!.base64 }
          : { kind: 'local', localUri: cover!.uri! };

        try {
          const url = await putAnimalImage({
            animalId,
            fileName,
            contentType: guessCT,
            ...params,
          } as any);

          mediaCount += 1;
          uploaded += 1;
          tick();
          await updateAnimalPartial(animalId, {
            coverUrl: url,
            mediaCount,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[publish][cover] upload error', msg);
          mediaWarnings.push(`Cover: ${msg}`);
        }
      }

      // GALERÍA
      for (const [i, a] of validGallery.entries()) {
        const guessCT = ((): ImgContentType => {
          const ext = (a.fileName ?? '').toLowerCase();
          if (ext.endsWith('.png')) return 'image/png';
          if (ext.endsWith('.webp')) return 'image/webp';
          if (ext.endsWith('.heic') || ext.endsWith('.heif'))
            return 'image/heic';
          return 'image/jpeg';
        })();
        const fileName = `img-${i + 1}.jpg`;
        const isBase64Upload = hasBase64(a);
        const params = isBase64Upload
          ? { kind: 'base64', base64: a.base64 }
          : { kind: 'local', localUri: a.uri! };

        try {
          const url = await putAnimalImage({
            animalId,
            fileName,
            contentType: guessCT,
            ...params,
          } as any);

          galleryURLs.push(url);
          mediaCount += 1;
          uploaded += 1;
          tick();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[publish][gallery] upload error', msg);
          mediaWarnings.push(`Imagen ${i + 1}: ${msg}`);
        }
      }

      // Guardar galería y mediaCount si corresponde
      if (galleryURLs.length > 0) {
        await updateAnimalPartial(animalId, {
          images: galleryURLs,
          mediaCount,
        });
      }

      if (mediaWarnings.length > 0) {
        setSubmitError(
          `Se publicó con advertencias: ${mediaWarnings.join(' | ')}`,
        );
      }

      navigation.replace('AnimalDetail', { id: animalId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error inesperado';
      console.error('[publish] fatal error', msg);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [
    errors.length,
    geo,
    name,
    species,
    size,
    sex,
    ageMonths,
    ageUnknown,
    mixedBreed,
    sterilized,
    vaccinated,
    urgent,
    breedCode,
    cover,
    gallery,
    derivedCountry,
    derivedCity,
    derivedAddress,
    navigation,
  ]);

  const disabled = submitting || errors.length > 0;

  return (
    <Screen style={styles.container}>
      <PageHeader
        title="Nueva huellita"
        subtitle="Completa el perfil para publicación"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.flex}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* ... Resto del componente (sin cambios) ... */}
          <Section title="Nombre" top={0}>
            <TextInput
              mode="outlined"
              dense
              value={name}
              onChangeText={setName}
              placeholder="Nombre"
              style={styles.input}
            />
          </Section>

          <Section title="Especie">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hChips}
            >
              {speciesOptions.map(s => (
                <Chip
                  key={s}
                  selected={species === s}
                  onPress={() => setSpecies(s)}
                  style={styles.chip}
                >
                  {s}
                </Chip>
              ))}
            </ScrollView>
          </Section>

          <Section title="Tamaño">
            <View style={styles.row}>
              {sizes.map(s => (
                <Chip
                  key={s}
                  selected={size === s}
                  onPress={() => setSize(s)}
                  style={styles.chip}
                >
                  {s}
                </Chip>
              ))}
            </View>
          </Section>

          <Section title="Sexo">
            <View style={styles.row}>
              {sexes.map(s => (
                <Chip
                  key={s}
                  selected={sex === s}
                  onPress={() => setSex(s)}
                  style={styles.chip}
                >
                  {s}
                </Chip>
              ))}
            </View>
          </Section>

          <Section title="Edad">
            <View style={styles.switchRow}>
              <Text>Desconocida</Text>
              <Switch value={ageUnknown} onValueChange={setAgeUnknown} />
            </View>
            {ageUnknown ? null : (
              <TextInput
                mode="outlined"
                dense
                keyboardType="number-pad"
                value={ageMonths}
                onChangeText={setAgeMonths}
                style={styles.input}
              />
            )}
          </Section>

          <Section title="Salud">
            <View style={styles.switchRow}>
              <Text>Raza mixta</Text>
              <Switch value={mixedBreed} onValueChange={onToggleMixed} />
            </View>
            <View style={styles.switchRow}>
              <Text>Esterilizado</Text>
              <Switch value={sterilized} onValueChange={setSterilized} />
            </View>
            <View style={styles.switchRow}>
              <Text>Vacunado</Text>
              <Switch value={vaccinated} onValueChange={setVaccinated} />
            </View>
          </Section>

          <Section title="Raza">
            <SelectInput
              label={loadingBreeds ? 'Cargando razas…' : 'Raza'}
              value={breedCode}
              onChange={onChangeBreed}
              options={breedOpts}
            />
          </Section>

          <Section title="Ubicación (obligatoria)">
            <LocationPicker
              {...(geo ? { value: geo } : {})}
              onChange={(v: CoordChange) => {
                if (v.lat === 0 && v.lng === 0) {
                  setGeo(undefined);
                  setDerivedCountry(undefined);
                  setDerivedCity(undefined);
                  setDerivedAddress(undefined);
                  return;
                }
                setGeo({ lat: v.lat, lng: v.lng });
                if (v.countryCode) setDerivedCountry(v.countryCode);
                if (v.city) setDerivedCity(v.city);
                if (v.address) setDerivedAddress(v.address);
              }}
            />
          </Section>

          <Section title="¿Cómo es?">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hChips}
            >
              {tagOptions.map(t => (
                <Chip
                  key={t}
                  selected={tags.includes(t)}
                  onPress={() => toggleTag(t)}
                  style={styles.chip}
                >
                  {t}
                </Chip>
              ))}
            </ScrollView>
          </Section>

          {derivedAddress ? (
            <Card mode="contained" style={{ marginTop: 8 }}>
              <List.Item
                title={derivedAddress}
                description={
                  derivedCity
                    ? `${derivedCity}${derivedCountry ? `, ${derivedCountry}` : ''}`
                    : (derivedCountry ?? '')
                }
                left={props => <List.Icon {...props} icon="map-marker" />}
              />
            </Card>
          ) : null}

          <Section title="Fotos">
            <View style={styles.mediaRow}>
              <Button mode="outlined" onPress={pickImages}>
                Elegir fotos…
              </Button>
              {cover && hasUri(cover) ? (
                <Image source={{ uri: cover.uri }} style={styles.cover} />
              ) : null}
            </View>
            {gallery.length > 0 ? (
              <View style={styles.galleryPreview}>
                {gallery
                  .filter(hasUri)
                  .slice(0, 6)
                  .map((a, i) => (
                    <Image
                      key={`${i}-${a.uri}`}
                      source={{ uri: a.uri }}
                      style={styles.thumb}
                    />
                  ))}
              </View>
            ) : null}
          </Section>

          {errors.length > 0 ? (
            <HelperText type="error" visible style={styles.helper}>
              {errors.join('  •  ')}
            </HelperText>
          ) : submitError ? (
            <HelperText type="error" visible style={styles.helper}>
              {submitError}
            </HelperText>
          ) : (
            <View style={styles.spacer} />
          )}

          <Divider style={{ marginVertical: 8 }} />

          <Button
            mode="contained"
            onPress={onSubmit}
            disabled={disabled}
            style={styles.cta}
          >
            Publicar
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {submitting ? (
        <Loading
          variant="fullscreen"
          progress={progress}
          message="Publicando…"
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  sectionTitle: { marginBottom: 8, opacity: 0.7 },
  sectionBody: {},
  input: { marginBottom: 8, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    paddingHorizontal: 6,
    elevation: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hChips: { paddingRight: 8 },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cover: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  galleryPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: '#bbb',
  },
  helper: { marginTop: 8 },
  spacer: { height: 8 },
  cta: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
});

export default CreateAnimalScreen;
