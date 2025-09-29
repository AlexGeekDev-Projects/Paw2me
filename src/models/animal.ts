export type Species =
  | 'dog'
  | 'cat'
  | 'rabbit'
  | 'bird'
  | 'reptile'
  | 'rodent'
  | 'mini_pig'
  | 'horse'
  | 'other';

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type Sex = 'male' | 'female' | 'unknown';

export type AdoptionStatus =
  | 'urgent'
  | 'ready'
  | 'under_treatment'
  | 'in_process'
  | 'adopted';
export type Temperament =
  | 'calm'
  | 'playful'
  | 'active'
  | 'shy'
  | 'protective'
  | 'independent';

export type Compatibility = {
  kids?: boolean;
  dogs?: boolean;
  cats?: boolean;
  seniors?: boolean;
};

export type Location = {
  country: string;
  state?: string;
  city?: string;
  lat?: number;
  lng?: number;
};

export type Animal = {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  size: Size;
  ageYears?: number;
  ageLabel?: 'puppy' | 'young' | 'adult' | 'senior';
  sex: Sex;
  status: AdoptionStatus;
  sterilized?: boolean;
  vaccinated?: boolean;
  specialCondition?: string;
  temperament?: Temperament[];
  compatibility?: Compatibility;
  location: Location;
  ownerRef: { type: 'user' | 'shelter'; id: string };
  media: { images: string[]; videos?: string[] };
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};
