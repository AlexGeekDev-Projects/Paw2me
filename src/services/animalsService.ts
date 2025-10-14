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

// ✅ util público para generar ID de animal
export const newAnimalId = () => doc(collection(getFirestore(), 'animals')).id;

export const animalsColRef = () => collection(getFirestore(), 'animals');

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

export const listAnimalsPublic = async (opts?: {
  limit?: number;
  status?: 'disponible' | 'en_proceso';
  city?: string;
  species?: AnimalDoc['species'];
}) => {
  const q = query(
    animalsColRef(),
    orderBy('createdAt', 'desc'),
    ...(opts?.status
      ? [where('status', '==', opts.status)]
      : [where('status', 'in', ['disponible', 'en_proceso'])]),
    ...(opts?.city ? [where('location.city', '==', opts.city)] : []),
    ...(opts?.species ? [where('species', '==', opts.species)] : []),
    ...(opts?.limit ? [limit(opts.limit)] : []),
  );

  const snap = await getDocs(q);
  const items: AnimalDoc[] = snap.docs.map(
    (
      d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
    ) => {
      const data = d.data() as Omit<AnimalDoc, 'id'>;
      return { id: d.id, ...data };
    },
  );
  return { items, cards: items.map(toCard) };
};

export const getAnimalById = async (id: string) => {
  const ref = doc(getFirestore(), 'animals', id);
  const s = await getDoc(ref);
  if (!s.exists()) return undefined;
  return { id: s.id, ...(s.data() as Omit<AnimalDoc, 'id'>) };
};

export const createAnimal = async (id: string, input: NewAnimalInput) => {
  const refDoc = doc(getFirestore(), 'animals', id);
  const now = nowTs();

  const payload: Record<string, unknown> = {
    ...input, // location incluido tal cual
    createdAt: now,
    updatedAt: now,
    ...(typeof input.mediaCount === 'number'
      ? { mediaCount: input.mediaCount }
      : {}),
    ...(input.coverUrl ? { coverUrl: input.coverUrl } : {}),
  };

  await setDoc(refDoc, payload);
};

export const updateAnimalPartial = async (
  id: string,
  patch: Partial<NewAnimalInput>,
) => {
  const refDoc = doc(getFirestore(), 'animals', id);
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  await setDoc(refDoc, { ...clean, updatedAt: nowTs() }, { merge: true });
};

// 👉 Exporta tipos/funciones que faltaban
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
