import {
  forwardRef,
  type ComponentRef,
} from 'react';
import { Input, type InputProps } from '../input';
import { useFormFieldContext } from '../form-field/form-field';

type SearchFieldProps = Omit<InputProps, 'className' | 'type'> & {
  readonly className?: string;
  readonly inputClassName?: string;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const SearchField = forwardRef<ComponentRef<'input'>, SearchFieldProps>(function SearchField(
  {
    className,
    inputClassName,
    invalid,
    placeholder = 'Search...',
    readOnly = false,
    ...props
  },
  ref
) {
  const field = useFormFieldContext();
  const resolvedInvalid = invalid ?? field?.invalid ?? false;
  const dataState = resolvedInvalid ? 'invalid' : readOnly ? 'read-only' : 'normal';

  return (
    <div className={cx('resend-ui-search-field', className)} data-size="2" data-state={dataState}>
      <div className="resend-ui-search-field__slot" data-side="left">
        <span className="resend-ui-search-field__slot-frame">
          <div aria-hidden="true" style={{ height: 16, width: 16 }} />
        </span>
      </div>
      <Input
        className={inputClassName}
        invalid={resolvedInvalid}
        placeholder={placeholder}
        readOnly={readOnly}
        ref={ref}
        type="text"
        {...props}
      />
    </div>
  );
});

export { SearchField };
export type { SearchFieldProps };
