import React, { useMemo, useCallback } from 'react';
import { FlatList } from 'react-native';
import type { ListRenderItemInfo } from 'react-native'; // <- type-only
import { Text } from 'react-native-paper';
import Screen from '@components/layout/Screen';
import PostCard from '@components/feed/PostCard';
import type { Animal } from '@models/animal';
import type { Post } from '@models/post';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type FeedItem = { animal: Animal; post: Post };

const mock: FeedItem[] = [
  {
    animal: {
      id: 'a1',
      name: 'Rocky',
      species: 'dog',
      size: 'M',
      sex: 'male',
      status: 'ready',
      breed: 'mestizo',
      ageLabel: 'young',
      sterilized: true,
      vaccinated: true,
      location: { country: 'MX', state: 'CDMX', city: 'Benito Juárez' },
      media: {
        images: [
          'https://images.dog.ceo/breeds/terrier-pitbull/20200820_131744.jpg',
        ],
      },
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
      ownerRef: { type: 'user', id: 'u1' }, // <- faltaba
    },
    post: {
      id: 'p1',
      animalId: 'a1',
      authorId: 'u1',
      caption: 'Juguetón y noble. Busca hogar responsable.',
      media: { images: [] },
      reactionsCount: 12,
      commentsCount: 3,
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 3600000,
      visibility: 'public',
    },
  },
];

const FeedScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const data = useMemo(() => mock, []);
  const keyExtractor = useCallback((item: FeedItem) => item.post.id, []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FeedItem>) => (
      <PostCard
        animal={item.animal}
        post={item.post}
        onOpen={animalId => navigation.navigate('AnimalProfile', { animalId })}
        onShare={() => {}}
      />
    ),
    [navigation],
  );

  return (
    <Screen>
      <Text variant="headlineSmall">Inicio</Text>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 12 }}
      />
    </Screen>
  );
};

export default FeedScreen;
