import React, { useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { Dialog, Portal, Button, TextInput, List } from 'react-native-paper';

export interface Option {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  options: readonly Option[];
  // 👇 explícitamente opcional (compatible con exactOptionalPropertyTypes)
  value?: string | undefined;
  onSelect: (value: string) => void;
  searchable?: boolean;
}

const SelectDialog: React.FC<Props> = ({
  visible,
  onDismiss,
  title,
  options,
  value,
  onSelect,
  searchable = true,
}) => {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!searchable || query.length === 0) return options;
    return options.filter(o => o.label.toLowerCase().includes(query));
  }, [q, options, searchable]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>

        {searchable ? (
          <Dialog.Content style={{ paddingBottom: 0 }}>
            <TextInput
              mode="outlined"
              dense
              value={q}
              onChangeText={setQ}
              placeholder="Buscar…"
            />
          </Dialog.Content>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={it => it.value}
          renderItem={({ item }) => (
            <List.Item
              title={item.label}
              onPress={() => {
                onSelect(item.value);
                onDismiss();
              }}
              right={props =>
                value === item.value ? (
                  <List.Icon {...props} icon="check" />
                ) : null
              }
            />
          )}
          style={{ maxHeight: 360 }}
        />

        <Dialog.Actions>
          <Button onPress={onDismiss}>Cerrar</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default SelectDialog;
