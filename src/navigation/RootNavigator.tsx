import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { paperTheme } from '@theme/paperTheme';
import { useAuth } from '@hooks/useAuth';

// App
import FeedScreen from '@screens/Feed/FeedScreen';
import ExploreScreen from '@screens/Explore/ExploreScreen';
import AnimalDetailScreen from '@screens/Animal/AnimalDetailScreen';
import CreateAnimalScreen from '@screens/Animal/CreateAnimalScreen';
import CreatePostScreen from '@screens/Feed/CreatePostScreen';

// Auth
import LoginScreen from '@screens/Auth/LoginScreen';
import RegisterScreen from '@screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '@screens/Auth/ForgotPasswordScreen';

import Loading from '@components/feedback/Loading';

export type RootStackParamList = {
  Tabs: undefined;
  AnimalDetail: { id: string };
  CreateAnimal: undefined;
  CreatePost: { animalId?: string } | undefined;

  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Explore: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const TabsView: React.FC = () => (
  <Tabs.Navigator screenOptions={{ headerShown: false }}>
    <Tabs.Screen
      name="Feed"
      component={FeedScreen}
      options={{
        tabBarLabel: 'Feed',
        tabBarIcon: ({ size, color }) => (
          <Icon name="home-outline" size={size} color={color} />
        ),
      }}
    />
    <Tabs.Screen
      name="Explore"
      component={ExploreScreen}
      options={{
        tabBarLabel: 'Explorar',
        tabBarIcon: ({ size, color }) => (
          <Icon name="paw" size={size} color={color} />
        ),
      }}
    />
  </Tabs.Navigator>
);

const RootNavigator: React.FC = () => {
  const { ready, isSignedIn } = useAuth();
  if (!ready) return <Loading variant="fullscreen" message="Cargando…" />;

  return (
    <PaperProvider theme={paperTheme}>
      <NavigationContainer>
        <Stack.Navigator>
          {isSignedIn ? (
            <>
              <Stack.Screen
                name="Tabs"
                component={TabsView}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="AnimalDetail"
                component={AnimalDetailScreen}
                options={{ title: 'Perfil' }}
              />
              <Stack.Screen
                name="CreateAnimal"
                component={CreateAnimalScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="CreatePost"
                component={CreatePostScreen}
                options={{ title: 'Nuevo post' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{ title: 'Crear cuenta' }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: 'Recuperar contraseña' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default RootNavigator;
