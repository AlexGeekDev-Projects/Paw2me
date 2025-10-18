import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Searchbar, Text } from 'react-native-paper';

export type ExploreTopBarProps = Readonly<{
  title?: string;
  searchOpen: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  query: string;
  onChangeQuery: (q: string) => void;
  onOpenFilters: () => void;
}>;

const ExploreTopBar: React.FC<ExploreTopBarProps> = ({
  title = 'Paw2me',
  searchOpen,
  onOpenSearch,
  onCloseSearch,
  query,
  onChangeQuery,
  onOpenFilters,
}) => {
  return (
    <View style={styles.headerWrap}>
      {!searchOpen ? (
        <View style={styles.titleRow}>
          <Text variant="titleLarge" style={styles.appTitle}>
            {title}
          </Text>
          <View style={styles.actionsRow}>
            <IconButton
              icon="tune-variant"
              onPress={onOpenFilters}
              accessibilityLabel="Abrir filtros"
            />
            <IconButton
              icon="magnify"
              onPress={onOpenSearch}
              accessibilityLabel="Abrir búsqueda"
            />
          </View>
        </View>
      ) : (
        <Searchbar
          placeholder="Buscar huellitas…"
          autoCorrect
          autoCapitalize="none"
          value={query}
          onChangeText={onChangeQuery}
          style={styles.search}
          autoFocus
          icon="arrow-left"
          onIconPress={onCloseSearch}
          /* ✅ nombres correctos en RNPaper */
          right={() => (
            <IconButton icon="close" onPress={() => onChangeQuery('')} />
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerWrap: { gap: 8, marginBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  appTitle: { fontWeight: '800', letterSpacing: 0.3 },
  search: { borderRadius: 14 },
});

export default ExploreTopBar;
