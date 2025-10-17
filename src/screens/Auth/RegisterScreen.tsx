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
import { appLogo } from '@assets/images';
import { signUpEmail } from '@services/authService';
import Screen from '@components/layout/Screen';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC<Props> = () => {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [pendingRegister, setPendingRegister] = useState(false);

  const validateForm = (): boolean => {
    if (!email || !pass || !confirm || !fullName || !username) {
      setErr('Completa todos los campos');
      return false;
    }
    if (pass !== confirm) {
      setErr('Las contraseñas no coinciden');
      return false;
    }
    return true;
  };

  const onRegister = () => {
    setErr(null);
    if (!validateForm()) return;
    Keyboard.dismiss();
    setShowDialog(true); // Muestra el modal antes de continuar
  };

  const handleDialogConfirm = async () => {
    setShowDialog(false);
    setBusy(true);
    setErr(null);
    try {
      await signUpEmail(email.trim(), pass, fullName, username);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } catch (e: any) {
      setErr(e?.message ?? 'No se pudo completar el registro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Icon icon="email-alert-outline" />
          <Dialog.Title>Verifica tu correo</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Te enviaremos un correo de verificación. Revisa también tu bandeja
              de spam o promociones por si no lo ves enseguida.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Cancelar</Button>
            <Button onPress={handleDialogConfirm}>Entendido</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Image source={appLogo} style={styles.logo} resizeMode="contain" />
          <Text variant="headlineMedium" style={styles.title}>
            ¡Crea tu cuenta!
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Únete a la comunidad de adopciones más grande.
          </Text>

          <TextInput
            label="Nombre completo"
            value={fullName}
            onChangeText={setFullName}
            left={<TextInput.Icon icon="account-outline" />}
            style={styles.input}
          />
          <TextInput
            label="Nombre de usuario"
            value={username}
            onChangeText={setUsername}
            left={<TextInput.Icon icon="at" />}
            autoCapitalize="none"
            style={styles.input}
          />
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
          <TextInput
            label="Confirmar contraseña"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            left={<TextInput.Icon icon="lock-check-outline" />}
            style={styles.input}
          />

          {err && (
            <Text
              style={[styles.error, { color: theme.colors.error }]}
              variant="bodySmall"
            >
              {err}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={onRegister}
            loading={busy}
            disabled={busy}
            style={styles.btn}
            contentStyle={{ paddingVertical: 6 }}
          >
            Registrarme
          </Button>

          <View style={styles.linkContainer}>
            <Text variant="bodyMedium" style={{ opacity: 0.8 }}>
              ¿Ya tienes cuenta?
            </Text>
            <Text
              variant="bodyMedium"
              onPress={() => navigation.navigate('Login')}
              style={styles.link}
            >
              Inicia sesión
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  input: {
    width: '100%',
    marginBottom: 12,
  },
  btn: {
    width: '100%',
    marginTop: 4,
    borderRadius: 8,
  },
  error: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
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

export default RegisterScreen;
