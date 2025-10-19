// src/components/explore/FiltersModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Portal,
  Modal,
  Surface,
  Text,
  Chip,
  Button,
  ActivityIndicator,
  useTheme,
  Switch,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
import type { Size } from '@store/useExploreFiltersStore';
import type { Species } from '@models/animal';
import { useUserLocation } from '@hooks/useUserLocation';

export type FiltersModalProps = Readonly<{
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
}>;

const SIZES: ReadonlyArray<Size> = ['XS', 'S', 'M', 'L', 'XL'];
const SPECIES_META: Array<{ key: Species; label: string; icon: string }> = [
  { key: 'perro', label: 'Perros', icon: 'dog' },
  { key: 'gato', label: 'Gatos', icon: 'cat' },
  { key: 'conejo', label: 'Conejos', icon: 'rabbit' },
  { key: 'ave', label: 'Aves', icon: 'bird' },
  { key: 'reptil', label: 'Reptiles', icon: 'snake' },
  { key: 'roedor', label: 'Roedores', icon: 'rodent' },
  { key: 'cerdo_mini', label: 'Mini cerdo', icon: 'pig-variant' },
  { key: 'caballo', label: 'Caballos', icon: 'horse' },
  { key: 'otro', label: 'Otros', icon: 'paw' },
];

const DEFAULT_DISTANCE_KM = 50;

const FiltersModal: React.FC<FiltersModalProps> = ({
  visible,
  onClose,
  onApply,
}) => {
  const theme = useTheme();
  const {
    filters,
    toggleSpecies,
    setSize,
    toggleUrgent,
    setDistanceKm,
    clearAll,
    setCenter,
    clearDistance,
  } = useExploreFiltersStore();
  const { locateMe, locating, error } = useUserLocation();

  const [localSpecies, setLocalSpecies] = useState<Species | null>(
    filters.species ?? null,
  );
  const [localSize, setLocalSize] = useState<Size | null>(filters.size ?? null);
  const [localUrgent, setLocalUrgent] = useState<boolean>(
    Boolean(filters.urgent),
  );

  const [localDistanceEnabled, setLocalDistanceEnabled] = useState<boolean>(
    typeof filters.distanceKm === 'number' &&
      filters.distanceWasExplicit === true,
  );
  const [localDistanceKm, setLocalDistanceKm] = useState<number>(
    typeof filters.distanceKm === 'number' &&
      filters.distanceWasExplicit === true
      ? (filters.distanceKm as number)
      : DEFAULT_DISTANCE_KM,
  );

  // sincroniza UI local al abrir
  useEffect(() => {
    if (!visible) return;
    setLocalSpecies(filters.species ?? null);
    setLocalSize(filters.size ?? null);
    setLocalUrgent(Boolean(filters.urgent));
    const enabled =
      typeof filters.distanceKm === 'number' &&
      filters.distanceWasExplicit === true;
    setLocalDistanceEnabled(enabled);
    setLocalDistanceKm(
      enabled ? (filters.distanceKm as number) : DEFAULT_DISTANCE_KM,
    );
  }, [
    visible,
    filters.species,
    filters.size,
    filters.urgent,
    filters.distanceKm,
    filters.distanceWasExplicit,
  ]);

  // obtener center “suave” al habilitar distancia
  const attemptedRef = useRef(false);
  useEffect(() => {
    if (
      visible &&
      localDistanceEnabled &&
      !filters.center &&
      !attemptedRef.current
    ) {
      attemptedRef.current = true;
      (async () => {
        try {
          const pos = await locateMe();
          if (
            pos &&
            typeof pos.lat === 'number' &&
            typeof pos.lng === 'number'
          ) {
            setCenter({ lat: pos.lat, lng: pos.lng });
          }
        } catch {}
      })();
    }
    if (!visible) attemptedRef.current = false;
  }, [visible, localDistanceEnabled, filters.center, locateMe, setCenter]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalWrap}
      >
        <Surface style={styles.card} elevation={3}>
          <Text variant="titleLarge" style={styles.title}>
            Filtros
          </Text>

          <Text variant="labelLarge" style={styles.section}>
            Especie
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {SPECIES_META.map(s => (
              <Chip
                key={s.key}
                selected={localSpecies === s.key}
                onPress={() =>
                  setLocalSpecies(prev => (prev === s.key ? null : s.key))
                }
                icon={s.icon}
                style={styles.chip}
              >
                {s.label}
              </Chip>
            ))}
            <Chip
              selected={localUrgent}
              onPress={() => setLocalUrgent(v => !v)}
              icon="alert"
              style={styles.chip}
            >
              Urgente
            </Chip>
          </ScrollView>

          <Text variant="labelLarge" style={styles.section}>
            Tamaño
          </Text>
          <View style={styles.rowWrap}>
            {SIZES.map(sz => (
              <Chip
                key={sz}
                selected={localSize === sz}
                onPress={() => setLocalSize(prev => (prev === sz ? null : sz))}
              >
                {sz}
              </Chip>
            ))}
          </View>

          <Text variant="labelLarge" style={styles.section}>
            Distancia
          </Text>

          <View style={styles.switchRow}>
            <Text>Filtrar por distancia</Text>
            <Switch
              value={localDistanceEnabled}
              onValueChange={async next => {
                setLocalDistanceEnabled(next);
                if (next && !filters.center) {
                  try {
                    const pos = await locateMe();
                    if (
                      pos &&
                      typeof pos.lat === 'number' &&
                      typeof pos.lng === 'number'
                    ) {
                      setCenter({ lat: pos.lat, lng: pos.lng });
                    }
                  } catch {}
                }
              }}
            />
          </View>

          <View style={styles.sliderRow}>
            <Slider
              minimumValue={1}
              maximumValue={250}
              step={1}
              value={
                localDistanceEnabled ? localDistanceKm : DEFAULT_DISTANCE_KM
              }
              onValueChange={v =>
                setLocalDistanceKm(
                  Math.max(
                    1,
                    Math.min(250, Math.round(Array.isArray(v) ? v[0] : v)),
                  ),
                )
              }
              style={styles.slider}
              disabled={!localDistanceEnabled}
            />
            <Text
              variant="titleMedium"
              style={[
                styles.kmValue,
                !localDistanceEnabled && { opacity: 0.4 },
              ]}
            >
              {localDistanceEnabled ? localDistanceKm : DEFAULT_DISTANCE_KM}
            </Text>
          </View>

          {localDistanceEnabled ? (
            <View style={styles.locationRow}>
              {locating && !filters.center ? (
                <>
                  <ActivityIndicator />
                  <Text variant="bodySmall" style={styles.locationText}>
                    Obteniendo tu ubicación…
                  </Text>
                </>
              ) : error && !filters.center ? (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.error, marginLeft: 0 }}
                >
                  {error}
                </Text>
              ) : filters.center ? (
                <Text variant="bodySmall" style={styles.locationText}>
                  Buscando cerca de tu ubicación
                </Text>
              ) : (
                <Text variant="bodySmall" style={styles.locationText}>
                  Activa la distancia para ajustar el radio
                </Text>
              )}
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button
              mode="text"
              onPress={() => {
                clearAll();
                setLocalSpecies(null);
                setLocalSize(null);
                setLocalUrgent(false);
                setLocalDistanceEnabled(false);
                setLocalDistanceKm(DEFAULT_DISTANCE_KM);
              }}
            >
              Limpiar
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                // species
                if (localSpecies !== filters.species) {
                  if (localSpecies == null && filters.species) {
                    // quitar especie activa
                    toggleSpecies(filters.species);
                  } else if (localSpecies) {
                    toggleSpecies(localSpecies);
                  }
                }
                // size
                if (localSize !== filters.size) setSize(localSize);

                // urgent
                const storeUrgent = Boolean(filters.urgent);
                if (localUrgent !== storeUrgent) toggleUrgent();

                // distance
                if (localDistanceEnabled) setDistanceKm(localDistanceKm);
                else clearDistance();

                onApply();
                onClose();
              }}
            >
              Aplicar
            </Button>
          </View>
        </Surface>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalWrap: { padding: 16 },
  card: { borderRadius: 16, padding: 16 },
  title: { marginBottom: 8, fontWeight: '700' },
  section: { marginTop: 8, marginBottom: 6 },

  chipsScroll: { paddingVertical: 4, paddingRight: 8, alignItems: 'center' },
  chip: { marginRight: 8 },

  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  slider: { flex: 1 },
  kmValue: { minWidth: 48, textAlign: 'right' },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 20,
  },
  locationText: { opacity: 0.75 },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});

export default FiltersModal;
