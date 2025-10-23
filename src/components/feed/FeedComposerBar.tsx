import React from 'react';
import { Pressable, StyleSheet, View, Image as RNImage } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type Props = Readonly<{
  photoURL?: string; // solo avatar
  onPress: () => void;
}>;

const fallbackAvatar = require('@assets/images/user.png') as number;

const FeedComposerBar: React.FC<Props> = ({ photoURL, onPress }) => {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <RNImage
        source={photoURL ? { uri: photoURL } : fallbackAvatar}
        style={styles.avatar}
      />
      <View
        style={[
          styles.inputGhost,
          { backgroundColor: theme.colors.surfaceVariant, opacity: 0.6 },
        ]}
      >
        <Text variant="bodyMedium">¿Qué estás pensando?</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  // “burbuja” sin borde, como FB
  inputGhost: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
});

export default FeedComposerBar;
