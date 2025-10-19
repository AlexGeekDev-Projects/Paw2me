import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
}

const PageHeader: React.FC<Props> = ({
  title,
  subtitle,
  onBack,
  rightIcon = 'paw',
  onRightPress,
  rightAccessibilityLabel = 'Acción',
}) => {
  const { top } = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View style={[styles.container]}>
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

        <View style={[styles.center, subtitle ? { gap: 2 } : undefined]}>
          <Text variant="headlineSmall">{title}</Text>
          {subtitle ? (
            <Text variant="bodySmall" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {onRightPress ? (
          <IconButton
            icon={rightIcon}
            onPress={onRightPress}
            accessibilityLabel={rightAccessibilityLabel}
          />
        ) : (
          <IconButton icon={rightIcon} disabled />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  subtitle: {
    opacity: 0.7,
  },
});

export default PageHeader;
