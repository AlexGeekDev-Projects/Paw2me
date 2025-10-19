// src/components/explore/ExploreTopBar.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  IconButton,
  Searchbar,
  Text,
  Badge,
  ActivityIndicator,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

export type ExploreTopBarProps = Readonly<{
  title?: string;
  searchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  query: string;
  onCommitQuery: (q: string) => void;
  onOpenFilters: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  activeFiltersCount?: number;

  // opcionales (ojo con exactOptionalPropertyTypes)
  distanceKm?: number;
  onClearDistance?: () => void;

  location: { locating: boolean; hasCenter: boolean; error?: string };
  onRetryLocate: () => void;

  suggestSettings?: boolean;
  onOpenSettings?: () => void;
}>;

const DEBOUNCE_MS = 280;

const applyAlpha = (color: string, a: number) => {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const m = color.match(/rgba?\((\d+),\s?(\d+),\s?(\d+)/i);
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})` : color;
};

const ExploreTopBar: React.FC<ExploreTopBarProps> = ({
  title = 'Paw2me',
  searchOpen,
  onOpenSearch,
  onCloseSearch,
  query,
  onCommitQuery,
  onOpenFilters,
  onClearFilters,
  hasActiveFilters,
  activeFiltersCount,
  distanceKm,
  onClearDistance,
  location,
  onRetryLocate,
  suggestSettings,
  onOpenSettings,
}) => {
  const theme = useTheme();
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    if (searchOpen) setLocalQuery(query);
  }, [searchOpen, query]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => {
      if (localQuery !== query) onCommitQuery(localQuery.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [localQuery, query, searchOpen, onCommitQuery]);

  const badgeContent = useMemo(() => {
    if (!activeFiltersCount || activeFiltersCount <= 0) return undefined;
    return activeFiltersCount > 9 ? '9+' : String(activeFiltersCount);
  }, [activeFiltersCount]);

  return (
    <View style={styles.headerWrap}>
      {!searchOpen ? (
        <>
          <View style={styles.titleRow}>
            <Text variant="titleLarge" style={styles.appTitle}>
              {title}
            </Text>
            <View style={styles.actionsRow}>
              <IconButton
                icon="filter-variant-remove"
                onPress={onClearFilters}
                disabled={!hasActiveFilters}
                accessibilityLabel="Limpiar filtros"
              />
              <View style={styles.iconWrap}>
                <IconButton
                  icon="tune-variant"
                  onPress={onOpenFilters}
                  accessibilityLabel="Abrir filtros"
                />
                {hasActiveFilters && badgeContent ? (
                  <Badge style={styles.badge} size={16}>
                    {badgeContent}
                  </Badge>
                ) : null}
              </View>
              <IconButton
                icon="magnify"
                onPress={onOpenSearch}
                accessibilityLabel="Abrir búsqueda"
              />
            </View>
          </View>

          {/* Estado de ubicación + radio activo */}
          <View style={styles.locationRow}>
            {location.locating ? (
              <>
                <ActivityIndicator size="small" />
                <Text
                  variant="bodySmall"
                  style={styles.locationText}
                  numberOfLines={1}
                >
                  Obteniendo tu ubicación…
                </Text>
              </>
            ) : location.hasCenter ? (
              <>
                <IconButton
                  icon="map-marker-check-outline"
                  onPress={onRetryLocate}
                  size={18}
                  style={styles.inlineIcon}
                  accessibilityLabel="Ubicación lista (actualizar)"
                />
                <Text
                  variant="bodySmall"
                  style={styles.locationText}
                  numberOfLines={1}
                >
                  Usando tu ubicación
                </Text>
              </>
            ) : (
              <>
                <IconButton
                  icon="crosshairs-gps"
                  onPress={onRetryLocate}
                  size={18}
                  style={styles.inlineIcon}
                  accessibilityLabel="Reintentar ubicación"
                />
                <Text
                  variant="bodySmall"
                  style={[
                    styles.locationText,
                    { color: location.error ? theme.colors.error : undefined },
                  ]}
                  numberOfLines={1}
                >
                  {location.error
                    ? 'Ubicación no disponible'
                    : 'Ubicación no establecida'}
                </Text>
              </>
            )}

            {/* Pastilla “Radio N km” — solo si hay valor */}
            {typeof distanceKm === 'number' ? (
              <TouchableRipple
                onPress={onOpenFilters}
                // 👇 Solo pasamos onLongPress si existe y con la firma correcta
                {...(onClearDistance
                  ? { onLongPress: () => onClearDistance() }
                  : {})}
                borderless
                style={[
                  styles.pill,
                  {
                    backgroundColor: applyAlpha(
                      theme.colors.primary as string,
                      0.1,
                    ),
                    borderColor: applyAlpha(
                      theme.colors.primary as string,
                      0.28,
                    ),
                  },
                ]}
                rippleColor={applyAlpha(theme.colors.primary as string, 0.16)}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: theme.colors.primary as string },
                  ]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  Radio {distanceKm} km
                </Text>
              </TouchableRipple>
            ) : null}

            {/* Acciones rápidas */}
            {location.hasCenter ? (
              <TouchableRipple
                onPress={onRetryLocate}
                borderless
                style={[
                  styles.pill,
                  {
                    backgroundColor: applyAlpha(
                      theme.colors.secondary as string,
                      0.1,
                    ),
                    borderColor: applyAlpha(
                      theme.colors.secondary as string,
                      0.28,
                    ),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    { color: theme.colors.secondary as string },
                  ]}
                >
                  Actualizar
                </Text>
              </TouchableRipple>
            ) : (
              <>
                <TouchableRipple
                  onPress={onRetryLocate}
                  borderless
                  style={[
                    styles.pill,
                    {
                      backgroundColor: applyAlpha(
                        theme.colors.primary as string,
                        0.1,
                      ),
                      borderColor: applyAlpha(
                        theme.colors.primary as string,
                        0.28,
                      ),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: theme.colors.primary as string },
                    ]}
                  >
                    Reintentar
                  </Text>
                </TouchableRipple>
                {suggestSettings && onOpenSettings ? (
                  <TouchableRipple
                    onPress={onOpenSettings}
                    borderless
                    style={[
                      styles.pill,
                      {
                        backgroundColor: applyAlpha('#888888', 0.12),
                        borderColor: applyAlpha('#888888', 0.28),
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: '#666666' }]}>
                      Ajustes
                    </Text>
                  </TouchableRipple>
                ) : null}
              </>
            )}
          </View>
        </>
      ) : (
        <Searchbar
          placeholder="Buscar huellitas…"
          autoCorrect
          autoCapitalize="none"
          value={localQuery}
          onChangeText={setLocalQuery}
          style={styles.search}
          autoFocus
          icon="arrow-left"
          onIconPress={() => {
            setLocalQuery('');
            onCommitQuery('');
            onCloseSearch();
          }}
          right={() => (
            <IconButton
              icon="close"
              onPress={() => {
                setLocalQuery('');
                onCommitQuery('');
              }}
              accessibilityLabel="Limpiar búsqueda"
            />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrap: { gap: 6, marginBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  appTitle: { fontWeight: '800', letterSpacing: 0.3 },
  search: { borderRadius: 14 },

  iconWrap: { position: 'relative', justifyContent: 'center' },
  badge: { position: 'absolute', top: 4, right: 4 },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 2,
    columnGap: 6,
    flexWrap: 'wrap',
  },
  inlineIcon: { margin: 0, width: 28, height: 28 },
  locationText: {
    opacity: 0.85,
    fontSize: 13,
    lineHeight: 18,
    marginRight: 2,
    maxWidth: '50%',
  },

  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default ExploreTopBar;
