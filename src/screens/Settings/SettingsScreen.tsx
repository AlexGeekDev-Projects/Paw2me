import React from 'react';
import Screen from '@components/layout/Screen';
import { Text, RadioButton, List, Card } from 'react-native-paper';
import { useThemeStore, type ThemeMode } from '@store/useThemeStore';
import { getFirebaseInfoSafe } from '@services/firebase';

const SettingsScreen = () => {
  const { mode, setMode } = useThemeStore();
  const info = getFirebaseInfoSafe(); // ← seguro (puede ser null)

  const onChange = (v: string) => setMode(v as ThemeMode);

  return (
    <Screen>
      <Text variant="headlineSmall">Configuración</Text>

      <Text variant="titleMedium" style={{ marginTop: 12 }}>
        Apariencia
      </Text>
      <RadioButton.Group onValueChange={onChange} value={mode}>
        <List.Item
          title="Sistema"
          left={() => <RadioButton value="system" />}
        />
        <List.Item title="Claro" left={() => <RadioButton value="light" />} />
        <List.Item title="Oscuro" left={() => <RadioButton value="dark" />} />
      </RadioButton.Group>

      <Card style={{ marginTop: 16 }}>
        <Card.Title title="Firebase" />
        <Card.Content>
          {info ? (
            <>
              <Text>App: {info.appName}</Text>
              <Text>Project ID: {info.projectId ?? '—'}</Text>
              <Text>App ID: {info.appId ?? '—'}</Text>
            </>
          ) : (
            <Text>Sin configuración de Firebase detectada.</Text>
          )}
        </Card.Content>
      </Card>
    </Screen>
  );
};

export default SettingsScreen;
