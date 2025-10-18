// src/services/animalsService.ts
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  doc,
  nowTs,
  type FirebaseFirestoreTypes,
} from '@services/firebase';
import type { AnimalDoc, NewAnimalInput, AnimalCardVM } from '@models/animal';
import { Platform } from 'react-native';

// ————————————————————————————————————————————————
// Helpers comunes
// ————————————————————————————————————————————————

export const newAnimalId = (): string =>
  doc(collection(getFirestore(), 'paws')).id;

export const animalsColRef = () => collection(getFirestore(), 'paws');

const toCard = (d: AnimalDoc): AnimalCardVM => ({
  id: d.id,
  name: d.name,
  species: d.species,
  status: d.status,
  chips: [
    d.mixedBreed ? 'Mestizo' : (d.breed ?? '—'),
    d.size,
    d.sterilized ? 'Esterilizado' : 'Sin esterilizar',
  ],
  ...(d.location.city ? { city: d.location.city } : {}),
  ...(d.coverUrl ? { coverUrl: d.coverUrl } : {}),
  ...(d.urgent ? { urgent: true } : {}),
});

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const tokenize = (s: string): string[] =>
  normalize(s)
    .split(/[^a-z0-9]+/g)
    .filter(t => t.length > 1);

const makeSearchTokens = (input: {
  name?: string;
  breed?: string;
  city?: string;
  tags?: readonly string[] | string[];
}): string[] => {
  const bag = new Set<string>();
  if (input.name) tokenize(input.name).forEach(t => bag.add(t));
  if (input.breed) tokenize(input.breed).forEach(t => bag.add(t));
  if (input.city) tokenize(input.city).forEach(t => bag.add(t));
  if (Array.isArray(input.tags))
    input.tags.forEach(tag => tokenize(tag).forEach(t => bag.add(t)));
  return Array.from(bag);
};

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
};

const toMillisNumber = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  const maybeTs = v as { toMillis?: () => number } | null;
  if (maybeTs && typeof maybeTs.toMillis === 'function') {
    const n = maybeTs.toMillis();
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// ————————————————————————————————————————————————
// Listado público (post-filtro + radio de distancia)
// ————————————————————————————————————————————————

export type ListAnimalsParams = Readonly<{
  limit?: number;
  after?: string; // cursor = String(createdAt) del último doc de la página
  status?: 'disponible' | 'en_proceso';
  city?: string;
  species?: AnimalDoc['species'];
  size?: AnimalDoc['size'];
  urgent?: true;
  text?: string; // usa searchTokens si existen (server) + fallback local
  center?: { lat: number; lng: number }; // centro del radio
  distanceKm?: number; // radio en km
}>;

const matchesLocally = (d: AnimalDoc, opts?: ListAnimalsParams): boolean => {
  if (!opts) return true;
  if (opts.status && d.status !== opts.status) return false;
  if (opts.species && d.species !== opts.species) return false;
  if (opts.size && d.size !== opts.size) return false;
  if (opts.urgent && !d.urgent) return false;

  if (opts.city) {
    const docCity = d.location?.city ? normalize(d.location.city) : '';
    if (normalize(opts.city) !== docCity) return false;
  }

  if (opts.text && opts.text.trim().length > 0) {
    const tokens = tokenize(opts.text);
    if (tokens.length > 0) {
      const haystack = [
        d.name,
        d.breed ?? '',
        d.location?.city ?? '',
        ...(Array.isArray(d.tags) ? d.tags : []),
      ]
        .map(x => normalize(String(x)))
        .join(' ');
      if (!tokens.some(t => haystack.includes(t))) return false;
    }
  }

  // Distancia por radio
  if (opts.center && typeof opts.distanceKm === 'number') {
    const geo = (d.location as any)?.geo;
    const lat = typeof geo?.lat === 'number' ? geo.lat : null;
    const lng = typeof geo?.lng === 'number' ? geo.lng : null;
    if (lat === null || lng === null) return false;
    const dist = haversineKm(opts.center.lat, opts.center.lng, lat, lng);
    if (dist > opts.distanceKm) return false;
  }

  return true;
};

export const listAnimalsPublic = async (opts?: ListAnimalsParams) => {
  const userLimit =
    typeof opts?.limit === 'number' && opts.limit > 0 ? opts.limit : 24;

  // Traemos en lotes amplios para poder post-filtrar
  const BATCH_LIMIT = Math.max(userLimit * 3, 60);

  let collected: AnimalDoc[] = [];
  let nextCursor: string | null = null;

  // Cursor inicial
  let currentCursor: number | null =
    opts?.after && Number.isFinite(Number(opts.after))
      ? Number(opts.after)
      : null;

  // Iteramos hasta juntar userLimit filtrados o quedarnos sin datos (máx 5 lotes)
  for (let round = 0; round < 5 && collected.length < userLimit; round++) {
    const constraints: unknown[] = [
      orderBy('createdAt', 'desc'),
      ...(opts?.status
        ? [where('status', '==', opts.status)]
        : [where('status', 'in', ['disponible', 'en_proceso'])]),
      ...(currentCursor !== null
        ? [where('createdAt', '<', currentCursor)]
        : []),
      limit(BATCH_LIMIT),
    ];

    const q = query(
      animalsColRef(),
      ...(constraints as Parameters<typeof query>[1][]),
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      nextCursor = null;
      break;
    }

    // Mapear batch
    const batch: AnimalDoc[] = snap.docs.map(
      (
        d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
      ) => {
        const data = d.data() as Omit<AnimalDoc, 'id'>;
        return { id: d.id, ...data };
      },
    );

    // Post-filtro completo (incl. distancia)
    const filtered = batch.filter(d => matchesLocally(d, opts));
    collected = collected.concat(filtered);

    // Actualizar cursor con el último doc del batch (no filtrado)
    const lastDoc = snap.docs[snap.docs.length - 1];
    const lastData = lastDoc.data() as { createdAt?: unknown };
    const lastMillis = toMillisNumber(lastData?.createdAt);
    currentCursor = lastMillis ?? currentCursor;

    if (snap.size < BATCH_LIMIT) {
      nextCursor = null;
      break;
    }
  }

  // Ajustar a userLimit y preparar nextCursor
  const page = collected.slice(0, userLimit);
  nextCursor =
    currentCursor && page.length === userLimit ? String(currentCursor) : null;

  return {
    items: page,
    cards: page.map(toCard),
    ...(nextCursor ? { nextCursor } : {}),
  };
};

// ————————————————————————————————————————————————
// Lectura individual
// ————————————————————————————————————————————————

export const getAnimalById = async (id: string) => {
  const ref = doc(getFirestore(), 'paws', id);
  const s = await getDoc(ref);
  if (!s.exists()) return undefined;
  return { id: s.id, ...(s.data() as Omit<AnimalDoc, 'id'>) };
};

// ————————————————————————————————————————————————
// Creación / actualización (con searchTokens) — sin undefined
// ————————————————————————————————————————————————

export const createAnimal = async (id: string, input: NewAnimalInput) => {
  const refDoc = doc(getFirestore(), 'paws', id);
  const now = nowTs();

  // Construimos solo claves definidas para tokens
  const tokenInput: {
    name?: string;
    breed?: string;
    city?: string;
    tags?: readonly string[] | string[];
  } = {};
  tokenInput.name = input.name;
  if (input.breed) tokenInput.breed = input.breed;
  if (input.location?.city) tokenInput.city = input.location.city;
  if (input.tags) tokenInput.tags = input.tags;

  const tokens = makeSearchTokens(tokenInput);

  const payload: NewAnimalInput & {
    createdAt: FirebaseFirestoreTypes.FieldValue;
    updatedAt: FirebaseFirestoreTypes.FieldValue;
    searchTokens?: string[];
  } = {
    ...input,
    createdAt: now,
    updatedAt: now,
    pawId: id,
    createdByPlatform:
      Platform.OS === 'ios' ||
      Platform.OS === 'android' ||
      Platform.OS === 'web'
        ? Platform.OS
        : 'web',
    visibility: 'public',
    tags: input.tags ?? [],
    matchCount: typeof input.matchCount === 'number' ? input.matchCount : 0,
    ...(input.images ? { images: input.images } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(tokens.length > 0 ? { searchTokens: tokens } : {}),
  };

  await setDoc(refDoc, payload);
};

export const updateAnimalPartial = async (
  id: string,
  patch: Partial<NewAnimalInput>,
) => {
  const refDoc = doc(getFirestore(), 'paws', id);

  const tokenInput: {
    name?: string;
    breed?: string;
    city?: string;
    tags?: readonly string[] | string[];
  } = {};
  if (typeof patch.name === 'string') tokenInput.name = patch.name;
  if (typeof patch.breed === 'string') tokenInput.breed = patch.breed;
  if (patch.location?.city) tokenInput.city = patch.location.city;
  if (patch.tags) tokenInput.tags = patch.tags;

  const tokens =
    Object.keys(tokenInput).length > 0 ? makeSearchTokens(tokenInput) : [];

  const clean = Object.fromEntries(
    Object.entries({
      ...patch,
      ...(tokens.length > 0 ? { searchTokens: tokens } : {}),
      updatedAt: nowTs(),
    }).filter(([, v]) => v !== undefined),
  ) as Partial<NewAnimalInput> & {
    updatedAt: FirebaseFirestoreTypes.FieldValue;
  };

  await setDoc(refDoc, clean, { merge: true });
};

// ————————————————————————————————————————————————
// Mis animales
// ————————————————————————————————————————————————

export interface MyAnimalItem {
  id: string;
  name: string;
}

export const listMyAnimals = async (ownerUid: string) => {
  const q = query(
    animalsColRef(),
    where('ownerUid', '==', ownerUid),
    where('status', 'in', ['disponible', 'en_proceso']),
    orderBy('createdAt', 'desc'),
    limit(25),
  );
  const snap = await getDocs(q);
  const items: MyAnimalItem[] = snap.docs.map(
    (
      d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
    ) => {
      const data = d.data() as { name?: string };
      const name = typeof data.name === 'string' ? data.name : '—';
      return { id: d.id, name };
    },
  );
  return items;
};
