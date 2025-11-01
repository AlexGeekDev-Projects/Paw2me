// src/navigation/RootNavigator.tsx
import React from 'react';
import { View } from 'react-native';
import {
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import Matches from '@screens/User/Matches';

// Services
import ServicesHome, {
  type ServicesCategoryId,
} from '@screens/Services/ServicesHome';

// UI
import Loading from '@components/feedback/Loading';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  ServicesHome: undefined;
  ServicesCategory: { categoryId: ServicesCategoryId; title: string };
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
const MatchesScreen: React.FC = () => <Matches />;

/** ✅ Adapter tipado para resolver el error “Type '{}' is missing navigation, route” */
type ExploreCreateAnimalProps = NativeStackScreenProps<
  ExploreStackParamList,
  'CreateAnimal'
>;
type CreateAnimalProps = React.ComponentProps<typeof CreateAnimalScreen>;

const CreateAnimalAdapter: React.FC<ExploreCreateAnimalProps> = props => {
  // El shape de props coincide (navigation/route); casteamos vía unknown sin usar `any`.
  const forwarded = props as unknown as CreateAnimalProps;
  return <CreateAnimalScreen {...forwarded} />;
};

const ExploreStackNavigator: React.FC = () => (
  <ExploreStack.Navigator
    initialRouteName="Explore"
    screenOptions={{ headerShown: false }}
  >
    <ExploreStack.Screen name="Explore" component={ExploreScreen} />
    <ExploreStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
    <ExploreStack.Screen name="Matches" component={MatchesScreen} />
    <ExploreStack.Screen name="CreateAnimal" component={CreateAnimalAdapter} />
  </ExploreStack.Navigator>
);

/* ======== Services (tabs) ======== */
const ServicesStackNavigator: React.FC = () => (
  <ServicesStack.Navigator screenOptions={{ headerShown: false }}>
    <ServicesStack.Screen name="ServicesHome" component={ServicesHome} />
    {/* <ServicesStack.Screen name="ServicesCategory" component={ServicesCategoryScreen} /> */}
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

const NoopScreen: React.FC = () => <View />;

const TabsView: React.FC = () => {
  const { theme } = useResolvedTheme();
  const insets = useSafeAreaInsets();

  // ✅ Sin index signature: tipamos 'elevation' opcional del tema MD3
  type MaybeMD3Elevation = { elevation?: { level2?: string } };
  const colors = theme.colors as unknown as MaybeMD3Elevation & {
    surface: string;
    onSurfaceDisabled: string;
    primary: string;
    onPrimary: string;
  };
  const tabBg = colors.elevation?.level2 ?? colors.surface;
  const borderTop = theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const tabBarHeight = 56 + insets.bottom;
  const tabBarPaddingBottom = Math.max(8, insets.bottom);

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceDisabled,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: borderTop,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
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
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Si estás en otra pantalla del stack, vuelve a Feed
            navigation.navigate('FeedTab', { screen: 'Feed' });
            // Nota: no hacemos preventDefault, así el screen puede scrollear al top
          },
        })}
      />

      <Tabs.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: TabIconProps) => (
            <Icon name="paw-outline" size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('ExploreTab', { screen: 'Explore' });
          },
        })}
      />

      {/* “+” centrado — abre CreateAnimal dentro de Explore (tabs visibles) */}
      <Tabs.Screen
        name="Create"
        component={NoopScreen}
        options={{
          tabBarIcon: ({ size }: { size: number }) => (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Icon
                name="plus"
                size={Math.round(size * 0.85)}
                color={colors.onPrimary}
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
