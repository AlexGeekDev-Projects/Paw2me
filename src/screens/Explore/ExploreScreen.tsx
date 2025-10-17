import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  View,
  StyleSheet,
  Image,
} from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import AnimalCard from '@components/AnimalCard';
import type { AnimalCardVM } from '@models/animal';
import { listAnimalsPublic } from '@services/animalsService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/RootNavigator';
import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import emptyPaw from '@assets/empty-paw.png';

const ExploreScreen: React.FC = () => {
  const [cards, setCards] = useState<AnimalCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listAnimalsPublic({ limit: 30 });
      console.log('🐾 Cards construidas:', res.cards);
      setCards(res.cards);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      {loading ? (
        <Loading variant="skeleton-card-list" count={6} />
      ) : cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image
            source={emptyPaw}
            style={styles.emptyImage}
            resizeMode="contain"
          />
          <Text variant="titleMedium" style={styles.emptyText}>
            Sin huellitas aún…
          </Text>
          <Text variant="bodyMedium" style={styles.emptyHint}>
            ¡Sé el primero en registrar una historia de adopción!
          </Text>
          <Button
            mode="outlined"
            style={styles.emptyButton}
            onPress={() => navigation.navigate('CreateAnimal')}
          >
            Agregar huellita
          </Button>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AnimalCard
              data={item}
              onPress={id => navigation.navigate('AnimalDetail', { id })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 12,
            paddingBottom: 96,
          }}
          contentInsetAdjustmentBehavior="automatic"
        />
      )}

      {/* <FAB
        icon="plus"
        label="Nueva huellita"
        onPress={() => navigation.navigate('CreateAnimal')}
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      /> */}
    </Screen>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    zIndex: 10,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 18,
  },
  emptyHint: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
    marginBottom: 12,
  },
  emptyImage: {
    width: 96,
    height: 96,
    opacity: 0.3,
    marginBottom: 16,
  },
  emptyButton: {
    marginTop: 4,
  },
});

export default ExploreScreen;
