// src/store/useExploreFiltersStore.ts
import { create } from 'zustand';
import type { AnimalDoc, Species } from '@models/animal';

// Tipos base
export type Size = AnimalDoc['size'];

export type ExploreFilters = Readonly<{
  species?: Species;
  size?: Size;
  city?: string;
  urgent?: true;
  text?: string;
  distanceKm?: number; // radio de búsqueda
  center?: { lat: number; lng: number } | null; // null si no hay ubicación
}>;

type State = Readonly<{ filters: ExploreFilters }>;

type Actions = {
  setText: (q: string) => void;
  toggleSpecies: (s: Species) => void;
  setSize: (sz: Size | null) => void;
  setCity: (city: string | null) => void;
  toggleUrgent: () => void;
  setDistanceKm: (km: number) => void;
  setCenter: (c: { lat: number; lng: number } | null) => void;
  clearAll: () => void;
  buildParams: () => Record<string, unknown>;
};

export const useExploreFiltersStore = create<State & Actions>((set, get) => ({
  filters: {},
  setText: q =>
    set(({ filters }) => {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        const { text, ...rest } = filters;
        return { filters: rest };
      }
      return { filters: { ...filters, text: trimmed } };
    }),
  toggleSpecies: s =>
    set(({ filters }) =>
      filters.species === s
        ? (() => {
            const { species, ...rest } = filters;
            return { filters: rest };
          })()
        : { filters: { ...filters, species: s } },
    ),
  setSize: sz =>
    set(({ filters }) => {
      if (!sz) {
        const { size, ...rest } = filters;
        return { filters: rest };
      }
      return { filters: { ...filters, size: sz } };
    }),
  setCity: city =>
    set(({ filters }) => {
      if (!city) {
        const { city: _c, ...rest } = filters;
        return { filters: rest };
      }
      const trimmed = city.trim();
      if (trimmed.length === 0) {
        const { city: _c2, ...rest } = filters;
        return { filters: rest };
      }
      return { filters: { ...filters, city: trimmed } };
    }),
  toggleUrgent: () =>
    set(({ filters }) =>
      filters.urgent
        ? (() => {
            const { urgent, ...rest } = filters;
            return { filters: rest };
          })()
        : { filters: { ...filters, urgent: true } },
    ),
  setDistanceKm: km =>
    set(({ filters }) => {
      const value = Math.max(1, Math.min(250, Math.round(km)));
      return { filters: { ...filters, distanceKm: value } };
    }),
  setCenter: c =>
    set(({ filters }) => {
      if (!c) {
        const { center, ...rest } = filters;
        return { filters: rest };
      }
      return { filters: { ...filters, center: c } };
    }),
  clearAll: () => set({ filters: {} }),
  buildParams: () => {
    const { filters } = get();
    return {
      ...(filters.species ? { species: filters.species } : {}),
      ...(filters.size ? { size: filters.size } : {}),
      ...(filters.city ? { city: filters.city } : {}),
      ...(filters.urgent ? { urgent: true } : {}),
      ...(filters.text ? { text: filters.text } : {}),
      ...(typeof filters.distanceKm === 'number'
        ? { distanceKm: filters.distanceKm }
        : {}),
      ...(filters.center ? { center: filters.center } : {}),
    };
  },
}));
