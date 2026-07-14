import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { CopyRecord } from './copy-record';

type DataTableRootProps = ComponentPropsWithoutRef<'table'> & {
  readonly disabled?: boolean;
  readonly fixed?: boolean;
};

type DataTableBodyProps = ComponentPropsWithoutRef<'tbody'> & {
  readonly removeLastBorder?: boolean;
};

type DataTableHeaderWidth = 'actions' | 'email-status' | 'email-to' | 'email-sent';

type DataTableHeaderProps = ComponentPropsWithoutRef<'th'> & {
  readonly align?: 'left' | 'right' | undefined;
  readonly width?: DataTableHeaderWidth | undefined;
};

type DataTableCellProps = ComponentPropsWithoutRef<'td'> & {
  readonly borderless?: boolean;
  readonly mono?: boolean;
};

type DataTableLoadingCellProps = Omit<DataTableCellProps, 'children'> & {
  readonly children?: ReactNode;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

const DataTableRoot = forwardRef<ComponentRef<'table'>, DataTableRootProps>(function DataTableRoot({
  className,
  disabled = false,
  fixed = false,
  ...props
}, ref) {
  return (
    <table
      className={cx(
        'resend-ui-data-table',
        fixed && 'resend-ui-data-table--fixed',
        disabled && 'resend-ui-data-table--disabled',
        className
      )}
      data-disabled={disabled ? '' : undefined}
      ref={ref}
      {...props}
    />
  );
});

const DataTableHead = forwardRef<ComponentRef<'thead'>, ComponentPropsWithoutRef<'thead'>>(
  function DataTableHead({ className, ...props }, ref) {
    return <thead className={cx('resend-ui-data-table__head', className)} ref={ref} {...props} />;
  }
);

const DataTableBody = forwardRef<ComponentRef<'tbody'>, DataTableBodyProps>(function DataTableBody({
  className,
  removeLastBorder = false,
  ...props
}, ref) {
  return (
    <tbody
      className={cx(
        'resend-ui-data-table__body',
        removeLastBorder && 'resend-ui-data-table__body--remove-last-border',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

const DataTableRow = forwardRef<ComponentRef<'tr'>, ComponentPropsWithoutRef<'tr'>>(
  function DataTableRow({ className, ...props }, ref) {
    return <tr className={cx('resend-ui-data-table__row', className)} ref={ref} {...props} />;
  }
);

const DataTableHeader = forwardRef<ComponentRef<'th'>, DataTableHeaderProps>(function DataTableHeader({
  align = 'left',
  className,
  scope = 'col',
  width,
  ...props
}, ref) {
  return (
    <th
      className={cx(
        'resend-ui-data-table__header',
        align === 'right' && 'resend-ui-data-table__header--right',
        width !== undefined && `resend-ui-data-table__header--${width}`,
        className
      )}
      scope={scope}
      ref={ref}
      {...props}
    />
  );
});

const DataTableCell = forwardRef<ComponentRef<'td'>, DataTableCellProps>(function DataTableCell({
  borderless = false,
  className,
  mono = false,
  ...props
}, ref) {
  return (
    <td
      className={cx(
        'resend-ui-data-table__cell',
        mono && 'resend-ui-data-table__cell--mono',
        borderless && 'resend-ui-data-table__cell--borderless',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

const DataTableLoadingCell = forwardRef<ComponentRef<'td'>, DataTableLoadingCellProps>(
  function DataTableLoadingCell({ children = null, ...props }, ref) {
    return <DataTableCell ref={ref} {...props}>{children}</DataTableCell>;
  }
);

const DataTable = {
  Body: DataTableBody,
  Cell: DataTableCell,
  CopyRecord,
  Head: DataTableHead,
  Header: DataTableHeader,
  LoadingCell: DataTableLoadingCell,
  Root: DataTableRoot,
  Row: DataTableRow,
};

export {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableLoadingCell,
  DataTableRoot,
  DataTableRow,
};
export { ClipboardUnavailableError, CopyRecord } from './copy-record';
export type {
  DataTableBodyProps,
  DataTableCellProps,
  DataTableHeaderProps,
  DataTableHeaderWidth,
  DataTableLoadingCellProps,
  DataTableRootProps,
};
export type { CopyRecordProps } from './copy-record';
