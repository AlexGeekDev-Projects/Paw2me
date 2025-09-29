import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabsParamList } from './types';

import FeedScreen from '@screens/Feed/FeedScreen';
import SearchScreen from '@screens/Search/SearchScreen';
import FavoritesScreen from '@screens/Favorites/FavoritesScreen';
import SettingsScreen from '@screens/Settings/SettingsScreen';
import AnimalProfileScreen from '@screens/AnimalProfile/AnimalProfileScreen';
import ShelterProfileScreen from '@screens/ShelterProfile/ShelterProfileScreen';

import PostDetail from '@screens/Community/PostDetail';
import CreatePost from '@screens/Community/CreatePost';
import CommunityFeed from '@screens/Community/CommunityFeed';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from 'react-native-paper';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

const TabsNavigator = () => {
  const theme = useTheme();

  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor:
          theme.colors.onSurfaceVariant ?? theme.colors.outline,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="Feed"
        component={CommunityFeed}
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="home-variant"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="magnify" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="heart-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="cog-outline"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen
        name="AnimalProfile"
        component={AnimalProfileScreen}
        options={{ title: 'Perfil del Animal' }}
      />
      <Stack.Screen
        name="ShelterProfile"
        component={ShelterProfileScreen}
        options={{ title: 'Refugio' }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetail}
        options={{ title: 'Publicación' }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePost}
        options={{ title: 'Nueva publicación' }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
