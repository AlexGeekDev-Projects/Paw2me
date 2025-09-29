import { create } from 'zustand';
import type { Species, Size, AdoptionStatus } from '@models/animal';

export type FiltersState = {
  text: string;
  species: Species | null;
  size: Size | null;
  status: AdoptionStatus | null;
  city: string | null;

  reset: () => void;
  setText: (v: string) => void;
  setSpecies: (v: Species | null) => void;
  setSize: (v: Size | null) => void;
  setStatus: (v: AdoptionStatus | null) => void;
  setCity: (v: string | null) => void;
};

export const useFiltersStore = create<FiltersState>(set => ({
  text: '',
  species: null,
  size: null,
  status: null,
  city: null,

  reset: () =>
    set({
      text: '',
      species: null,
      size: null,
      status: null,
      city: null,
    }),

  setText: v => set({ text: v }),
  setSpecies: v => set({ species: v }),
  setSize: v => set({ size: v }),
  setStatus: v => set({ status: v }),
  setCity: v => set({ city: v }),
}));
