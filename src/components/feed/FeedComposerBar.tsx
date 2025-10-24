import React from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

type Props = Readonly<{
  name?: string;
  photoURL?: string;
  onPress: () => void;
}>;

const defaultAvatar = require('@assets/images/user.png') as number;

const FeedComposerBar: React.FC<Props> = ({ name, photoURL, onPress }) => {
  const theme = useTheme();
  const first = (name ?? 'Usuario').split(' ')[0];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surface,
          borderColor: 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      <Image
        source={photoURL ? { uri: photoURL } : (defaultAvatar as number)}
        style={styles.avatar}
      />
      <View style={styles.inputFake}>
        <Text variant="bodyMedium" style={{ opacity: 0.6 }}>
          ¿Qué estás pensando, {first}?
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#ddd',
  },
  inputFake: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});

export default FeedComposerBar;
