import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

const PageHeader: React.FC<Props> = ({ title, subtitle, onBack }) => {
  const { top } = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View style={[styles.container, { paddingTop: top + 6 }]}>
      <View style={styles.row}>
        {onBack ? (
          <IconButton
            icon="arrow-left"
            onPress={onBack}
            accessibilityLabel="Volver"
          />
        ) : (
          <View style={{ width: 48 }} />
        )}
        <View style={styles.center}>
          <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySmall" style={{ opacity: 0.7 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <IconButton icon="paw" disabled />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
});

export default PageHeader;
