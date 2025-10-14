import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, TextInput, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import { signUpEmail } from '@services/authService';
import { appLogo } from '@assets/images';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC<Props> = () => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onRegister = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signUpEmail(email.trim(), pass);
    } catch (e: any) {
      setErr(e?.message ?? 'Error al registrarse');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={appLogo} style={styles.logo} resizeMode="contain" />
      <Text variant="headlineSmall" style={styles.title}>
        Crear cuenta
      </Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        label="Contraseña"
        value={pass}
        onChangeText={setPass}
        secureTextEntry
        style={styles.input}
      />

      {err ? <Text style={styles.error}>{err}</Text> : null}

      <Button
        mode="contained"
        onPress={onRegister}
        loading={busy}
        disabled={busy}
        style={styles.btn}
      >
        Registrarme
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
});

export default RegisterScreen;
