import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { IconButton } from 'react-native-paper';

type Props = {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onLocate?: () => void;
};

const MapControls: React.FC<Props> = ({ onZoomIn, onZoomOut, onLocate }) => {
  const handleZoomIn = (e: GestureResponderEvent) => {
    void e;
    onZoomIn?.();
  };
  const handleZoomOut = (e: GestureResponderEvent) => {
    void e;
    onZoomOut?.();
  };
  const handleLocate = (e: GestureResponderEvent) => {
    void e;
    onLocate?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.column}>
        <IconButton
          icon="plus"
          mode="contained-tonal"
          onPress={handleZoomIn}
          style={styles.btn}
          size={24}
          disabled={!onZoomIn}
        />
        <IconButton
          icon="minus"
          mode="contained-tonal"
          onPress={handleZoomOut}
          style={styles.btn}
          size={24}
          disabled={!onZoomOut}
        />
        <IconButton
          icon="crosshairs-gps"
          mode="contained"
          onPress={handleLocate}
          style={styles.btn}
          size={24}
          disabled={!onLocate}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // clave: absolute + zIndex + elevation para vencer al MapView nativo
  container: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    zIndex: 10,
    elevation: 8,
  },
  column: { gap: 6, alignItems: 'center' },
  btn: { borderRadius: 999 },
});

export default memo(MapControls);
