import React from 'react';
import Screen from '@components/layout/Screen';
import { Text, Card } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';

const FavoritesScreen = () => {
  return (
    <Screen>
      <Text variant="headlineSmall">Favoritos</Text>
      <View style={styles.gap} />
      <Card>
        <Card.Content>
          <Text variant="bodyMedium">Aún no tienes favoritos.</Text>
        </Card.Content>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({ gap: { height: 12 } });
export default FavoritesScreen;
