import React from 'react';
import { ScrollView } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native'; // <- type-only
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';

type Props = Readonly<{
  children: React.ReactNode;
  scrollable?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Por defecto NO reservamos la zona superior para dejar pasar el contenido bajo el notch. */
  edges?: Edge[];
}>;

const Screen: React.FC<Props> = ({ children, scrollable, style, edges }) => {
  const theme = useTheme();

  const content = (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
      edges={edges ?? ['bottom']}
    >
      {children}
    </SafeAreaView>
  );

  if (scrollable) return <ScrollView bounces>{content}</ScrollView>;
  return content;
};

export default Screen;
