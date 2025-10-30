import React, {
  useCallback,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  StyleSheet,
  Image,
  TextInput as RNTextInput,
} from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';

type Props = Readonly<{
  disabled?: boolean;
  onSubmit: (text: string) => void | Promise<void>;
  avatarURL?: string | null;
}>;

const defaultAvatar = require('@assets/images/user.png') as number;

const CommentComposer = forwardRef<RNTextInput, Props>(function CommentComposer(
  { disabled = false, onSubmit, avatarURL = null },
  ref,
) {
  const theme = useTheme();
  const inputRef = useRef<RNTextInput>(null);
  useImperativeHandle(ref, () => inputRef.current as RNTextInput);

  const [text, setText] = useState('');

  const handleSend = useCallback(async () => {
    const v = text.trim();
    if (!v || disabled) return;
    try {
      await onSubmit(v);
      setText('');
      // Mantener teclado abierto (como en Feed)
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch {
      /* manejo arriba */
    }
  }, [text, disabled, onSubmit]);

  return (
    <View style={styles.row} pointerEvents="box-none">
      <Image
        source={avatarURL ? { uri: avatarURL } : defaultAvatar}
        style={styles.avatar}
      />
      <TextInput
        ref={inputRef}
        mode="outlined"
        dense
        placeholder={
          disabled ? 'Inicia sesión para comentar' : 'Escribe un comentario…'
        }
        value={text}
        onChangeText={setText}
        editable={!disabled}
        returnKeyType="send"
        blurOnSubmit={false}
        onSubmitEditing={handleSend}
        style={styles.input}
        outlineStyle={styles.inputOutline} // borde redondeado
        contentStyle={styles.inputContent} // alto compacto y centrado
        right={
          <TextInput.Icon
            icon="send"
            onPress={handleSend}
            forceTextInputFocus // 👈 evita blur en iOS
            disabled={disabled || text.trim().length === 0}
            accessibilityLabel="Enviar comentario"
          />
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e7e7e7',
    marginRight: 8,
  },
  input: { flex: 1 },
  inputOutline: { borderRadius: 24 },
  inputContent: { minHeight: 40, paddingVertical: 6 },
});

export default CommentComposer;
