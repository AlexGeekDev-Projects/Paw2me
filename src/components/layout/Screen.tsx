import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

interface Props {
  scrollable?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

const Screen: React.FC<Props> = ({ scrollable, children, style }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const baseStyle = {
    backgroundColor: theme.colors.background,
    flex: 1,
  } satisfies ViewStyle;

  if (scrollable) {
    return (
      <ScrollView
        style={[baseStyle, { paddingTop: insets.top }, style]}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexGrow: 1,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[baseStyle, { paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
};

export default Screen;
