import React, { useMemo, useState } from 'react';
import { TextInput, HelperText } from 'react-native-paper';
import SelectDialog, { type Option } from './SelectDialog';

interface Props {
  label: string;
  value?: string; // puede estar indefinido
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
  const [open, setOpen] = useState(false);

  const displayLabel = useMemo(() => {
    const found = options.find(o => o.value === value);
    return found?.label ?? '';
  }, [options, value]);

  // Para exactOptionalPropertyTypes: solo pasamos placeholder si existe
  const inputOptional = placeholder ? { placeholder } : {};

  return (
    <>
      <TextInput
        mode="outlined"
        dense
        label={label}
        value={displayLabel}
        right={<TextInput.Icon icon="menu-down" />}
        onFocus={() => setOpen(true)}
        onPressIn={() => setOpen(true)}
        editable={false}
        {...inputOptional}
      />
      {errorText ? (
        <HelperText type="error" visible>
          {errorText}
        </HelperText>
      ) : null}

      <SelectDialog
        visible={open}
        onDismiss={() => setOpen(false)}
        title={label}
        value={value} // puede ser undefined (válido)
        options={options}
        onSelect={v => onChange(v)}
      />
    </>
  );
};

export default SelectInput;
