// src/screens/Animal/AnimalDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { Text, Chip, Button, useTheme, Divider } from 'react-native-paper';
import { getAnimalById } from '@services/animalsService';
import type { AnimalDoc } from '@models/animal';
import Loading from '@components/feedback/Loading';
import MediaGrid from '@components/MediaGrid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '@components/layout/Screen';

interface Props {
  route: { params: { id: string } };
}

const AnimalDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [doc, setDoc] = useState<AnimalDoc>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'fotos' | 'adoptar'>('info');

  useEffect(() => {
    (async () => {
      const d = await getAnimalById(id);
      setDoc(d);
      setLoading(false);
    })();
  }, [id]);

  if (loading)
    return <Loading variant="fullscreen" message="Cargando perfil…" />;
  if (!doc) return <Text style={{ margin: 16 }}>No encontrado.</Text>;

  return (
    <Screen scrollable>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 32 + insets.bottom,
          paddingTop:
            Platform.OS === 'android' ? StatusBar.currentHeight : insets.top,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Portada */}
        {doc.coverUrl && (
          <Image
            source={{ uri: doc.coverUrl }}
            style={styles.cover}
            resizeMode="cover"
          />
        )}

        {/* Chips como navegación */}
        <View style={styles.tabsContainer}>
          <Chip
            selected={tab === 'info'}
            onPress={() => setTab('info')}
            style={styles.tabChip}
          >
            Información
          </Chip>
          <Chip
            selected={tab === 'fotos'}
            onPress={() => setTab('fotos')}
            style={styles.tabChip}
          >
            Fotos
          </Chip>
          <Chip
            selected={tab === 'adoptar'}
            onPress={() => setTab('adoptar')}
            style={styles.tabChip}
          >
            Adoptar
          </Chip>
        </View>

        {/* Contenido */}
        <View
          style={[
            styles.container,
            tab === 'fotos' && { paddingHorizontal: 0 }, // Quitar márgenes solo en galería
          ]}
        >
          {tab === 'info' && (
            <>
              <Text variant="headlineMedium" style={styles.name}>
                {doc.name}
              </Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                {doc.species} • {doc.size} • {doc.sex} • {doc.ageMonths} meses
              </Text>

              {(doc.location?.city || doc.location?.country) && (
                <Text variant="bodySmall" style={styles.location}>
                  {doc.location.city ? `${doc.location.city}, ` : ''}
                  {doc.location.country ?? ''}
                </Text>
              )}

              <Divider style={{ marginVertical: 16 }} />

              <View style={styles.chips}>
                <Chip icon="dna">
                  {doc.mixedBreed
                    ? 'Mestizo'
                    : (doc.breed ?? 'Raza desconocida')}
                </Chip>
                <Chip icon="needle">
                  {doc.vaccinated ? 'Vacunado' : 'Vacunas pendientes'}
                </Chip>
                <Chip icon="scissors-cutting">
                  {doc.sterilized ? 'Esterilizado' : 'No esterilizado'}
                </Chip>
                {doc.status === 'disponible' && (
                  <Chip icon="check-circle">Disponible</Chip>
                )}
                {doc.tags?.map((tag, i) => (
                  <Chip key={i} icon="tag">
                    {tag}
                  </Chip>
                ))}
              </View>

              {doc.address && (
                <Text variant="bodySmall" style={styles.address}>
                  📍 {doc.address}
                </Text>
              )}
            </>
          )}

          {tab === 'fotos' && doc.images && doc.images.length > 0 && (
            <View style={styles.galleryContainer}>
              <Text
                variant="titleMedium"
                style={[styles.galleryTitle, { marginLeft: 24 }]}
              >
                Galería
              </Text>
              <MediaGrid urls={doc.images} />
            </View>
          )}

          {tab === 'adoptar' && (
            <View style={styles.ctaContainer}>
              <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                Para adoptar a este animalito, pronto verás aquí los requisitos,
                pasos y documentos necesarios. Mientras tanto, puedes expresar
                tu interés.
              </Text>
              <Button mode="contained" style={styles.cta}>
                ¡Quiero adoptar!
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    height: 320,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  tabChip: {
    paddingHorizontal: 12,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  name: {
    fontWeight: 'bold',
  },
  subtitle: {
    marginTop: 4,
    opacity: 0.85,
  },
  location: {
    marginTop: 4,
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  address: {
    marginTop: 12,
    opacity: 0.6,
  },
  galleryContainer: {
    marginTop: 8,
  },
  galleryTitle: {
    marginBottom: 8,
  },
  ctaContainer: {
    marginTop: 8,
    paddingBottom: 32,
  },
  cta: {
    borderRadius: 8,
    paddingVertical: 6,
  },
});

export default AnimalDetailScreen;
