import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { ActivityIndicator, Appbar, Text } from 'react-native-paper';
import AnimalCard from '@components/AnimalCard';
import type { AnimalCardVM } from '@models/animal';
import { listAnimalsPublic } from '@services/animalsService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import Loading from '@components/feedback/Loading';
import { FAB } from 'react-native-paper';

const ExploreScreen: React.FC = () => {
  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listAnimalsPublic({ limit: 30 });
    setCards(res.cards);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <>
      <Appbar.Header mode="center-aligned">
        <Appbar.Content title="Explorar" />
      </Appbar.Header>

      {loading ? (
        <Loading variant="skeleton-card-list" count={6} />
      ) : cards.length === 0 ? (
        <Text style={{ margin: 16 }}>
          No hay animalitos aún. ¡Crea el primero!
        </Text>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={it => it.id}
          renderItem={({ item }) => (
            <AnimalCard
              data={item}
              onPress={id => navigation.navigate('AnimalDetail', { id })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
      <FAB
        icon="plus"
        style={{
          position: 'absolute',
          right: 16,
          bottom: 24,
        }}
        onPress={() => navigation.navigate('CreateAnimal')}
      />
    </>
  );
};

export default ExploreScreen;
