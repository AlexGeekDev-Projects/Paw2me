import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnimalDoc, Species } from '@models/animal';

export type Size = AnimalDoc['size'];

export type ExploreFilters = Readonly<{
  species?: Species;
  size?: Size;
  city?: string;
  cityWasExplicit?: true; // ← solo contamos ciudad si el usuario la puso
  urgent?: true; // ← literal true si existe
  text?: string;
  distanceKm?: number;
  distanceWasExplicit?: true; // ← literal true si existe
  center?: { lat: number; lng: number } | null; // dato técnico, no filtro
}>;

type State = Readonly<{
  filters: ExploreFilters;
  lastApplied?: ExploreFilters;
}>;

type Actions = {
  setText: (q: string) => void;
  toggleSpecies: (s: Species) => void;
  setSize: (sz: Size | null) => void;
  setCityByUser: (city: string | null) => void;
  toggleUrgent: () => void;
  setDistanceKm: (km: number) => void;
  clearDistance: () => void;
  clearAll: () => void;

  // técnico (no toca lastApplied)
  setCenter: (c: { lat: number; lng: number } | null) => void;

  restoreFromLastApplied: () => void;

  buildParams: () => Record<string, unknown>;
};

const clampKm = (km: number) => Math.max(1, Math.min(250, Math.round(km)));

/** Quita claves `undefined` y respeta banderas “wasExplicit” */
const sanitize = (
  f: Partial<ExploreFilters>,
  requireExplicitForDistance: boolean,
): ExploreFilters => {
  const base: ExploreFilters = {
    ...(f.species ? { species: f.species } : {}),
    ...(f.size ? { size: f.size } : {}),
    ...(f.urgent ? { urgent: true as const } : {}),
    ...(f.text ? { text: f.text } : {}),
    ...(typeof f.center !== 'undefined' ? { center: f.center ?? null } : {}),
    ...(f.city && f.cityWasExplicit === true
      ? { city: f.city, cityWasExplicit: true as const }
      : {}),
  };

  const hasValidKm =
    typeof f.distanceKm === 'number' && !Number.isNaN(f.distanceKm);

  const allowDistance = hasValidKm
    ? requireExplicitForDistance
      ? f.distanceWasExplicit === true
      : true
    : false;

  if (allowDistance) {
    return {
      ...base,
      distanceKm: clampKm(f.distanceKm!),
      distanceWasExplicit: true as const,
    };
  }
  return base;
};

/** Siempre guarda objetos ya saneados (evita `city: undefined` & co.) */
const withLast = (next: Partial<ExploreFilters>): Partial<State> => {
  const clean = sanitize(next, true);
  return { filters: clean, lastApplied: clean };
};

export const useExploreFiltersStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      filters: {},
      lastApplied: {},

      setText: q =>
        set(({ filters }) => {
          const trimmed = q.trim();
          if (!trimmed) {
            const { text, ...rest } = filters;
            return withLast(rest);
          }
          return withLast({ ...filters, text: trimmed });
        }),

      toggleSpecies: s =>
        set(({ filters }) => {
          if (filters.species === s) {
            const { species, ...rest } = filters;
            return withLast(rest);
          }
          return withLast({ ...filters, species: s });
        }),

      setSize: sz =>
        set(({ filters }) => {
          if (!sz) {
            const { size, ...rest } = filters;
            return withLast(rest);
          }
          return withLast({ ...filters, size: sz });
        }),

      setCityByUser: city =>
        set(({ filters }) => {
          if (!city || !city.trim()) {
            const { city: _c, cityWasExplicit: _e, ...rest } = filters;
            return withLast(rest);
          }
          return withLast({
            ...filters,
            city: city.trim(),
            cityWasExplicit: true as const,
          });
        }),

      toggleUrgent: () =>
        set(({ filters }) => {
          if (filters.urgent) {
            const { urgent, ...rest } = filters;
            return withLast(rest);
          }
          return withLast({ ...filters, urgent: true as const });
        }),

      setDistanceKm: km =>
        set(({ filters }) =>
          withLast({
            ...filters,
            distanceKm: clampKm(km),
            distanceWasExplicit: true as const,
          }),
        ),

      clearDistance: () =>
        set(({ filters }) => {
          const { distanceKm, distanceWasExplicit, ...rest } = filters;
          return withLast(rest);
        }),

      clearAll: () =>
        set(({ filters }) => {
          const { center } = filters;
          return withLast(typeof center !== 'undefined' ? { center } : {});
        }),

      // técnico: no toca lastApplied, pero sí sanea
      setCenter: c =>
        set(({ filters }) => {
          const merged =
            typeof c === 'undefined' || c === null
              ? (() => {
                  const { center, ...rest } = filters;
                  return rest;
                })()
              : { ...filters, center: c };
          return { filters: sanitize(merged, true) };
        }),

      restoreFromLastApplied: () =>
        set(({ lastApplied }) => {
          if (!lastApplied) return {};
          return { filters: sanitize(lastApplied, true) };
        }),

      buildParams: () => {
        const { filters } = get();

        const hasDistance =
          typeof filters.distanceKm === 'number' &&
          filters.distanceWasExplicit === true;

        const hasCity =
          typeof filters.city === 'string' &&
          filters.city.length > 0 &&
          filters.cityWasExplicit === true;

        return {
          ...(filters.species ? { species: filters.species } : {}),
          ...(filters.size ? { size: filters.size } : {}),
          ...(hasCity ? { city: filters.city as string } : {}),
          ...(filters.urgent ? { urgent: true } : {}),
          ...(filters.text ? { text: filters.text } : {}),
          ...(hasDistance ? { distanceKm: filters.distanceKm } : {}),
          ...(hasDistance && filters.center ? { center: filters.center } : {}),
        };
      },
    }),
    {
      name: 'explore-filters',
      version: 10,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: s => ({ filters: s.filters, lastApplied: s.lastApplied }),
      migrate: (persisted: any) => {
        const f = (persisted?.filters ?? {}) as Partial<ExploreFilters>;
        const la = (persisted?.lastApplied ?? {}) as Partial<ExploreFilters>;
        const filtersSan = sanitize(f, true);
        const lastSan = Object.keys(la).length
          ? sanitize(la, true)
          : filtersSan;
        return { filters: filtersSan, lastApplied: lastSan };
      },
      onRehydrateStorage: () => state => {
        try {
          const curr = (state as State) ?? { filters: {} as ExploreFilters };
          (useExploreFiltersStore as any).setState({
            filters: sanitize(curr.filters ?? {}, true),
            lastApplied: sanitize(curr.lastApplied ?? {}, true),
          });
        } catch {}
      },
    },
  ),
);
