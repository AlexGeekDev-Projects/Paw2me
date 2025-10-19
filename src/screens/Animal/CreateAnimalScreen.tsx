// src/screens/Animal/CreateAnimalScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
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
  SegmentedButtons,
  ProgressBar,
  FAB,
  Snackbar,
  IconButton,
  Dialog,
  Portal,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import LocationPicker, {
  type CoordChange,
} from '@components/inputs/LocationPicker';
import Screen from '@components/layout/Screen';
import { useUserLocation } from '@hooks/useUserLocation';
import { reverseGeocode } from '@services/geoService';

// Tipado de navegación: agregamos AnimalDetail localmente
type NavParamList = RootStackParamList & { AnimalDetail: { id: string } };
type Props = NativeStackScreenProps<NavParamList, 'CreateAnimal'>;

const DRAFT_KEY = 'CreateAnimalDraft:v1';

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

type ImgContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

const imgPickerOpts: ImageLibraryOptions = {
  selectionLimit: 0,
  mediaType: 'photo',
  includeBase64: true,
  quality: 0.9,
};

const hasUri = (a: Asset): a is Asset & { uri: string } =>
  typeof a.uri === 'string' && a.uri.length > 0;
const hasBase64 = (a: Asset): a is Asset & { base64: string } =>
  typeof a.base64 === 'string' && a.base64.length > 0;

const uriScheme = (u?: string) => (u?.split(':')[0] ?? '').toLowerCase();

const ctFromName = (fileName?: string): ImgContentType => {
  const ext = (fileName ?? '').toLowerCase();
  if (ext.endsWith('.png')) return 'image/png';
  if (ext.endsWith('.webp')) return 'image/webp';
  if (ext.endsWith('.heic') || ext.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
};
const extFromCT = (ct: ImgContentType) =>
  ct === 'image/png'
    ? 'png'
    : ct === 'image/webp'
      ? 'webp'
      : ct === 'image/heic' || ct === 'image/heif'
        ? 'heic'
        : 'jpg';

type UploadParams =
  | ({ kind: 'base64'; base64: string } & {
      fileName: string;
      contentType: ImgContentType;
    })
  | ({ kind: 'local'; localUri: string } & {
      fileName: string;
      contentType: ImgContentType;
    });

const toUploadParams = (
  a: Asset,
  index: number,
  prefix: string,
): UploadParams | null => {
  const ct = ctFromName(a.fileName);
  const ext = extFromCT(ct);
  const fileName = `${prefix}-${index + 1}.${ext}`;

  if (hasBase64(a)) {
    return { kind: 'base64', base64: a.base64!, fileName, contentType: ct };
  }
  if (hasUri(a)) {
    const scheme = uriScheme(a.uri);
    // iOS 'ph://' NO es válido para putFile(); si no hay base64, lo saltamos
    if (Platform.OS === 'ios' && scheme === 'ph') return null;
    if (scheme === 'file' || scheme === 'content') {
      return { kind: 'local', localUri: a.uri!, fileName, contentType: ct };
    }
  }
  return null;
};

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  top?: number;
}> = ({ title, children, top = 16 }) => (
  <View style={{ marginTop: top }}>
    <Text variant="titleSmall" style={styles.sectionTitle}>
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

// ✔️ Ajustado para exactOptionalPropertyTypes
type Draft = {
  name: string;
  species: Species;
  size: (typeof sizes)[number];
  sex: (typeof sexes)[number];
  tags: string[];

  ageMonths: string;
  ageUnknown: boolean;

  mixedBreed: boolean;
  sterilized: boolean;
  vaccinated: boolean;
  urgent: boolean;

  breedCode: string;

  story?: string | undefined;

  geo?: { lat: number; lng: number } | undefined;
  derivedCountry?: string | undefined;
  derivedCity?: string | undefined;
  derivedAddress?: string | undefined;

  coverUri?: string | undefined;
  galleryUris: string[];
};

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

  // historia (OBLIGATORIA)
  const [story, setStory] = useState<string>('');

  // ubicación
  const [geo, setGeo] = useState<{ lat: number; lng: number } | undefined>();
  const [derivedCountry, setDerivedCountry] = useState<string | undefined>();
  const [derivedCity, setDerivedCity] = useState<string | undefined>();
  const [derivedAddress, setDerivedAddress] = useState<string | undefined>();
  const { locateMe, locating, error: locateError } = useUserLocation();

  // media
  const [cover, setCover] = useState<Asset | undefined>();
  const [gallery, setGallery] = useState<Asset[]>([]);

  // ui
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [snack, setSnack] = useState<{ visible: boolean; msg: string }>({
    visible: false,
    msg: '',
  });

  // menú contextual / visor
  const [actionIdx, setActionIdx] = useState<number | null>(null);
  const [actionVisible, setActionVisible] = useState(false);
  const [viewer, setViewer] = useState<{ visible: boolean; uri?: string }>({
    visible: false,
  });

  // ——— Computados auxiliares
  const hasAnyPhoto = useMemo(() => {
    const coverOk = !!(cover && (hasUri(cover) || hasBase64(cover)));
    const galOk = gallery.some(a => hasUri(a) || hasBase64(a));
    return coverOk || galOk;
  }, [cover, gallery]);

  // ——— Validaciones FULL obligatorias
  const errors = useMemo(() => {
    const e: string[] = [];
    const age = Number(ageMonths);

    if (!name.trim()) e.push('El nombre es obligatorio.');
    if (!story.trim()) e.push('La historia es obligatoria.');

    if (!ageUnknown && (!Number.isFinite(age) || age < 0 || age > 600)) {
      e.push('Edad (meses) inválida.');
    }

    if (!geo) e.push('Selecciona la ubicación en el mapa.');
    if (!derivedCountry)
      e.push(
        'No pudimos derivar el país. Toca el mapa o usa “Usar mi ubicación”.',
      );

    if (!hasAnyPhoto) e.push('Agrega al menos una foto.');

    if (!mixedBreed && (!breedCode || breedCode === 'mestizo')) {
      e.push('Selecciona la raza.');
    }

    if (tags.length === 0) e.push('Selecciona al menos una etiqueta.');

    return e;
  }, [
    name,
    story,
    ageMonths,
    ageUnknown,
    geo,
    derivedCountry,
    hasAnyPhoto,
    mixedBreed,
    breedCode,
    tags.length,
  ]);

  const pickImages = useCallback(async () => {
    const res = await launchImageLibrary(imgPickerOpts);
    const assets = (res.assets ?? []) as Asset[];
    if (assets.length > 0) {
      if (!cover && assets[0]) setCover(assets[0]);
      setGallery(prev => [...prev, ...assets.filter(Boolean)]);
    }
  }, [cover]);

  // ——— Eliminar / portada / mover ———
  const removeCover = useCallback(() => {
    const candidate = gallery.find(hasUri);
    setCover(candidate ?? undefined);
  }, [gallery]);

  const removeFromGallery = useCallback(
    (idx: number) => {
      setGallery(prev => {
        const removed = prev[idx];
        const next = prev.filter((_, i) => i !== idx);
        if (cover && hasUri(cover) && removed && hasUri(removed)) {
          if (removed.uri === cover.uri) {
            const candidate = next.find(hasUri);
            setCover(candidate ?? undefined);
          }
        }
        return next;
      });
    },
    [cover],
  );

  const promoteToCover = useCallback(
    (idx: number) => {
      const asset = gallery[idx];
      if (asset) setCover(asset);
    },
    [gallery],
  );

  const moveToStart = useCallback((idx: number) => {
    setGallery(prev => {
      if (idx < 0 || idx >= prev.length) return prev;
      const arr = prev.slice();
      const [item] = arr.splice(idx, 1);
      if (item) arr.unshift(item);
      return arr;
    });
  }, []);

  const toggleTag = (t: string) =>
    setTags(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t],
    );

  // centrar mapa y autocompletar ciudad/dirección
  const handleUseMyLocation = useCallback(async () => {
    const pos = await locateMe();
    if (!pos) return;
    setGeo({ lat: pos.lat, lng: pos.lng });
    try {
      const info = await reverseGeocode(pos.lat, pos.lng);
      if (info?.countryCode) setDerivedCountry(info.countryCode);
      if (info?.city) setDerivedCity(info.city);
      if (info?.formattedAddress) setDerivedAddress(info.formattedAddress);
    } catch {}
  }, [locateMe]);

  // Stepper (3 pasos: datos, ubicación, fotos)
  const step1Done =
    name.trim().length > 0 &&
    story.trim().length > 0 &&
    Boolean(species) &&
    Boolean(size) &&
    Boolean(sex) &&
    (ageUnknown ||
      (Number.isFinite(Number(ageMonths)) &&
        Number(ageMonths) >= 0 &&
        Number(ageMonths) <= 600));
  const step2Done = Boolean(geo);
  const step3Done = hasAnyPhoto; // ahora obligatorio
  const stepProgress =
    (Number(step1Done) + Number(step2Done) + Number(step3Done)) / 3;

  // ——— Borradores (AsyncStorage)
  const rehydrateAsset = (uri?: string): Asset | undefined =>
    uri ? ({ uri } as Asset) : undefined;
  const rehydrateAssets = (uris: string[]): Asset[] =>
    uris.filter(Boolean).map(u => ({ uri: u }) as Asset);

  const saveDraft = useCallback(async () => {
    const draft: Draft = {
      name,
      species,
      size,
      sex,
      tags,
      ageMonths,
      ageUnknown,
      mixedBreed,
      sterilized,
      vaccinated,
      urgent,
      breedCode,
      story,
      geo,
      derivedCountry,
      derivedCity,
      derivedAddress,
      coverUri: cover && hasUri(cover) ? cover.uri : undefined,
      galleryUris: gallery.filter(hasUri).map(g => g.uri!),
    };
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSnack({ visible: true, msg: 'Borrador guardado' });
    } catch {
      setSnack({ visible: true, msg: 'No se pudo guardar el borrador' });
    }
  }, [
    name,
    species,
    size,
    sex,
    tags,
    ageMonths,
    ageUnknown,
    mixedBreed,
    sterilized,
    vaccinated,
    urgent,
    breedCode,
    story,
    geo,
    derivedCountry,
    derivedCity,
    derivedAddress,
    cover,
    gallery,
  ]);

  const loadDraft = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d: Draft = JSON.parse(raw);
      setName(d.name ?? '');
      setSpecies(d.species ?? 'perro');
      setSize((d.size as any) ?? 'M');
      setSex((d.sex as any) ?? 'macho');
      setTags(d.tags ?? []);
      setAgeMonths(d.ageMonths ?? '6');
      setAgeUnknown(Boolean(d.ageUnknown));
      setMixedBreed(Boolean(d.mixedBreed));
      setSterilized(Boolean(d.sterilized));
      setVaccinated(Boolean(d.vaccinated));
      setUrgent(Boolean(d.urgent));
      setBreedCode(d.breedCode ?? 'mestizo');
      setStory(d.story ?? '');
      setGeo(d.geo);
      setDerivedCountry(d.derivedCountry);
      setDerivedCity(d.derivedCity);
      setDerivedAddress(d.derivedAddress);
      setCover(rehydrateAsset(d.coverUri));
      setGallery(rehydrateAssets(d.galleryUris ?? []));
      setSnack({ visible: true, msg: 'Borrador cargado' });
    } catch {
      setSnack({ visible: true, msg: 'No se pudo cargar el borrador' });
    }
  }, []);

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_KEY);
      setSnack({ visible: true, msg: 'Borrador eliminado' });
    } catch {
      setSnack({ visible: true, msg: 'No se pudo eliminar el borrador' });
    }
  }, []);

  useEffect(() => {
    void loadDraft();
  }, [loadDraft]);

  // ——— Submit
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

    // Normaliza lotes
    const coverParams = cover ? toUploadParams(cover, 0, 'cover') : null;
    const galleryParams: UploadParams[] = [];
    const mediaWarnings: string[] = [];

    gallery.forEach((a, i) => {
      const p = toUploadParams(a, i, 'img');
      if (p) galleryParams.push(p);
      else
        mediaWarnings.push(
          `Imagen ${i + 1}: sin base64 y URI no compatible (p. ej. ph://). Se omitió.`,
        );
    });

    const totalUploads = (coverParams ? 1 : 0) + galleryParams.length;
    let uploaded = 0;
    const tick = () =>
      setProgress(totalUploads > 0 ? uploaded / totalUploads : 0);

    try {
      // Documento base
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
        ...(story.trim() ? { story: story.trim() } : {}),
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
        matchCount: 0,
        images: [],
      };

      await createAnimal(animalId, initialDoc);

      // ——— Subidas ———
      let mediaCount = 0;
      const galleryURLs: string[] = [];

      // Cover
      if (coverParams) {
        try {
          const coverArgs =
            coverParams.kind === 'base64'
              ? { kind: 'base64' as const, base64: coverParams.base64 }
              : { kind: 'local' as const, localUri: coverParams.localUri };

          const url = await putAnimalImage({
            animalId,
            fileName: coverParams.fileName,
            contentType: coverParams.contentType,
            ...coverArgs,
          } as any);

          mediaCount += 1;
          uploaded += 1;
          tick();

          await updateAnimalPartial(animalId, { coverUrl: url, mediaCount });
        } catch (e) {
          const code = (e as any)?.code;
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[publish][cover] upload error', code, msg);
          mediaWarnings.push(`Cover: ${code ?? 'desconocido'} – ${msg}`);
        }
      }

      // Galería
      for (const [i, p] of galleryParams.entries()) {
        try {
          const uploadArgs =
            p.kind === 'base64'
              ? { kind: 'base64' as const, base64: p.base64 }
              : { kind: 'local' as const, localUri: p.localUri };

          const url = await putAnimalImage({
            animalId,
            fileName: p.fileName,
            contentType: p.contentType,
            ...uploadArgs,
          } as any);

          galleryURLs.push(url);
          mediaCount += 1;
          uploaded += 1;
          tick();
        } catch (e) {
          const code = (e as any)?.code;
          const msg = e instanceof Error ? e.message : String(e);
          console.error('[publish][gallery] upload error', code, msg);
          mediaWarnings.push(
            `Imagen ${i + 1}: ${code ?? 'desconocido'} – ${msg}`,
          );
        }
      }

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

      // limpiar borrador
      try {
        await AsyncStorage.removeItem(DRAFT_KEY);
      } catch {}

      // Redirección al detalle anidado en Feed
      (navigation as any).navigate('AppTabs', {
        screen: 'FeedTab',
        params: {
          screen: 'AnimalDetail',
          params: { id: animalId },
        },
      });
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
    story,
    cover,
    gallery,
    derivedCountry,
    derivedCity,
    derivedAddress,
    tags.length,
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

      {/* Stepper */}
      <View style={styles.stepperWrap}>
        <View style={styles.stepsRow}>
          <Chip
            compact
            selected={step1Done}
            icon={step1Done ? 'check' : 'numeric-1-circle-outline'}
            onPress={() => {}}
          >
            Datos
          </Chip>
          <Chip
            compact
            selected={step2Done}
            icon={step2Done ? 'check' : 'numeric-2-circle-outline'}
            onPress={() => {}}
          >
            Ubicación
          </Chip>
          <Chip
            compact
            selected={step3Done}
            icon={step3Done ? 'check' : 'numeric-3-circle-outline'}
            onPress={() => {}}
          >
            Fotos
          </Chip>
        </View>
        <ProgressBar progress={stepProgress} style={styles.progress} />
      </View>

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
          {/* Nombre */}
          <Section title="Nombre *" top={0}>
            <TextInput
              mode="outlined"
              dense
              value={name}
              onChangeText={setName}
              placeholder="Nombre"
              style={styles.input}
            />
          </Section>

          {/* Especie */}
          <Section title="Especie *">
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

          {/* Tamaño */}
          <Section title="Tamaño *">
            <SegmentedButtons
              value={size}
              onValueChange={v => setSize(v as (typeof sizes)[number])}
              buttons={sizes.map(s => ({
                value: s,
                label: s,
              }))}
              density="regular"
              style={{ marginTop: 2 }}
            />
          </Section>

          {/* Sexo */}
          <Section title="Sexo *">
            <SegmentedButtons
              value={sex}
              onValueChange={v => setSex(v as (typeof sexes)[number])}
              buttons={[
                { value: 'macho', label: 'Macho' },
                { value: 'hembra', label: 'Hembra' },
              ]}
              density="regular"
              style={{ marginTop: 2 }}
            />
          </Section>

          {/* Edad */}
          <Section title="Edad *">
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
                right={<TextInput.Affix text="meses" />}
              />
            )}
          </Section>

          {/* Salud */}
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

          {/* Raza */}
          <Section title="Raza * si no es mixto">
            <SelectInput
              label={loadingBreeds ? 'Cargando razas…' : 'Raza'}
              value={breedCode}
              onChange={onChangeBreed}
              options={breedOpts}
            />
          </Section>

          {/* Historia (OBLIGATORIA) */}
          <Section title="Historia *">
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={6}
              value={story}
              onChangeText={setStory}
              placeholder="Cuenta su historia: cómo llegó, su personalidad, avances y qué necesita."
              maxLength={1200}
              right={<TextInput.Affix text={`${story.length}/1200`} />}
              style={[styles.input, { textAlignVertical: 'top' }]}
              error={!story.trim()}
            />
            {!story.trim() ? (
              <HelperText type="error" visible>
                La historia es obligatoria.
              </HelperText>
            ) : (
              <Text variant="bodySmall" style={styles.helperNote}>
                Tip: sé específico y honesto. Historias breves con detalles
                concretos generan más empatía.
              </Text>
            )}
          </Section>

          {/* ¿Cómo es? (tags) */}
          <Section title="¿Cómo es? (etiquetas) *">
            <View
              style={[
                tags.length === 0 && styles.requiredWrap,
                { borderRadius: 12 },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.hChips, { padding: 4 }]}
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
            </View>
            {tags.length === 0 ? (
              <HelperText type="error" visible>
                Selecciona al menos una etiqueta.
              </HelperText>
            ) : (
              <Text variant="bodySmall" style={styles.helperNote}>
                Estas etiquetas se usarán en filtros y búsquedas.
              </Text>
            )}
          </Section>

          {/* Ubicación ——— justo DESPUÉS de “¿Cómo es?” */}
          <LocationPicker
            headTitle="Ubicación *"
            value={geo}
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
            onUseMyLocation={handleUseMyLocation}
            locating={locating}
          />

          {/* Error de localización */}
          {locateError ? (
            <HelperText type="error" visible style={{ marginTop: 6 }}>
              {locateError}
            </HelperText>
          ) : null}

          {/* Dirección derivada */}
          {derivedAddress ? (
            <Card
              mode="contained"
              style={[styles.addressCard, { marginTop: 8 }]}
            >
              <View style={styles.addressClip}>
                <List.Item
                  title={derivedAddress}
                  description={
                    derivedCity
                      ? `${derivedCity}${derivedCountry ? `, ${derivedCountry}` : ''}`
                      : (derivedCountry ?? '')
                  }
                  left={props => <List.Icon {...props} icon="map-marker" />}
                />
              </View>
            </Card>
          ) : null}

          {/* Fotos */}
          <Section title="Fotos *">
            <View
              style={[
                styles.mediaRow,
                !hasAnyPhoto && styles.requiredWrap,
                { padding: 8, borderRadius: 12 },
              ]}
            >
              <Button
                mode="outlined"
                onPress={pickImages}
                icon="image-multiple-outline"
              >
                Elegir fotos…
              </Button>

              {cover && hasUri(cover) ? (
                <View style={styles.coverWrap}>
                  <Image source={{ uri: cover.uri }} style={styles.cover} />
                  <Chip compact icon="crown-outline" style={styles.coverBadge}>
                    Portada
                  </Chip>
                  <IconButton
                    icon="delete-outline"
                    size={18}
                    onPress={removeCover}
                    style={styles.delCover}
                    containerColor="rgba(0,0,0,0.45)"
                    iconColor="#fff"
                    accessibilityLabel="Eliminar portada"
                  />
                </View>
              ) : null}
            </View>

            <Text variant="bodySmall" style={styles.infoText}>
              La primera foto que elijas se usará como{' '}
              <Text style={{ fontWeight: '600' }}>portada</Text>.
            </Text>
            {!hasAnyPhoto ? (
              <HelperText type="error" visible>
                Agrega al menos una foto (puede ser portada o de la galería).
              </HelperText>
            ) : null}

            {gallery.length > 0 ? (
              <View style={styles.galleryPreview}>
                {gallery.filter(hasUri).map(a => {
                  const originalIndex = gallery.findIndex(
                    g => hasUri(g) && g.uri === a.uri,
                  );
                  return (
                    <Pressable
                      key={`${originalIndex}-${a.uri}`}
                      onLongPress={() => {
                        setActionIdx(originalIndex);
                        setActionVisible(true);
                      }}
                      style={styles.thumbWrap}
                    >
                      <Image source={{ uri: a.uri }} style={styles.thumb} />
                      {/* Botón borrar directo */}
                      <IconButton
                        icon="close"
                        size={16}
                        onPress={() => removeFromGallery(originalIndex)}
                        style={styles.delThumb}
                        containerColor="rgba(0,0,0,0.45)"
                        iconColor="#fff"
                        accessibilityLabel="Eliminar imagen"
                      />
                      {/* Botón menú contextual */}
                      <IconButton
                        icon="dots-vertical"
                        size={16}
                        onPress={() => {
                          setActionIdx(originalIndex);
                          setActionVisible(true);
                        }}
                        style={styles.menuThumb}
                        containerColor="rgba(0,0,0,0.45)"
                        iconColor="#fff"
                        accessibilityLabel="Más acciones"
                      />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </Section>

          {/* Errores / Submit */}
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

          <Divider style={{ marginVertical: 8, opacity: 0.6 }} />

          <Button
            mode="contained"
            onPress={onSubmit}
            disabled={disabled}
            style={styles.cta}
            contentStyle={{ paddingVertical: 8 }}
            icon="check-circle"
          >
            Publicar
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB: Guardar borrador */}
      <FAB
        icon="content-save-outline"
        label="Guardar borrador"
        onPress={saveDraft}
        style={styles.fab}
        variant="secondary"
      />

      {submitting ? (
        <Loading
          variant="fullscreen"
          progress={progress}
          message="Publicando…"
        />
      ) : null}

      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ visible: false, msg: '' })}
        action={{
          label: 'Borrar',
          onPress: () => {
            void clearDraft();
          },
        }}
        duration={2500}
      >
        {snack.msg}
      </Snackbar>

      {/* Menú de acciones sobre imagen */}
      <Portal>
        <Dialog
          visible={actionVisible}
          onDismiss={() => setActionVisible(false)}
        >
          <Dialog.Title>Acciones de la foto</Dialog.Title>
          <Dialog.Content>
            <List.Item
              title="Hacer portada"
              left={p => <List.Icon {...p} icon="crown-outline" />}
              onPress={() => {
                if (actionIdx != null) promoteToCover(actionIdx);
                setActionVisible(false);
              }}
            />
            <List.Item
              title="Mover al inicio"
              left={p => <List.Icon {...p} icon="arrow-collapse-up" />}
              onPress={() => {
                if (actionIdx != null) moveToStart(actionIdx);
                setActionVisible(false);
              }}
            />
            <List.Item
              title="Ver"
              left={p => <List.Icon {...p} icon="image" />}
              onPress={() => {
                if (actionIdx != null) {
                  const a = gallery[actionIdx];
                  if (a && hasUri(a)) {
                    setViewer({ visible: true, uri: a.uri });
                  }
                }
                setActionVisible(false);
              }}
            />
            <List.Item
              title="Eliminar"
              titleStyle={{ color: '#d32f2f' }}
              left={p => (
                <List.Icon {...p} icon="delete-outline" color="#d32f2f" />
              )}
              onPress={() => {
                if (actionIdx != null) removeFromGallery(actionIdx);
                setActionVisible(false);
              }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setActionVisible(false)}>Cerrar</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Visor de imagen (fullscreen, proporciones correctas) */}
      <Modal
        visible={viewer.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewer({ visible: false })}
      >
        <View style={styles.viewerBackdrop}>
          {/* Cerrar tocando fuera */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setViewer({ visible: false })}
          />

          {viewer.uri ? (
            <Image
              source={{ uri: viewer.uri }}
              style={styles.viewerImg}
              resizeMode="contain"
            />
          ) : null}

          <IconButton
            icon="close"
            size={22}
            onPress={() => setViewer({ visible: false })}
            style={styles.viewerClose}
            containerColor="rgba(0,0,0,0.55)"
            iconColor="#fff"
            accessibilityLabel="Cerrar visor"
          />
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  // Stepper
  stepperWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  progress: { height: 6, borderRadius: 999 },

  sectionTitle: { marginBottom: 6, fontWeight: '600', letterSpacing: 0.2 },
  sectionBody: {},
  input: { marginBottom: 8, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 18,
    paddingHorizontal: 6,
    elevation: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hChips: { paddingRight: 8 },

  // Card de dirección: sin overflow en Surface
  addressCard: {
    borderRadius: 12,
  },
  addressClip: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Fotos
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  infoText: {
    marginTop: 8,
    opacity: 0.7,
    alignSelf: 'flex-start',
    lineHeight: 18,
  },

  // Envoltura requerida (borde punteado rojo)
  requiredWrap: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d32f2f',
    backgroundColor: 'rgba(211,47,47,0.06)',
  },

  // ——— Portada
  coverWrap: { position: 'relative' },
  cover: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  coverBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 14,
    elevation: 1,
  },
  delCover: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
  },

  // ——— Galería
  galleryPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  thumbWrap: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#bbb',
  },
  delThumb: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 2,
  },
  menuThumb: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    zIndex: 2,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  viewerImg: {
    width: '94%',
    height: '80%',
    borderRadius: 8,
  },
  viewerClose: {
    position: 'absolute',
    top: Platform.select({ ios: 44, android: 16 }) as number,
    right: 16,
  },

  helper: { marginTop: 8 },
  helperNote: { marginTop: 6, opacity: 0.7 },
  spacer: { height: 8 },
  cta: { marginTop: 12, borderRadius: 14 },

  fab: { position: 'absolute', right: 16, bottom: 24 },

  viewerImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: '#000',
  },
});

export default CreateAnimalScreen;
