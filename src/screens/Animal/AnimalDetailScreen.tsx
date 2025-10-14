import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  ActivityIndicator,
  Text,
  Chip,
  Appbar,
  Button,
} from 'react-native-paper';
import { getAnimalById } from '@services/animalsService';
import type { AnimalDoc } from '@models/animal';
import MediaGrid from '@components/MediaGrid';
import { listAnimalImages } from '@services/storageService';
import Loading from '@components/feedback/Loading';

interface Props {
  route: { params: { id: string } };
  navigation: any;
}

const AnimalDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const [doc, setDoc] = useState<AnimalDoc | undefined>();
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const d = await getAnimalById(id);
      setDoc(d);
      setLoading(false);
      if (d) {
        try {
          const urls = await listAnimalImages(id, 6);
          setMedia(urls);
        } catch {
          /* carpeta vacía -> ok */
        }
      }
    })();
  }, [id]);

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={doc?.name ?? 'Perfil'} />
      </Appbar.Header>

      {loading ? (
        <Loading variant="inline" message="Cargando perfil…" />
      ) : !doc ? (
        <Text style={{ margin: 16 }}>No encontrado.</Text>
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <View style={styles.block}>
            <Text variant="headlineSmall">{doc.name}</Text>
            <Text variant="bodyMedium">
              {doc.species} • {doc.size} • {doc.sex} • {doc.ageMonths} meses
            </Text>
            <View style={styles.row}>
              <Chip>{doc.mixedBreed ? 'Mestizo' : (doc.breed ?? '—')}</Chip>
              <Chip>{doc.sterilized ? 'Esterilizado' : 'Sin esterilizar'}</Chip>
              <Chip>
                {doc.vaccinated ? 'Vacunas al día' : 'Vacunas pendientes'}
              </Chip>
              {doc.urgent ? <Chip mode="outlined">Urgente</Chip> : null}
            </View>
            <Text variant="bodySmall">
              {doc.location.city ? `${doc.location.city}, ` : ''}
              {doc.location.country}
            </Text>
          </View>

          {media.length > 0 ? <MediaGrid urls={media} /> : null}

          <View style={styles.block}>
            <Button mode="contained">¡Quiero adoptar!</Button>
          </View>
        </ScrollView>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  block: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
});

export default AnimalDetailScreen;
