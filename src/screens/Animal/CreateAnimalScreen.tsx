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
import { createAnimal, newAnimalId } from '@services/animalsService';
import { putAnimalImage } from '@services/storageService';
import Loading from '@components/feedback/Loading';
import type { NewAnimalInput, Species } from '@models/animal';
import PageHeader from '@components/layout/PageHeader';
import SelectInput from '@components/inputs/SelectInput';
import { useBreedOptions } from '@hooks/useMetaOptions';
import LocationPicker from '@components/inputs/LocationPicker';

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

const imgPickerOpts: ImageLibraryOptions = {
  selectionLimit: 0,
  mediaType: 'photo',
  includeBase64: false,
  quality: 0.9,
};

const hasUri = (a: Asset): a is Asset & { uri: string } =>
  typeof a.uri === 'string' && a.uri.length > 0;

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

const CreateAnimalScreen: React.FC<Props> = ({ navigation }) => {
  // core
  const [name, setName] = useState<string>('');
  const [species, setSpecies] = useState<Species>('perro');
  const [size, setSize] = useState<(typeof sizes)[number]>('M');
  const [sex, setSex] = useState<(typeof sexes)[number]>('macho');

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

  // ubicación (solo mapa)
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

  const onSubmit = useCallback(async () => {
    if (errors.length > 0 || !geo) return;
    setSubmitting(true);
    setProgress(0);

    const uid = getAuth().currentUser?.uid ?? 'dev';
    const animalId = newAnimalId();

    let coverUrlLocal: string | undefined;

    const validGallery = gallery.filter(hasUri);
    const totalUploads = (cover?.uri ? 1 : 0) + validGallery.length;
    let done = 0;
    const updateP = () =>
      setProgress(totalUploads > 0 ? done / totalUploads : 0);

    try {
      if (cover?.uri) {
        coverUrlLocal = await putAnimalImage(animalId, cover.uri, 'cover.jpg');
        done += 1;
        updateP();
      }

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
        ...(coverUrlLocal ? { coverUrl: coverUrlLocal } : {}),
        ...(breedCode ? { breed: breedCode } : {}),
      };

      // 'country' requerido → fallback 'XX' si no lo tenemos
      const locationPayload: NonNullable<NewAnimalInput['location']> = {
        country: (derivedCountry ?? 'XX').toUpperCase(),
        ...(derivedCity ? { city: derivedCity } : {}),
        ...(geo ? { geo: { lat: geo.lat, lng: geo.lng } } : {}),
      };

      const input: NewAnimalInput = {
        ...baseInput,
        status: 'disponible',
        ownerType: 'persona',
        ownerUid: uid,
        location: locationPayload,
      };

      await createAnimal(animalId, input);

      for (const [i, a] of validGallery.entries()) {
        const fileName = `img-${i + 1}.jpg`;
        await putAnimalImage(animalId, a.uri, fileName);
        done += 1;
        updateP();
      }

      navigation.replace('AnimalDetail', { id: animalId });
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
    navigation,
  ]);

  const disabled = submitting || errors.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Nuevo animal"
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
              onChange={v => {
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
              {cover?.uri ? (
                <Image source={{ uri: cover.uri }} style={styles.cover} />
              ) : null}
            </View>
            {gallery.length > 0 ? (
              <View style={styles.galleryPreview}>
                {gallery
                  .slice(0, 6)
                  .filter(hasUri)
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  sectionTitle: { marginBottom: 8, opacity: 0.7 },
  sectionBody: {},
  input: { marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { marginRight: 8, marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hChips: { paddingRight: 8 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cover: { width: 72, height: 72, borderRadius: 12, marginLeft: 12 },
  galleryPreview: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  helper: { marginTop: 8 },
  spacer: { height: 8 },
  cta: { marginTop: 8 },
});

export default CreateAnimalScreen;
