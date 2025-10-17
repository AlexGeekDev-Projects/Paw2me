// src/screens/Auth/LoginScreen.tsx
import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { Button, TextInput, Text, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import { signInEmail } from '@services/authService';
import { appLogo } from '@assets/images';
import Screen from '@components/layout/Screen';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onLogin = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signInEmail(email.trim(), pass);
    } catch (e: any) {
      setErr(e?.message ?? 'Error al iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={64}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Image source={appLogo} style={styles.logo} resizeMode="contain" />

            <Text variant="headlineMedium" style={styles.title}>
              ¡Hola de nuevo!
            </Text>
            <Text
              variant="bodyMedium"
              style={{ marginBottom: 16, opacity: 0.7 }}
            >
              Inicia sesión para continuar
            </Text>

            <TextInput
              label="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              left={<TextInput.Icon icon="email-outline" />}
              style={styles.input}
            />
            <TextInput
              label="Contraseña"
              value={pass}
              onChangeText={setPass}
              secureTextEntry
              left={<TextInput.Icon icon="lock-outline" />}
              style={styles.input}
            />

            {err ? (
              <Text style={[styles.error, { color: colors.error }]}>{err}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={onLogin}
              loading={busy}
              disabled={busy}
              style={styles.btn}
              contentStyle={{ paddingVertical: 6 }}
            >
              Entrar
            </Button>

            <View style={styles.links}>
              <Button
                onPress={() => navigation.navigate('ForgotPassword')}
                compact
              >
                ¿Olvidaste tu contraseña?
              </Button>
              <Button onPress={() => navigation.navigate('Register')} compact>
                Crear cuenta nueva
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  container: {
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    marginBottom: 12,
  },
  btn: {
    width: '100%',
    marginTop: 8,
    borderRadius: 8,
  },
  links: {
    marginTop: 16,
    alignItems: 'center',
  },
  error: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
});

export default LoginScreen;
