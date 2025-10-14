import { db } from './firebase';
import {
  collection,
  getDocs,
  orderBy,
  query,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OptionKV } from '@models/meta';

// Fallbacks locales (ligeros)
import { countries as countriesLocal } from '@data/countries';
import { citiesMX as citiesMXLocal } from '@data/cities_mx';
import { dogBreeds as dogBreedsLocal } from '@data/breeds_dog';
import { catBreeds as catBreedsLocal } from '@data/breeds_cat';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CacheEntry<T> {
  data: readonly T[];
  fetchedAt: number;
}

const mem = {
  countries: undefined as CacheEntry<OptionKV> | undefined,
  cities: {} as Record<string, CacheEntry<OptionKV> | undefined>,
  breeds: {} as Record<string, CacheEntry<OptionKV> | undefined>,
};

const K = {
  countries: 'meta:countries',
  cities: (code: string) => `meta:cities:${code}`,
  breeds: (species: string) => `meta:breeds:${species}`,
};

const isFresh = (e: CacheEntry<unknown> | undefined): boolean =>
  !!e && Date.now() - e.fetchedAt < TTL_MS;

async function readDisk(
  key: string,
): Promise<CacheEntry<OptionKV> | undefined> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry<OptionKV>;
    if (!isFresh(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

async function writeDisk(
  key: string,
  entry: CacheEntry<OptionKV>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* no-op */
  }
}

const mapSnap = (
  docs: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>[],
): readonly OptionKV[] => {
  const out: OptionKV[] = docs.map(d => {
    const data = d.data() as { code?: string; label?: string; id?: string };
    const value =
      typeof data.code === 'string'
        ? data.code
        : typeof data.id === 'string'
          ? data.id
          : d.id;
    const label = typeof data.label === 'string' ? data.label : d.id;
    return { value, label };
  });
  return out;
};

// -------- Countries ----------
export const getCountries = async (
  forceRefresh = false,
): Promise<readonly OptionKV[]> => {
  if (!forceRefresh && isFresh(mem.countries)) return mem.countries!.data;

  const disk = !forceRefresh ? await readDisk(K.countries) : undefined;
  if (disk) {
    mem.countries = disk;
    return disk.data;
  }

  try {
    const col = collection(db, 'meta', 'countries');
    const q = query(col, orderBy('label', 'asc'));
    const snap = await getDocs(q);
    const items = mapSnap(snap.docs);
    const result = (
      items.length > 0 ? items : countriesLocal
    ) as readonly OptionKV[];
    const entry = { data: result, fetchedAt: Date.now() };
    mem.countries = entry;
    await writeDisk(K.countries, entry);
    return result;
  } catch {
    const result = countriesLocal as readonly OptionKV[];
    const entry = { data: result, fetchedAt: Date.now() };
    mem.countries = entry;
    await writeDisk(K.countries, entry);
    return result;
  }
};

// -------- Cities by country ----------
export const getCities = async (
  countryCode: string,
  forceRefresh = false,
): Promise<readonly OptionKV[]> => {
  const key = countryCode.toUpperCase();
  const memEntry = mem.cities[key];
  if (!forceRefresh && isFresh(memEntry)) return memEntry!.data;

  const disk = !forceRefresh ? await readDisk(K.cities(key)) : undefined;
  if (disk) {
    mem.cities[key] = disk;
    return disk.data;
  }

  try {
    const col = collection(db, 'meta', 'countries', key, 'cities');
    const q = query(col, orderBy('label', 'asc'));
    const snap = await getDocs(q);
    const items = mapSnap(snap.docs);
    const result = (
      items.length > 0 ? items : key === 'MX' ? citiesMXLocal : []
    ) as readonly OptionKV[];
    const entry = { data: result, fetchedAt: Date.now() };
    mem.cities[key] = entry;
    await writeDisk(K.cities(key), entry);
    return result;
  } catch {
    const result = (key === 'MX' ? citiesMXLocal : []) as readonly OptionKV[];
    const entry = { data: result, fetchedAt: Date.now() };
    mem.cities[key] = entry;
    await writeDisk(K.cities(key), entry);
    return result;
  }
};

// -------- Breeds by species ----------
export const getBreeds = async (
  species: string,
  forceRefresh = false,
): Promise<readonly OptionKV[]> => {
  const key = species.toLowerCase();
  const memEntry = mem.breeds[key];
  if (!forceRefresh && isFresh(memEntry)) return memEntry!.data;

  const disk = !forceRefresh ? await readDisk(K.breeds(key)) : undefined;
  if (disk) {
    mem.breeds[key] = disk;
    return disk.data;
  }

  try {
    const col = collection(db, 'meta', 'species', key, 'breeds');
    const q = query(col, orderBy('label', 'asc'));
    const snap = await getDocs(q);
    const items = mapSnap(snap.docs);
    const fallback =
      key === 'gato' ? catBreedsLocal : key === 'perro' ? dogBreedsLocal : [];
    const result = (items.length > 0 ? items : fallback) as readonly OptionKV[];
    const entry = { data: result, fetchedAt: Date.now() };
    mem.breeds[key] = entry;
    await writeDisk(K.breeds(key), entry);
    return result;
  } catch {
    const fallback =
      key === 'gato' ? catBreedsLocal : key === 'perro' ? dogBreedsLocal : [];
    const result = fallback as readonly OptionKV[];
    const entry = { data: result, fetchedAt: Date.now() };
    mem.breeds[key] = entry;
    await writeDisk(K.breeds(key), entry);
    return result;
  }
};
