// src/screens/Feed/FeedScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { Appbar, FAB } from 'react-native-paper';
import Loading from '@components/feedback/Loading';
import PostCard from '@components/feed/PostCard';
import {
  listPostsPublic,
  getUserReacted,
  countReactions,
  toggleReaction,
  toPostVM,
} from '@services/postsService';
import type { PostDoc, PostCardVM } from '@models/post';
import { getAuth } from '@services/firebase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/RootNavigator';
import Screen from '@components/layout/Screen';

const FeedScreen: React.FC = () => {
  const [items, setItems] = useState<PostCardVM[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const uid = getAuth().currentUser?.uid ?? 'dev';

  const load = useCallback(async () => {
    setLoading(true);
    const posts: PostDoc[] = await listPostsPublic({ limit: 30 });
    const vms: PostCardVM[] = [];
    for (const p of posts) {
      const [reacted, rc] = await Promise.all([
        getUserReacted(p.id, uid),
        countReactions(p.id),
      ]);
      vms.push(toPostVM({ ...p, reactionCount: rc }, reacted));
    }
    setItems(vms);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onToggleReact = useCallback(
    async (postId: string, next: boolean) => {
      setItems(prev =>
        prev.map(it =>
          it.id === postId
            ? {
                ...it,
                reactedByMe: next,
                reactionCount: Math.max(0, it.reactionCount + (next ? 1 : -1)),
              }
            : it,
        ),
      );
      const final = await toggleReaction(postId, uid);
      const rc = await countReactions(postId);
      setItems(prev =>
        prev.map(it =>
          it.id === postId
            ? { ...it, reactedByMe: final, reactionCount: rc }
            : it,
        ),
      );
    },
    [uid],
  );

  return (
    <Screen>
      {loading ? (
        <Loading variant="skeleton-card-list" count={4} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={it => it.id}
          renderItem={({ item }) => (
            <PostCard data={item} onToggleReact={onToggleReact} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentInsetAdjustmentBehavior="automatic"
        />
      )}
      <FAB
        icon="plus"
        style={{ position: 'absolute', right: 16, bottom: 24 }}
        onPress={() => navigation.navigate('CreatePost')}
      />
    </Screen>
  );
};

export default FeedScreen;
