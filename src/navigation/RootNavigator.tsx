// src/navigation/RootNavigator.tsx
import React from 'react';
import { View, Pressable, Platform, StyleSheet } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme as NavLight,
  DarkTheme as NavDark,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { adaptNavigationTheme } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@hooks/useAuth';
import { useResolvedTheme } from '@hooks/useResolvedTheme';

// App screens
import FeedScreen from '@screens/Feed/FeedScreen';
import ExploreScreen from '@screens/Explore/ExploreScreen';
import SettingsScreen from '@screens/Settings/SettingsScreen';
import AnimalDetailScreen from '@screens/Animal/AnimalDetailScreen';
import CreateAnimalScreen from '@screens/Animal/CreateAnimalScreen';
import CreatePostScreen from '@screens/Feed/CreatePostScreen';

// Auth screens
import LoginScreen from '@screens/Auth/LoginScreen';
import RegisterScreen from '@screens/Auth/RegisterScreen';
import ForgotPasswordScreen from '@screens/Auth/ForgotPasswordScreen';

import Loading from '@components/feedback/Loading';
import { Appbar } from 'react-native-paper';

/** Tipos raíz */
export type RootStackParamList = {
  AppTabs: undefined;
  CreateAnimal: undefined;
  CreatePost: { animalId?: string } | undefined;

  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

/** Tipos por tab (stacks internos) */
export type FeedStackParamList = {
  Feed: undefined;
  AnimalDetail: { id: string };
};

export type ExploreStackParamList = {
  Explore: undefined;
  AnimalDetail: { id: string };
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type TabParamList = {
  FeedTab: undefined;
  Create: undefined; // “fantasma” para el botón +
  ExploreTab: undefined;
  SettingsTab: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

/** Placeholder sin inline function */
const TabPlaceholder: React.FC = () => null;

/** Stacks por tab (sin headers) */
const FeedStackNavigator: React.FC = () => (
  <FeedStack.Navigator screenOptions={{ headerShown: false }}>
    <FeedStack.Screen name="Feed" component={FeedScreen} />
    <FeedStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
  </FeedStack.Navigator>
);

const ExploreStackNavigator: React.FC = () => (
  <ExploreStack.Navigator screenOptions={{ headerShown: false }}>
    <ExploreStack.Screen name="Explore" component={ExploreScreen} />
    <ExploreStack.Screen name="AnimalDetail" component={AnimalDetailScreen} />
  </ExploreStack.Navigator>
);

const SettingsStackNavigator: React.FC = () => (
  <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
    <SettingsStack.Screen name="Settings" component={SettingsScreen} />
  </SettingsStack.Navigator>
);

/** Botón central + (mismo tamaño que los iconos, sin ref) */
const CustomTabBarButton: React.FC<BottomTabBarButtonProps> = ({
  children,
  onPress,
}) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.plusBtn,
        { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
};

/** Tabs principales con “glass bar” y tema */
const TabsView: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const active = theme.colors.primary;
  const inactive =
    // MD3 onSurfaceVariant si existe; fallback neutro
    (theme as any).colors?.onSurfaceVariant ??
    (theme.dark ? '#9AA0A6' : '#6B7280');

  const borderColor =
    (theme as any).colors?.outlineVariant ??
    (theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)');

  const glassBg = theme.dark ? 'rgba(18,18,18,0.72)' : 'rgba(255,255,255,0.86)';

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // solo iconos
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        // Fondo translúcido “glass”
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: glassBg,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: borderColor,
              },
            ]}
          />
        ),
        tabBarStyle: [
          {
            height: 64,
            paddingBottom: Math.max(insets.bottom - 4, 8),
            paddingTop: 8,
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            // sombras sutiles
            shadowColor: theme.colors.onSurface,
            shadowOpacity: theme.dark ? 0.2 : 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
            elevation: 10,
            backgroundColor: 'transparent', // el color real lo da tabBarBackground
          },
        ],
        sceneContainerStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {/* Feed */}
      <Tabs.Screen
        name="FeedTab"
        component={FeedStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: { size: number; color: string }) => (
            <Icon name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Botón “+” centrado (misma huella que otros) */}
      <Tabs.Screen
        name="Create"
        component={TabPlaceholder}
        options={{
          tabBarIcon: ({ size }: { size: number }) => (
            <View style={[styles.plusIconWrapper]}>
              <Icon name="plus" size={size} color={theme.colors.onPrimary} />
            </View>
          ),
          tabBarButton: (props: BottomTabBarButtonProps) => (
            <CustomTabBarButton {...props} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: e => {
            e.preventDefault();
            navigation.getParent()?.navigate('CreateAnimal');
          },
        })}
      />

      {/* Explorar */}
      <Tabs.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: { size: number; color: string }) => (
            <Icon name="paw" size={size} color={color} />
          ),
        }}
      />

      {/* Ajustes */}
      <Tabs.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          tabBarIcon: ({ size, color }: { size: number; color: string }) => (
            <Icon name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

/** Root con tema de navegación adaptado a Paper */
const RootNavigator: React.FC = () => {
  const { ready, isSignedIn } = useAuth();
  const { theme } = useResolvedTheme();

  // Paper <-> React Navigation
  const { LightTheme, DarkTheme } = adaptNavigationTheme({
    reactNavigationLight: NavLight,
    reactNavigationDark: NavDark,
  });
  const navTheme = theme.dark ? DarkTheme : LightTheme;

  if (!ready) return <Loading variant="fullscreen" message="Cargando…" />;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isSignedIn ? (
          <>
            <RootStack.Screen name="AppTabs" component={TabsView} />
            <RootStack.Screen
              name="CreateAnimal"
              component={CreateAnimalScreen}
            />
            <RootStack.Screen
              name="CreatePost"
              component={CreatePostScreen}
              options={{
                headerShown: true,
                title: 'Nueva actualización',
                header: ({ navigation, options }) => (
                  <Appbar.Header
                    mode="small"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <Appbar.BackAction onPress={navigation.goBack} />
                    <Appbar.Content title={options.title} />
                  </Appbar.Header>
                ),
              }}
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

const styles = StyleSheet.create({
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8, // queda centrado en la barra
  },
  plusIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RootNavigator;
