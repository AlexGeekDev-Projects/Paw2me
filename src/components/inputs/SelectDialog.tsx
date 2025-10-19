import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Button, TextInput, List, Surface, Text } from 'react-native-paper';

export interface Option {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  options: readonly Option[];
  value?: string | undefined;
  onSelect: (value: string) => void;
}

const SCREEN = Dimensions.get('window');
const MAX_SHEET_HEIGHT = Math.min(520, Math.floor(SCREEN.height * 0.85));

const SelectDialog: React.FC<Props> = ({
  visible,
  onDismiss,
  title,
  options,
  value,
  onSelect,
}) => {
  const [query, setQuery] = useState<string>('');

  // animación del sheet
  const translateY = useRef(new Animated.Value(MAX_SHEET_HEIGHT)).current;
  const openSheet = () =>
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  const closeSheet = (after?: () => void) =>
    Animated.timing(translateY, {
      toValue: MAX_SHEET_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) after?.();
    });

  useEffect(() => {
    if (visible) {
      // reset búsqueda y abre
      setQuery('');
      // arranca desde abajo por si quedó a mitad
      translateY.setValue(MAX_SHEET_HEIGHT);
      openSheet();
    } else {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // gesture para arrastrar hacia abajo y cerrar
  const pan = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const dy = Math.max(0, g.dy);
        pan.setValue(dy);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > 80 || g.vy > 0.8;
        if (shouldClose) {
          // combina offset actual + arrastre y cierra
          pan.setValue(0);
          closeSheet(onDismiss);
        } else {
          // regresa al estado abierto
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const translate = Animated.add(translateY, pan);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      statusBarTranslucent
      presentationStyle={
        Platform.OS === 'ios' ? 'overFullScreen' : 'overFullScreen'
      }
      onRequestClose={() => closeSheet(onDismiss)}
    >
      {/* Fondo: cierra al tocar fuera */}
      <Pressable style={styles.backdrop} onPress={() => closeSheet(onDismiss)}>
        {/* Contenedor para capturar pan sin cerrar al tocar dentro */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: translate }] },
          ]}
        >
          <Surface style={styles.sheet} elevation={2}>
            {/* handler de arrastre */}
            <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
              <View style={styles.dragHandle} />
            </View>

            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>

            <TextInput
              mode="outlined"
              dense
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar…"
              style={styles.search}
            />

            <FlatList
              data={data}
              keyExtractor={item => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <List.Item
                  title={item.label}
                  onPress={() => {
                    onSelect(item.value);
                    closeSheet(onDismiss);
                  }}
                  right={props =>
                    item.value === value ? (
                      <List.Icon {...props} icon="check" />
                    ) : null
                  }
                />
              )}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />

            <View style={styles.actions}>
              <Button onPress={() => closeSheet(onDismiss)}>Cerrar</Button>
            </View>
          </Surface>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    maxHeight: MAX_SHEET_HEIGHT,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 2,
  },
  dragHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  search: { marginHorizontal: 16, marginBottom: 8 },
  list: { maxHeight: MAX_SHEET_HEIGHT - 140 },
  listContent: { paddingVertical: 4 },
  actions: { alignItems: 'flex-end', padding: 8, paddingRight: 12 },
});

export default SelectDialog;
