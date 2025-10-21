// src/navigation/RootNavigator.tsx
import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
  CreateAnimal: undefined; // flujo que abre el tab “+”
  AnimalDetail: { id: string };

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
};

export type MatchesStackParamList = {
  Matches: undefined;
  AnimalDetail: { id: string };
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type TabParamList = {
  FeedTab: undefined;
  ExploreTab: undefined;
  Create: undefined; // tab “placebo” para el +
  MatchesTab: undefined;
  SettingsTab: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const MatchesStack = createNativeStackNavigator<MatchesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

/* ======== Stacks por pestaña ======== */
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

const ExploreStackNavigator: React.FC = () => (
  <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
    <ExploreStack.Screen name="Explore" component={ExploreScreen} />
    <ExploreStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
  </ExploreStack.Navigator>
);

// Placeholder para Matches (sin inline function; incluye children para evitar TS error)
const MatchesHome: React.FC = () => (
  <Screen scrollable>
    <Matches />
  </Screen>
);

const MatchesStackNavigator: React.FC = () => (
  <MatchesStack.Navigator screenOptions={{ headerShown: false }}>
    <MatchesStack.Screen name="Matches" component={MatchesHome} />
    <MatchesStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
  </MatchesStack.Navigator>
);

const SettingsStackNavigator: React.FC = () => (
  <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
    <SettingsStack.Screen name="Settings" component={SettingsScreen} />
  </SettingsStack.Navigator>
);

/* ======== Tabs principales ======== */
type TabIconProps = { size: number; color: string; focused: boolean };

const TabsView: React.FC = () => {
  const { theme } = useResolvedTheme();

  // Fondo del tab bar según tema (oscuro/claro)
  const tabBg = (theme.colors as any).elevation?.level2 ?? theme.colors.surface;
  const borderTop = theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // 👈 solo iconos
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceDisabled,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: borderTop,
          borderTopWidth: 1,
          height: 64, // conserva altura ideal
        },
      }}
    >
      {/* 1. Feed */}
      <Tabs.Screen
        name="FeedTab"
        component={FeedStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="home-variant-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 2. Explorar */}
      <Tabs.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="paw-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 3. “+” centrado — no navega al tab, abre CreateAnimal en el root */}
      <Tabs.Screen
        name="Create"
        component={MatchesHome /* componente definido, no inline */}
        options={{
          tabBarIcon: ({ size }: { size: number }) => (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: theme.colors.primary, // relleno
                // sombra sutil
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
            e.preventDefault(); // no cambies de tab
            navigation.getParent()?.navigate('CreateAnimal');
          },
        })}
      />

      {/* 4. Matches */}
      <Tabs.Screen
        name="MatchesTab"
        component={MatchesStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="heart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 5. Ajustes */}
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
  const { theme } = useResolvedTheme();

  if (!ready) return <Loading variant="fullscreen" message="Cargando…" />;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isSignedIn ? (
          <>
            <RootStack.Screen name="AppTabs" component={TabsView} />
            <RootStack.Screen
              name="CreateAnimal"
              component={CreateAnimalScreen}
            />
            <RootStack.Screen
              name="AnimalDetail"
              component={AnimalDetailScreen}
            />
          </>
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
