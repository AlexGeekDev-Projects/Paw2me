import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  Switch,
  Divider,
  List,
  Button,
  useTheme,
} from 'react-native-paper';
import PageHeader from '@components/layout/PageHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@hooks/useAuth';
import { useResolvedTheme } from '@hooks/useResolvedTheme';
import Screen from '@components/layout/Screen';

const SettingsScreen: React.FC = () => {
  const { top } = useSafeAreaInsets();
  const { isDark, toggleTheme } = useResolvedTheme();
  const { signOut, user } = useAuth();
  const theme = useTheme();

  return (
    <Screen>
      <PageHeader title="Configuración" subtitle="Preferencias y cuenta" />
      <View style={styles.content}>
        <List.Section>
          <List.Subheader>Cuenta</List.Subheader>
          <List.Item
            title={user?.displayName || 'Usuario sin nombre'}
            description={user?.email}
            left={props => <List.Icon {...props} icon="account" />}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>Apariencia</List.Subheader>
          <List.Item
            title="Tema oscuro"
            left={props => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => <Switch value={isDark} onValueChange={toggleTheme} />}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader>Sesión</List.Subheader>
          <Button
            mode="outlined"
            onPress={signOut}
            style={styles.logoutButton}
            icon="logout"
          >
            Cerrar sesión
          </Button>
        </List.Section>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingVertical: 12 },
  logoutButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
});

export default SettingsScreen;
