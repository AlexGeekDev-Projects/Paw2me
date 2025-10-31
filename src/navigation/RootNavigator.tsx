// src/navigation/RootNavigator.tsx
import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, StackActions } from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '@hooks/useAuth';
import { useResolvedTheme } from '@hooks/useResolvedTheme';

// Screens
import FeedScreen from '@screens/Feed/FeedScreen';
import ExploreScreen from '@screens/Explore/ExploreScreen';
import SettingsScreen from '@screens/Settings/SettingsScreen';
import AnimalDetailScreen from '@screens/Animal/AnimalDetailScreen';
import CreateAnimalScreen from '@screens/Animal/CreateAnimalScreen';
import CreatePostScreen from '@screens/Feed/CreatePostScreen';
import LoginScreen from '@screens/Auth/LoginScreen';
import RegisterScreen from '@screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '@screens/Auth/ForgotPasswordScreen';

// UI helpers
import Loading from '@components/feedback/Loading';
import Screen from '@components/layout/Screen';
import { Appbar } from 'react-native-paper';
import Matches from '@screens/User/Matches';

/* ========= Tipos ========= */
export type RootStackParamList = {
  AppTabs: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type FeedStackParamList = {
  Feed: undefined;
  AnimalDetail: { id: string };
  CreatePost: { animalId?: string } | undefined;
};

export type ExploreStackParamList = {
  Explore: undefined;
  AnimalDetail: { id: string };
  Matches: undefined; // dentro de Explore para mantener tabs visibles
  CreateAnimal: undefined; // Create con tabs visibles
};

export type ServicesStackParamList = {
  Services: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type TabParamList = {
  FeedTab: NavigatorScreenParams<FeedStackParamList> | undefined;
  ExploreTab: NavigatorScreenParams<ExploreStackParamList> | undefined;
  Create: undefined; // tab “placebo” para el +
  ServicesTab: NavigatorScreenParams<ServicesStackParamList> | undefined;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

/* ========= Stacks ========= */
const RootStack = createNativeStackNavigator<RootStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const ServicesStack = createNativeStackNavigator<ServicesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

/* ======== Feed (tabs) ======== */
const FeedStackNavigator: React.FC = () => (
  <FeedStack.Navigator screenOptions={{ headerShown: false }}>
    <FeedStack.Screen name="Feed" component={FeedScreen} />
    <FeedStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
    <FeedStack.Screen
      name="CreatePost"
      component={CreatePostScreen}
      options={{ headerShown: false }}
    />
  </FeedStack.Navigator>
);

/* ======== Explore (tabs) ======== */
/** Compatibilidad: CreateAnimalScreen tiene Props propios; lo adaptamos
 *  al tipo esperado por ExploreStack sin usar `any`.
 */
const CreateAnimalCompat = CreateAnimalScreen as unknown as React.ComponentType;

/** Componente estable para evitar función inline en `component` (sin warnings) */
const MatchesScreen: React.FC = () => <Matches />;

const ExploreStackNavigator: React.FC = () => (
  <ExploreStack.Navigator
    initialRouteName="Explore"
    screenOptions={{ headerShown: false }}
  >
    <ExploreStack.Screen name="Explore" component={ExploreScreen} />
    <ExploreStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
    <ExploreStack.Screen name="Matches" component={MatchesScreen} />
    <ExploreStack.Screen name="CreateAnimal" component={CreateAnimalCompat} />
  </ExploreStack.Navigator>
);

/* ======== Services (tabs) ======== */
const ServicesHome: React.FC = () => (
  <Screen scrollable>
    <Appbar.Header mode="center-aligned">
      <Appbar.Content title="Servicios" />
    </Appbar.Header>
    {/* TODO: grid/cards de servicios */}
  </Screen>
);

const ServicesStackNavigator: React.FC = () => (
  <ServicesStack.Navigator screenOptions={{ headerShown: false }}>
    <ServicesStack.Screen name="Services" component={ServicesHome} />
  </ServicesStack.Navigator>
);

/* ======== Settings (tabs) ======== */
const SettingsStackNavigator: React.FC = () => (
  <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
    <SettingsStack.Screen name="Settings" component={SettingsScreen} />
  </SettingsStack.Navigator>
);

/* ======== Tabs principales ======== */
type TabIconProps = { size: number; color: string; focused: boolean };

const TabsView: React.FC = () => {
  const { theme } = useResolvedTheme();
  const tabBg = (theme.colors as any).elevation?.level2 ?? theme.colors.surface;
  const borderTop = theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceDisabled,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: borderTop,
          borderTopWidth: 1,
          height: 64,
        },
      }}
    >
      <Tabs.Screen
        name="FeedTab"
        component={FeedStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="home-variant-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="paw-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation, route }) => ({
          tabPress: e => {
            // Si el tab ya está enfocado y hay pantallas encima del root, haz popToTop en el stack anidado.
            const state: any = (route as any).state;
            if (state?.type === 'stack' && state.index > 0) {
              navigation.dispatch({
                ...StackActions.popToTop(),
                target: state.key, // MUY importante: enviar al stack anidado
              });
              return;
            }
            // Si vienes de otro tab o todavía no hay state del hijo, fuerza ir al root de Explore
            navigation.navigate('ExploreTab', { screen: 'Explore' });
          },
        })}
      />

      {/* “+” centrado — abre CreateAnimal dentro de Explore (tabs visibles) */}
      <Tabs.Screen
        name="Create"
        component={ServicesHome /* placeholder requerido por Tabs */}
        options={{
          tabBarIcon: ({ size }: { size: number }) => (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.colors.primary,
                shadowColor: theme.colors.primary,
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Icon
                name="plus"
                size={Math.round(size * 0.85)}
                color={theme.colors.onPrimary}
              />
            </View>
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            navigation.navigate('ExploreTab', { screen: 'CreateAnimal' });
          },
        })}
      />

      <Tabs.Screen
        name="ServicesTab"
        component={ServicesStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="hand-heart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

/* ======== Root ======== */
const RootNavigator: React.FC = () => {
  const { ready, isSignedIn } = useAuth();

  if (!ready) return <Loading variant="fullscreen" message="Cargando…" />;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isSignedIn ? (
          <RootStack.Screen name="AppTabs" component={TabsView} />
        ) : (
          <>
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="Register" component={RegisterScreen} />
            <RootStack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
