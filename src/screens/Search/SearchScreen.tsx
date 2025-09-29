import React from 'react';
import Screen from '@components/layout/Screen';
import { TextInput, SegmentedButtons, Text, Button } from 'react-native-paper';
import { useFiltersStore } from '@store/useFiltersStore';

const SearchScreen = () => {
  const { text, setText, reset, species, setSpecies } = useFiltersStore();

  return (
    <Screen>
      <Text variant="headlineSmall">Buscar</Text>
      <TextInput
        mode="outlined"
        label="Palabra clave"
        value={text}
        onChangeText={setText}
        placeholder="Ej. mestizo, cachorro, esterilizado"
        style={{ marginTop: 12 }}
      />
      <SegmentedButtons
        style={{ marginTop: 12 }}
        value={species ?? 'any'}
        onValueChange={v =>
          setSpecies(
            v === 'any'
              ? null
              : (v as typeof species extends string
                  ? never
                  : any as never as any),
          )
        }
        buttons={[
          { value: 'any', label: 'Todos' },
          { value: 'dog', label: 'Perros' },
          { value: 'cat', label: 'Gatos' },
        ]}
      />
      <Button style={{ marginTop: 12 }} onPress={reset}>
        Limpiar filtros
      </Button>
    </Screen>
  );
};

export default SearchScreen;
