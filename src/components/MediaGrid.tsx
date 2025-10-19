import React, { useState } from 'react';
import { View, StyleSheet, Image, Pressable, Dimensions } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { useTheme } from 'react-native-paper';

interface Props {
  urls: string[];
}

const MediaGrid: React.FC<Props> = ({ urls }) => {
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const spacing = 4;
  const columns = 3;

  const totalSpacing = spacing * (columns - 1);
  const usableWidth = screenWidth - totalSpacing;
  const itemSize = Math.floor(usableWidth / columns);

  const [index, setIndex] = useState<number | null>(null);

  if (!urls.length) return null;

  return (
    <>
      <View style={styles.grid}>
        {urls.map((url, i) => {
          const isLastInRow = (i + 1) % columns === 0;
          return (
            <Pressable
              key={i}
              onPress={() => setIndex(i)}
              style={{
                width: itemSize,
                height: itemSize,
                marginRight: isLastInRow ? 0 : spacing,
                marginBottom: spacing,
              }}
            >
              <Image
                source={{ uri: url }}
                style={styles.image}
                resizeMode="cover"
              />
            </Pressable>
          );
        })}
      </View>

      <ImageViewing
        images={urls.map(uri => ({ uri }))}
        imageIndex={index ?? 0}
        visible={index !== null}
        onRequestClose={() => setIndex(null)}
        backgroundColor={theme.dark ? '#000' : '#fff'}
      />
    </>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 0,
    marginTop: 8,
  },
  image: {
    borderRadius: 8,
    backgroundColor: '#ccc',
    width: '100%',
    height: '100%',
  },
});

export default MediaGrid;
