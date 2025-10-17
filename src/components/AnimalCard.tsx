import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Pressable, Dimensions } from 'react-native';
import type { ImageStyle } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import type { AnimalCardVM } from '@models/animal';

interface Props {
  data: AnimalCardVM;
  onPress?: (id: string) => void;
}

const AnimalCard: React.FC<Props> = ({ data, onPress }) => {
  const [aspectRatio, setAspectRatio] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (data.coverUrl) {
      Image.getSize(
        data.coverUrl,
        (width, height) => {
          if (width > 0 && height > 0) {
            setAspectRatio(width / height);
          }
        },
        () => {
          setAspectRatio(undefined);
        },
      );
    }
  }, [data.coverUrl]);

  return (
    <Pressable onPress={() => onPress?.(data.id)}>
      <Card style={styles.card} mode="contained">
        {data.coverUrl ? (
          <Image
            source={{ uri: data.coverUrl }}
            style={[
              styles.coverBase,
              aspectRatio ? { aspectRatio } : styles.coverFallback,
            ]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverBase, styles.coverFallback]} />
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
            {data.urgent && (
              <Chip compact mode="outlined" style={styles.urgent}>
                Urgente
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  coverBase: {
    width: '100%',
    backgroundColor: '#eee',
  },
  coverFallback: {
    height: 200,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginRight: 6,
    marginBottom: 4,
  },
  urgent: {
    borderColor: '#D33',
    marginLeft: 'auto',
  },
});

export default AnimalCard;
