// src/screens/Services/ServicesHome.tsx
import React, { useMemo, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Text, useTheme, Avatar } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ServicesStackParamList } from '@navigation/RootNavigator';
import Screen from '@components/layout/Screen';

export type ServicesCategoryId =
  | 'vets'
  | 'grooming'
  | 'walkers'
  | 'food'
  | 'trainers'
  | 'boarding'
  | 'emergency'
  | 'pharmacy'
  | 'accessories'
  | 'adoption'
  | 'photography'
  | 'transport'
  | 'petfriendly'
  | 'insurance'
  | 'mobile_groom'
  | 'home_vet'
  | 'cremation'
  | 'daycare';

type Category = Readonly<{
  id: ServicesCategoryId;
  title: string;
  icon: string; // MaterialCommunityIcons
}>;

const CATEGORIES: readonly Category[] = [
  { id: 'vets', title: 'Veterinarios', icon: 'stethoscope' },
  { id: 'grooming', title: 'Estéticas', icon: 'scissors-cutting' },
  { id: 'walkers', title: 'Paseadores', icon: 'walk' },
  { id: 'food', title: 'Comida/Tiendas', icon: 'food-apple-outline' },
  { id: 'trainers', title: 'Adiestradores', icon: 'dog-service' },
  { id: 'boarding', title: 'Hoteles/Guarderías', icon: 'home-heart' },
  { id: 'daycare', title: 'Daycare', icon: 'calendar-clock' },
  { id: 'emergency', title: 'Emergencia 24h', icon: 'alarm-light' },
  { id: 'pharmacy', title: 'Farmacias', icon: 'pill' },
  { id: 'accessories', title: 'Accesorios', icon: 'bag-personal-outline' },
  { id: 'adoption', title: 'Adopciones', icon: 'hand-heart' },
  { id: 'photography', title: 'Fotografía', icon: 'camera-iris' },
  { id: 'transport', title: 'Transporte', icon: 'van-utility' },
  { id: 'petfriendly', title: 'Pet-friendly', icon: 'map-marker' },
  { id: 'insurance', title: 'Seguros', icon: 'shield-heart' },
  { id: 'mobile_groom', title: 'Grooming móvil', icon: 'van-passenger' },
  { id: 'home_vet', title: 'Vet a domicilio', icon: 'home-thermometer' },
  { id: 'cremation', title: 'Cremación', icon: 'fire' },
] as const;

const CARD_SIZE = 88;

const ServicesHome: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ServicesStackParamList>>();

  const renderItem: ListRenderItem<Category> = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() =>
          navigation.navigate('ServicesCategory', {
            categoryId: item.id,
            title: item.title,
          })
        }
        style={({ pressed }) => [
          styles.cardWrap,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Card mode="elevated" style={styles.card} elevation={2}>
          <View style={styles.iconCircle}>
            <Icon name={item.icon} size={26} color={theme.colors.primary} />
          </View>
          <Text numberOfLines={2} style={styles.cardText}>
            {item.title}
          </Text>
        </Card>
      </Pressable>
    ),
    [navigation, theme.colors.primary],
  );

  const keyExtractor = useCallback((c: Category) => c.id, []);

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Avatar.Image size={40} source={require('@assets/empty-paw.png')} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>
              Servicios para tus huellitas
            </Text>
            <Text variant="bodySmall" style={{ opacity: 0.7 }}>
              Accede rápido a lo que necesitas cerca de ti
            </Text>
          </View>
        </View>

        <View style={styles.sectionTitleRow}>
          <Text variant="titleMedium" style={{ fontWeight: '700' }}>
            Tus accesos directos
          </Text>
        </View>
      </View>
    ),
    [],
  );

  return (
    // No usamos safe area aquí; lo simulamos sólo al inicio con paddingTop
    <Screen edges={[]}>
      <FlatList
        data={CATEGORIES}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        ListHeaderComponent={header}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        // No ajustes automáticos: evitamos bandas y controlamos nosotros
        contentInsetAdjustmentBehavior="never"
        // 👉 encabezado visible bajo el notch al inicio,
        // pero permite que el contenido se meta detrás al hacer scroll:
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          paddingBottom: 24, // fijo; NO usar insets.bottom
        }}
        // que el indicador respete notch y tab bar
        scrollIndicatorInsets={{ top: insets.top, bottom: 64 }}
        keyboardDismissMode="on-drag"
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { paddingHorizontal: 4, paddingVertical: 8, gap: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  cardWrap: { width: '49%', marginBottom: 12 },
  card: {
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: CARD_SIZE,
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  cardText: { textAlign: 'center', fontWeight: '600' },
});

export default ServicesHome;
