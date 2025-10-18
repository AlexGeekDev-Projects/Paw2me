export type AnimalStatus = 'disponible' | 'en_proceso' | 'adoptado' | 'oculto';

export type Species =
  | 'perro'
  | 'gato'
  | 'conejo'
  | 'ave'
  | 'reptil'
  | 'roedor'
  | 'cerdo_mini'
  | 'caballo'
  | 'otro';

export interface AnimalCore {
  name: string;
  species: Species;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL';
  sex: 'macho' | 'hembra';
  ageMonths: number;
  ageUnknown?: boolean;
  mixedBreed: boolean;
  breed?: string;
  sterilized: boolean;
  vaccinated: boolean;
  temperament?: string;
  compatibility?: {
    kids?: boolean;
    dogs?: boolean;
    cats?: boolean;
    seniors?: boolean;
  };
  location: {
    country?: string;
    state?: string;
    city?: string;
    geo?: { lat: number; lng: number };
  };
  address?: string;
  story?: string;
}

export interface AnimalDoc extends AnimalCore {
  id: string;
  status: AnimalStatus;
  urgent?: boolean;
  ownerType: 'persona' | 'refugio';
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
  coverUrl?: string;
  mediaCount?: number;
  pawId?: string;
  createdByPlatform?: 'ios' | 'android' | 'web';
  visibility?: 'public' | 'hidden' | 'banned';
  tags?: string[];
  address?: string;
  images?: string[]; // ← nuevo
  matchCount?: number; // ← reemplazo de favoriteCount
}

export type NewAnimalInput = Omit<AnimalDoc, 'id' | 'createdAt' | 'updatedAt'>;

export interface AnimalCardVM {
  id: string;
  name: string;
  species: Species;
  status: AnimalStatus;
  chips: string[];
  city?: string;
  coverUrl?: string;
  urgent?: boolean;
}
