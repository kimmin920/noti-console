import { useMemo, useState } from 'react';
import { FormLabel } from '../../primitives/form-field';
import { Select } from '../../primitives/select';
import { DatePickerPresets } from '../date-picker-presets';
import { exportFieldConfigs } from './data';
import type { ExportFieldId, ExportModalPayload } from './types';

type ExportFieldsProps = {
  readonly fields: readonly ExportFieldId[];
  readonly onChange: (payload: Partial<ExportModalPayload>) => void;
};

export function ExportFields({ fields, onChange }: ExportFieldsProps) {
  const initialValues = useMemo(
    () => Object.fromEntries(fields.map((field) => [field, exportFieldConfigs[field].defaultValue])),
    [fields]
  );
  const [values, setValues] = useState(initialValues);

  function handleValueChange(field: ExportFieldId, value: string) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    onChange(nextValues);
  }

  return (
    <div className="resend-ui-export-modal__fields">
      {fields.map((field) => {
        const config = exportFieldConfigs[field];
        const value = values[field] ?? config.defaultValue;

        if (field === 'date') {
          return (
            <div className="resend-ui-export-modal__field" data-resend-domain-export-field key={field}>
              <FormLabel data-resend-domain-export-field-label>{config.label}</FormLabel>
              <DatePickerPresets
                className="resend-ui-export-modal__field-trigger"
                containerId="export-modal-content"
                initialPresetIndex={4}
                onChange={(_range, selection) => handleValueChange(field, selection.text)}
              />
              <span data-resend-domain-export-field-value hidden>
                {labelForValue(field, value)}
              </span>
            </div>
          );
        }

        return (
          <div className="resend-ui-export-modal__field" data-resend-domain-export-field key={field}>
            <FormLabel data-resend-domain-export-field-label>{config.label}</FormLabel>
            <Select.Root
              onValueChange={(value) => handleValueChange(field, value)}
              value={values[field] ?? config.defaultValue}
            >
              <Select.Trigger
                aria-label={config.label}
                className="resend-ui-export-modal__field-trigger"
              >
                <span data-resend-domain-export-field-value>
                  {labelForValue(field, values[field] ?? config.defaultValue)}
                </span>
              </Select.Trigger>
              <Select.Content className="resend-ui-export-modal__field-content">
                {config.options.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>
        );
      })}
    </div>
  );
}

function labelForValue(field: ExportFieldId, value: string) {
  const config = exportFieldConfigs[field];
  return config.options.find((option) => option.value === value)?.label ?? value;
}
