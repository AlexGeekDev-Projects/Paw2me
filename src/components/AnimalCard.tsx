import React from 'react';
import { View, Image, StyleSheet, Pressable } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import type { AnimalCardVM } from '@models/animal';

interface Props {
  data: AnimalCardVM;
  onPress?: (id: string) => void;
}

const AnimalCard: React.FC<Props> = ({ data, onPress }) => {
  return (
    <Pressable onPress={() => onPress?.(data.id)}>
      <Card style={styles.card} mode="contained">
        {data.coverUrl ? (
          <Image source={{ uri: data.coverUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]} />
        )}
        <Card.Content>
          <Text variant="titleMedium">{data.name}</Text>
          <Text variant="bodySmall">
            {data.species}
            {data.city ? ` • ${data.city}` : ''}
          </Text>
          <View style={styles.row}>
            {data.chips.slice(0, 3).map(c => (
              <Chip key={c} compact style={styles.chip}>
                {c}
              </Chip>
            ))}
            {data.urgent ? (
              <Chip compact mode="outlined" style={styles.urgent}>
                Urgente
              </Chip>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginVertical: 8, borderRadius: 16 },
  cover: {
    width: '100%',
    height: 180,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  coverFallback: { backgroundColor: '#eee' },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
  chip: { marginRight: 6, marginBottom: 4 },
  urgent: { borderColor: '#D33', marginLeft: 'auto' },
});

export default AnimalCard;
