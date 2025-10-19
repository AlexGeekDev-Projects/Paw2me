import React, { useMemo, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import SelectDialog, { type Option } from './SelectDialog';

interface Props {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: readonly Option[];
  errorText?: string;
  placeholder?: string;
}

const SelectInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  options,
  errorText,
  placeholder,
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const selectedLabel = useMemo<string>(() => {
    if (!value) return '';
    const found = options.find(o => o.value === value);
    return found?.label ?? '';
  }, [value, options]);

  const showValue = selectedLabel || placeholder || '';

  return (
    <>
      {/* Capturamos toques sobre TODO el campo */}
      <Pressable onPress={() => setOpen(true)}>
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            value={showValue}
            editable={false}
            right={
              <TextInput.Icon
                icon="chevron-down"
                // Muy importante: sin esto, el icono intenta enfocar el input
                forceTextInputFocus={false}
                onPress={() => setOpen(true)}
              />
            }
          />
        </View>
      </Pressable>

      {errorText ? (
        <HelperText type="error" visible>
          {errorText}
        </HelperText>
      ) : null}

      <SelectDialog
        visible={open}
        onDismiss={() => setOpen(false)}
        title={label}
        value={value}
        options={options}
        onSelect={v => onChange(v)}
      />
    </>
  );
};

export default SelectInput;
