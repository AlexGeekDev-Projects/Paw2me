// src/screens/Auth/ForgotPasswordScreen.tsx

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import {
  Button,
  TextInput,
  Text,
  useTheme,
  Dialog,
  Portal,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import { resetPassword } from '@services/authService';
import { appLogo } from '@assets/images';
import Screen from '@components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC<Props> = () => {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const onSend = async () => {
    setErr(null);
    Keyboard.dismiss();
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setShowDialog(true);
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo enviar el correo');
    } finally {
      setBusy(false);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    navigation.navigate('Login');
  };

  return (
    <Screen>
      <Portal>
        <Dialog visible={showDialog} onDismiss={handleDialogClose}>
          <Dialog.Icon icon="email-check-outline" />
          <Dialog.Title>Correo enviado</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Revisa tu bandeja de entrada para restablecer tu contraseña. Si no
              ves el correo enseguida, revisa también tu bandeja de spam o
              promociones.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleDialogClose}>Entendido</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={appLogo} style={styles.logo} resizeMode="contain" />
          <Text variant="headlineMedium" style={styles.title}>
            ¿Olvidaste tu contraseña?
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            No te preocupes. Ingresa tu correo y te enviaremos un enlace para
            recuperarla.
          </Text>

          <TextInput
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
          />

          {err ? (
            <Text
              style={[styles.feedback, { color: theme.colors.error }]}
              variant="bodySmall"
            >
              {err}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={onSend}
            loading={busy}
            disabled={busy}
            style={styles.btn}
            contentStyle={{ paddingVertical: 6 }}
          >
            Enviar correo
          </Button>

          <View style={styles.linkContainer}>
            <Text variant="bodyMedium">¿Ya lo recordaste?</Text>
            <Text
              variant="bodyMedium"
              onPress={() => navigation.navigate('Login')}
              style={styles.link}
            >
              Iniciar sesión
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  logo: { width: 120, height: 120, marginBottom: 12 },
  title: {
    marginBottom: 4,
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  input: { width: '100%', marginBottom: 12 },
  btn: { width: '100%', marginTop: 4, borderRadius: 8 },
  feedback: { alignSelf: 'flex-start', marginBottom: 8 },
  linkContainer: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
    gap: 4,
  },
  link: {
    color: '#3E7BFA',
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen;
