import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type {
  CompositeNavigationProp,
  NavigationProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: undefined;
  AnimalProfile: { animalId: string };
  ShelterProfile: { shelterId: string };
  PostDetail: { postId: string };
  CreatePost: { editPostId?: string } | undefined; // ← ahora params puede omitirse
};

export type TabsParamList = {
  Feed: undefined;
  Search: undefined;
  Favorites: undefined;
  Settings: undefined;
};

// (atajos útiles)
export type RootNav = NativeStackNavigationProp<RootStackParamList>;
export type FeedTabNav = BottomTabNavigationProp<TabsParamList, 'Feed'>;
export type FeedNav = CompositeNavigationProp<FeedTabNav, RootNav>;
