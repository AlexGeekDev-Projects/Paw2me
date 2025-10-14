import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, TextInput, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import { resetPassword } from '@services/authService';
import { appLogo } from '@assets/images';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = () => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSend = async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setMsg('Revisa tu correo para continuar.');
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo enviar el correo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={appLogo} style={styles.logo} resizeMode="contain" />
      <Text variant="headlineSmall" style={styles.title}>
        Recuperar contraseña
      </Text>
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      {err ? <Text style={styles.error}>{err}</Text> : null}
      {msg ? <Text style={styles.ok}>{msg}</Text> : null}

      <Button
        mode="contained"
        onPress={onSend}
        loading={busy}
        disabled={busy}
        style={styles.btn}
      >
        Enviar correo
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 160, height: 160, marginBottom: 12 },
  title: { marginBottom: 8 },
  input: { width: '100%', marginBottom: 8 },
  btn: { width: '100%', marginTop: 4 },
  error: { color: '#b00020', alignSelf: 'flex-start', marginBottom: 8 },
  ok: { color: '#0a7d34', alignSelf: 'flex-start', marginBottom: 8 },
});

export default ForgotPasswordScreen;
