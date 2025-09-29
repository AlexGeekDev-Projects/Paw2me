import React from 'react';
import Screen from '@components/layout/Screen';
import { Text } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/types';

const AnimalProfileScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'AnimalProfile'>>();
  return (
    <Screen>
      <Text variant="headlineSmall">Perfil del Animal</Text>
      <Text>ID: {route.params.animalId}</Text>
    </Screen>
  );
};

export default AnimalProfileScreen;
