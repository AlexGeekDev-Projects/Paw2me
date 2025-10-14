import { useEffect, useState, useCallback } from 'react';
import type { OptionKV } from '@models/meta';
import { getCountries, getCities, getBreeds } from '@services/metaService';
import type { Species } from '@models/animal';

interface UseOptionsResult {
  options: readonly OptionKV[];
  loading: boolean;
  refresh: () => void;
}

export const useCountryOptions = (): UseOptionsResult => {
  const [options, setOptions] = useState<readonly OptionKV[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const load = useCallback(async () => {
    setLoading(true);
    const res = await getCountries();
    setOptions(res);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { options, loading, refresh: () => void load() };
};

export const useCityOptions = (
  countryCode: string | undefined,
): UseOptionsResult => {
  const [options, setOptions] = useState<readonly OptionKV[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const load = useCallback(async () => {
    if (!countryCode) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const res = await getCities(countryCode);
    setOptions(res);
    setLoading(false);
  }, [countryCode]);
  useEffect(() => {
    void load();
  }, [load]);
  return { options, loading, refresh: () => void load() };
};

export const useBreedOptions = (
  species: Species | undefined,
): UseOptionsResult => {
  const [options, setOptions] = useState<readonly OptionKV[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const load = useCallback(async () => {
    if (!species) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const res = await getBreeds(species);
    setOptions(res);
    setLoading(false);
  }, [species]);
  useEffect(() => {
    void load();
  }, [load]);
  return { options, loading, refresh: () => void load() };
};
