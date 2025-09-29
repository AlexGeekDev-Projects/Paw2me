import React, { type PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const Screen = ({ children }: PropsWithChildren) => {
  const theme = useTheme();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {children}
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({ container: { flex: 1, padding: 16 } });
export default Screen;
