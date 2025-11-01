// src/components/explore/SpeciesChips.tsx
import React, { memo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Chip, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import type { Species } from '@models/animal';

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

type Props = Readonly<{
  species?: Species | null;
  urgent?: boolean;
  onToggleSpecies: (s: Species) => void;
  onToggleUrgent: () => void;
  syncing: boolean;
}>;

const SpeciesChips: React.FC<Props> = memo(
  ({ species, urgent, onToggleSpecies, onToggleUrgent, syncing }) => {
    const theme = useTheme();
    return (
      <View
        style={[
          styles.stickyWrap,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          contentContainerStyle={styles.chipsScroll}
        >
          {SPECIES_META.map(s => {
            const selected = species === s.key;
            return (
              <Chip
                compact
                key={s.key}
                selected={selected}
                onPress={() => onToggleSpecies(s.key)}
                icon={selected ? 'check' : s.icon}
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: theme.colors.primaryContainer }
                    : {},
                ]}
                textStyle={
                  selected
                    ? {
                        color: theme.colors.onPrimaryContainer,
                        fontWeight: '700',
                      }
                    : undefined
                }
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                {s.label}
              </Chip>
            );
          })}

          <Chip
            compact
            selected={Boolean(urgent)}
            onPress={onToggleUrgent}
            icon={urgent ? 'check' : 'alert'}
            style={[
              styles.chip,
              urgent ? { backgroundColor: theme.colors.primaryContainer } : {},
            ]}
            textStyle={
              urgent
                ? {
                    color: theme.colors.onPrimaryContainer,
                    fontWeight: '700',
                  }
                : undefined
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: Boolean(urgent) }}
          >
            Urgente
          </Chip>
        </ScrollView>

        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.syncText}>Actualizando resultados…</Text>
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  stickyWrap: {
    zIndex: 10,
    elevation: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },
  chipsScroll: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 8,
  },
  chip: { marginRight: 8 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  syncText: { opacity: 0.7, fontSize: 12 },
});

export default SpeciesChips;
