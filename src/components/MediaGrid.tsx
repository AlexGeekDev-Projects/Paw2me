import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface Props {
  urls: string[];
}

const MediaGrid: React.FC<Props> = ({ urls }) => {
  return (
    <View style={styles.grid}>
      {urls.map(u => (
        <Image key={u} source={{ uri: u }} style={styles.img} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  img: { width: '48%', aspectRatio: 1, borderRadius: 12 },
});

export default MediaGrid;
