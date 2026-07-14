import { useCallback, useState } from 'react';

type UseControllableValueOptions<T> = {
  readonly controlledValue?: T | undefined;
  readonly defaultValue: T;
  readonly onValueChange?: ((value: T) => void) | undefined;
};

function useControllableValue<T>({
  controlledValue,
  defaultValue,
  onValueChange,
}: UseControllableValueOptions<T>) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  const setValue = useCallback((nextValue: T) => {
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  }, [controlledValue, onValueChange]);

  return [value, setValue] as const;
}

export { useControllableValue };
