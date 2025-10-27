// src/components/comments/CommentComposer.tsx
import React, { memo, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { IconButton, TextInput, useTheme } from 'react-native-paper';

const defaultAvatar = require('@assets/images/user.png') as number;

type Props = Readonly<{
  disabled?: boolean;
  onSubmit: (text: string) => void | Promise<void>;
  avatarURL?: string | null;
}>;

const CommentComposer: React.FC<Props> = ({
  disabled = false,
  onSubmit,
  avatarURL,
}) => {
  const theme = useTheme();
  const [text, setText] = useState('');

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await onSubmit(t);
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: 'rgba(0,0,0,0.08)',
        },
      ]}
    >
      <Image
        source={avatarURL ? { uri: avatarURL } : (defaultAvatar as number)}
        style={styles.avatar}
      />

      <TextInput
        mode="outlined"
        placeholder="Escribe un comentario…"
        value={text}
        onChangeText={setText}
        style={styles.input}
        contentStyle={{ paddingVertical: 8 }}
        dense
        multiline
        disabled={disabled}
        outlineStyle={{ borderRadius: 24 }}
      />

      <IconButton
        icon="send"
        size={22}
        onPress={send}
        disabled={disabled || !text.trim()}
        style={styles.send}
        accessibilityLabel="Enviar comentario"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#ddd',
  },
  input: { flex: 1 },
  send: { marginLeft: 4 },
});

export default memo(CommentComposer);
