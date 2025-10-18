// src/components/explore/FiltersModal.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Portal,
  Modal,
  Surface,
  Text,
  Chip,
  Button,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useExploreFiltersStore } from '@store/useExploreFiltersStore';
import type { Size } from '@store/useExploreFiltersStore';
import { useUserLocation } from '@hooks/useUserLocation';

export type FiltersModalProps = Readonly<{
  visible: boolean;
  onClose: () => void;
  onApply: () => void; // disparará recarga en el screen
}>;

const SIZES: ReadonlyArray<Size> = ['XS', 'S', 'M', 'L', 'XL'];

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
  } = useExploreFiltersStore();
  const { locateMe, locating, error } = useUserLocation();

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
          <View style={styles.rowWrap}>
            <Chip
              selected={filters.species === 'perro'}
              onPress={() => toggleSpecies('perro')}
              icon="dog"
            >
              Perros
            </Chip>
            <Chip
              selected={filters.species === 'gato'}
              onPress={() => toggleSpecies('gato')}
              icon="cat"
            >
              Gatos
            </Chip>
          </View>

          <Text variant="labelLarge" style={styles.section}>
            Tamaño
          </Text>
          <View style={styles.rowWrap}>
            {SIZES.map(sz => (
              <Chip
                key={sz}
                selected={filters.size === sz}
                onPress={() => setSize(filters.size === sz ? null : sz)}
              >
                {sz}
              </Chip>
            ))}
          </View>

          <Text variant="labelLarge" style={styles.section}>
            Urgencia
          </Text>
          <View style={styles.rowWrap}>
            <Chip
              selected={Boolean(filters.urgent)}
              onPress={toggleUrgent}
              icon="alert"
            >
              Urgente
            </Chip>
          </View>

          <Text variant="labelLarge" style={styles.section}>
            Distancia (km)
          </Text>
          <View style={styles.sliderRow}>
            <Slider
              minimumValue={1}
              maximumValue={250}
              step={1}
              value={
                typeof filters.distanceKm === 'number' ? filters.distanceKm : 50
              }
              onValueChange={v => setDistanceKm(Array.isArray(v) ? v[0] : v)}
              style={styles.slider}
            />
            <Text variant="titleMedium" style={styles.kmValue}>
              {typeof filters.distanceKm === 'number' ? filters.distanceKm : 50}
            </Text>
          </View>

          <View
            style={[styles.rowWrap, { alignItems: 'center', marginTop: 8 }]}
          >
            <Button
              mode="outlined"
              icon="crosshairs-gps"
              onPress={() => void locateMe()}
              disabled={locating}
            >
              {locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
            </Button>
            {locating ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
          </View>
          {error ? (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.error, marginTop: 6 }}
            >
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button mode="text" onPress={clearAll}>
              Limpiar
            </Button>
            <Button
              mode="contained"
              onPress={() => {
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
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  slider: { flex: 1 },
  kmValue: { minWidth: 48, textAlign: 'right' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});

export default FiltersModal;
