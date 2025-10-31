// src/screens/Animal/AnimalDetailScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import {
  Text,
  Chip,
  Button,
  useTheme,
  Divider,
  Card,
  List,
  Badge,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '@components/layout/Screen';
import MediaGrid from '@components/MediaGrid';
import Loading from '@components/feedback/Loading';
import { getAnimalById } from '@services/animalsService';
import type { AnimalDoc } from '@models/animal';
import {
  listenReactionCounts,
  listenUserReaction,
  type ReactionCountsDoc,
  type FireReactionKey,
} from '@services/reactionsService';
import { useAuth } from '@hooks/useAuth';

interface Props {
  route: { params: { id: string } };
}

/* —— utilidades seguras —— */
const capitalize = (s?: string): string => {
  const v = s ?? '';
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
};

const formatAge = (m?: number): string => {
  if (!Number.isFinite(m ?? NaN) || (m ?? 0) < 0) return 'Sin dato';
  const months = Math.round(m ?? 0);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (rest > 0 || years === 0)
    parts.push(`${rest} ${rest === 1 ? 'mes' : 'meses'}`);
  return parts.join(' ');
};

const formatDate = (ts?: unknown): string => {
  const d =
    typeof (ts as any)?.toDate === 'function'
      ? ((ts as any).toDate() as Date)
      : ts instanceof Date
      ? ts
      : undefined;
  return d ? d.toLocaleDateString() : '—';
};

const AnimalDetailScreen: React.FC<Props> = ({ route }) => {
  const { id } = route.params;
  const theme = useTheme();
  const { colors, dark } = theme as any;
  const insets = useSafeAreaInsets();

  const [doc, setDoc] = useState<AnimalDoc>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'fotos' | 'adoptar'>('info');

  const { user } = useAuth(); // ya tipado en tu proyecto

  const [counts, setCounts] = useState<ReactionCountsDoc | null>(null);
  const [userKey, setUserKey] = useState<FireReactionKey | null>(null);

  // escucha contadores agregados y reacción del usuario
  useEffect(() => {
    const offCounts = listenReactionCounts(id, setCounts);
    let offUser: (() => void) | undefined;
    if (user?.uid) offUser = listenUserReaction(id, user.uid, setUserKey);
    return () => {
      offCounts();
      offUser?.();
    };
  }, [id, user?.uid]);

  // derivados seguros (fallback a 0 / doc.matchCount si existe)
  const loveCount = counts?.love ?? 0;
  const sadCount = counts?.sad ?? 0;
  const matchCount = counts?.match ?? doc?.matchCount ?? 0;

  useEffect(() => {
    (async () => {
      const d = await getAnimalById(id);
      setDoc(d);
      setLoading(false);
    })();
  }, [id]);

  const surface = useMemo(
    () => colors.elevation?.level2 ?? colors.surface,
    [colors],
  );
  const divider = useMemo(
    () => (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
    [dark],
  );
  const mediaCount = useMemo(
    () => doc?.mediaCount ?? doc?.images?.length ?? 0,
    [doc?.mediaCount, doc?.images?.length],
  );

  /* —— subcomponentes —— */
  type InfoTileProps = { icon: string; label: string; value?: string };
  const InfoTile: React.FC<InfoTileProps> = ({ icon, label, value }) => {
    if (value == null || value === '') return null; // jamás renderear si no hay valor
    return (
      <View
        style={[
          styles.infoTile,
          { backgroundColor: surface, borderColor: divider },
        ]}
      >
        <List.Item
          title={value}
          description={label}
          titleNumberOfLines={2}
          descriptionStyle={{ opacity: 0.7, marginTop: 2 }}
          left={p => <List.Icon {...p} icon={icon} />}
          style={{ paddingHorizontal: 8 }}
        />
      </View>
    );
  };

  const StatusChip: React.FC = () => {
    if (!doc?.status) return null;
    const statusLabel =
      doc.status === 'disponible'
        ? 'Disponible'
        : doc.status === 'en_proceso'
        ? 'En proceso'
        : doc.status === 'adoptado'
        ? 'Adoptado'
        : capitalize(doc.status);
    const statusIcon =
      doc.status === 'disponible'
        ? 'check-circle'
        : doc.status === 'adoptado'
        ? 'paw'
        : 'progress-clock';
    return <Chip icon={statusIcon}>{statusLabel}</Chip>;
  };

  if (loading)
    return <Loading variant="fullscreen" message="Cargando perfil…" />;
  if (!doc) return <Text style={{ margin: 16 }}>No encontrado.</Text>;

  return (
    <Screen style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        stickyHeaderIndices={[doc.coverUrl ? 1 : 0]}
        showsVerticalScrollIndicator={false}
      >
        {/* Portada */}
        {doc.coverUrl ? (
          <Image
            source={{ uri: doc.coverUrl }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : null}

        {/* Tabs (sticky) */}
        <View
          style={[
            styles.tabsContainer,
            {
              backgroundColor: surface,
              borderTopColor: divider,
              borderBottomColor: divider,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            <Chip
              compact
              showSelectedCheck
              selected={tab === 'info'}
              onPress={() => setTab('info')}
              style={[
                styles.tabChip,
                tab === 'info' && { backgroundColor: colors.primaryContainer },
              ]}
              textStyle={
                tab === 'info'
                  ? { color: colors.onPrimaryContainer, fontWeight: '600' }
                  : undefined
              }
            >
              Información
            </Chip>

            <Chip
              compact
              showSelectedCheck
              selected={tab === 'fotos'}
              onPress={() => setTab('fotos')}
              style={[
                styles.tabChip,
                tab === 'fotos' && { backgroundColor: colors.primaryContainer },
              ]}
              textStyle={
                tab === 'fotos'
                  ? { color: colors.onPrimaryContainer, fontWeight: '600' }
                  : undefined
              }
            >
              {`Fotos${mediaCount ? ` (${mediaCount})` : ''}`}
            </Chip>

            <Chip
              compact
              showSelectedCheck
              selected={tab === 'adoptar'}
              onPress={() => setTab('adoptar')}
              style={[
                styles.tabChip,
                tab === 'adoptar' && {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
              textStyle={
                tab === 'adoptar'
                  ? { color: colors.onPrimaryContainer, fontWeight: '600' }
                  : undefined
              }
            >
              {`Adoptar${matchCount > 0 ? ` (${matchCount})` : ''}`}
            </Chip>
          </ScrollView>
        </View>

        {/* Contenido */}
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background },
            tab === 'fotos' && { paddingHorizontal: 0 },
          ]}
        >
          {tab === 'info' && (
            <>
              {/* Título + subtítulo */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="headlineMedium" style={styles.name}>
                  {doc.name}
                </Text>
                {doc.visibility ? (
                  <Chip
                    icon={doc.visibility === 'public' ? 'earth' : 'lock'}
                    compact
                  >
                    {doc.visibility === 'public' ? 'Pública' : 'Privada'}
                  </Chip>
                ) : null}
              </View>

              <Text variant="bodyMedium" style={styles.subtitle}>
                {`${capitalize(doc.species)} • ${doc.size} • ${
                  doc.sex
                } • ${formatAge(doc.ageMonths)}`}
              </Text>

              {(doc.location?.city || doc.location?.country) && (
                <Text variant="bodySmall" style={styles.location}>
                  {doc.location?.city ? `${doc.location.city}, ` : ''}
                  {doc.location?.country ?? ''}
                </Text>
              )}

              {/* —— HISTORIA permanece arriba —— */}
              {doc.story ? (
                <>
                  <Text variant="titleMedium" style={styles.sectionTitle}>
                    Historia
                  </Text>
                  <Text variant="bodyLarge" style={styles.story}>
                    {doc.story}
                  </Text>
                </>
              ) : null}

              <Divider
                style={{ marginVertical: 16, backgroundColor: divider }}
              />

              {/* Chips de estado */}
              <View style={styles.quickChips}>
                <Chip icon="dna">
                  {doc.mixedBreed ? 'Mestizo' : doc.breed ?? 'Raza desconocida'}
                </Chip>
                <Chip icon="needle">
                  {doc.vaccinated ? 'Vacunado' : 'Vacunas pendientes'}
                </Chip>
                <Chip icon="scissors-cutting">
                  {doc.sterilized ? 'Esterilizado' : 'No esterilizado'}
                </Chip>
                <StatusChip />
                {(doc.tags ?? []).map((t, i) => (
                  <Chip key={`${t}-${i}`} icon="tag">
                    {t}
                  </Chip>
                ))}
              </View>

              {/* Reacciones (Interesados primero) */}
              <View style={styles.reactionRow}>
                <Chip
                  compact
                  icon="handshake-outline"
                  style={[
                    styles.reactionChip,
                    { backgroundColor: colors.primaryContainer },
                  ]}
                  textStyle={{
                    color: colors.onPrimaryContainer,
                    fontWeight: '600',
                  }}
                >
                  Interesados {matchCount}
                </Chip>

                <Chip
                  compact
                  icon="heart-outline"
                  style={styles.reactionChip}
                  textStyle={{ fontWeight: '600' }}
                >
                  {loveCount}
                </Chip>

                <Chip
                  compact
                  icon="emoticon-sad-outline"
                  style={styles.reactionChip}
                  textStyle={{ fontWeight: '600' }}
                >
                  {sadCount}
                </Chip>
              </View>

              {/* Ficha técnica */}
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Ficha
              </Text>
              <View style={styles.fichaGrid}>
                <InfoTile
                  icon="paw-outline"
                  label="Especie"
                  {...(doc.species ? { value: capitalize(doc.species) } : {})}
                />
                <InfoTile
                  icon="ruler-square"
                  label="Tamaño"
                  {...(doc.size ? { value: doc.size } : {})}
                />
                <InfoTile
                  icon="gender-male-female"
                  label="Sexo"
                  {...(doc.sex ? { value: doc.sex } : {})}
                />
                <InfoTile
                  icon="cake-variant"
                  label="Edad"
                  {...(doc.ageMonths != null
                    ? { value: formatAge(doc.ageMonths) }
                    : {})}
                />
                <InfoTile
                  icon="map-marker"
                  label="Ciudad"
                  {...(doc.location?.city ? { value: doc.location.city } : {})}
                />
                <InfoTile
                  icon="map"
                  label="País"
                  {...(doc.location?.country
                    ? { value: doc.location.country }
                    : {})}
                />
                <InfoTile
                  icon="calendar"
                  label="Publicado"
                  {...(doc.createdAt
                    ? { value: formatDate(doc.createdAt) }
                    : {})}
                />
                <InfoTile
                  icon="cellphone"
                  label="Origen"
                  {...(doc.createdByPlatform
                    ? { value: capitalize(doc.createdByPlatform) }
                    : {})}
                />
                <InfoTile
                  icon="eye"
                  label="Visibilidad"
                  {...(doc.visibility
                    ? {
                        value:
                          doc.visibility === 'public' ? 'Pública' : 'Privada',
                      }
                    : {})}
                />
                <InfoTile
                  icon="account-badge"
                  label="Propietario"
                  {...(doc.ownerType
                    ? { value: capitalize(doc.ownerType) }
                    : {})}
                />
                <InfoTile
                  icon="image-multiple-outline"
                  label="Fotos"
                  value={String(mediaCount)}
                />
                <InfoTile
                  icon="hand-heart"
                  label="Interesados"
                  value={String(matchCount ?? 0)}
                />
              </View>

              {/* —— Dirección vuelve a su lugar (abajo) —— */}
              {doc.address ? (
                <Card
                  mode="contained"
                  style={[styles.addressCard, { backgroundColor: surface }]}
                >
                  <View style={styles.addressClip}>
                    <List.Item
                      left={props => <List.Icon {...props} icon="map-marker" />}
                      // Título como componente para permitir wrap ilimitado
                      title={() => (
                        <Text variant="bodyMedium" style={styles.addressTitle}>
                          {doc.address}
                        </Text>
                      )}
                      // Descripción compacta "Ciudad, País" si existe
                      description={(() => {
                        const city = doc.location?.city;
                        const country = doc.location?.country;
                        const desc = [city, country].filter(Boolean).join(', ');
                        return desc.length > 0 ? desc : undefined;
                      })()}
                      descriptionNumberOfLines={10}
                      titleEllipsizeMode="clip"
                      descriptionEllipsizeMode="clip"
                      style={{ paddingRight: 8 }} // un poco más de aire
                    />
                  </View>
                </Card>
              ) : null}
            </>
          )}

          {tab === 'fotos' && (doc.images?.length ?? 0) > 0 && (
            <View style={styles.galleryContainer}>
              <View style={styles.galleryHeader}>
                <Text variant="titleMedium" style={styles.galleryTitle}>
                  Galería
                </Text>
                {mediaCount ? (
                  <Badge size={20} style={{ alignSelf: 'center' }}>
                    {mediaCount}
                  </Badge>
                ) : null}
              </View>
              <MediaGrid urls={doc.images ?? []} />
            </View>
          )}

          {tab === 'adoptar' && (
            <View style={styles.ctaContainer}>
              <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                Pronto verás aquí los requisitos y pasos para la adopción.
                Mientras tanto, puedes expresar tu interés.
              </Text>
              <Button mode="contained" style={styles.cta}>
                ¡Quiero adoptar!
              </Button>
              <View style={{ height: 8 }} />
              <Text variant="bodySmall" style={{ opacity: 0.7 }}>
                ID de huellita: {doc.pawId}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  cover: { width: '100%', height: 320 },
  tabsContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 12,
    columnGap: 20,
  },
  tabChip: { paddingHorizontal: 6 },

  container: { paddingHorizontal: 16, paddingTop: 24 },
  name: { fontWeight: 'bold' },
  subtitle: { marginTop: 4, opacity: 0.85 },
  location: { marginTop: 4, opacity: 0.7 },

  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },

  sectionTitle: { marginTop: 18, marginBottom: 8, fontWeight: '600' },

  fichaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoTile: {
    width: '48%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  story: { lineHeight: 22 },
  addressCard: {
    marginTop: 12,
    borderRadius: 12,
  },
  addressClip: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addressTitle: {
    // asegura wrap completo
    flexShrink: 1,
    lineHeight: 20,
  },

  galleryContainer: { marginTop: 8 },
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  galleryTitle: {},

  ctaContainer: { marginTop: 8, paddingBottom: 32 },
  cta: { borderRadius: 8, paddingVertical: 6 },

  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  reactionChip: {
    borderRadius: 14,
    paddingHorizontal: 10,
  },
});

export default AnimalDetailScreen;
