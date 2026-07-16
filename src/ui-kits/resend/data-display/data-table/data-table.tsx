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
  readonly selectionAnchor?: boolean;
  readonly width?: DataTableHeaderWidth | undefined;
};

type DataTableCellProps = ComponentPropsWithoutRef<'td'> & {
  readonly borderless?: boolean;
  readonly mono?: boolean;
  readonly selectionAnchor?: boolean;
};

type DataTableLoadingCellProps = Omit<DataTableCellProps, 'children'> & {
  readonly children?: ReactNode;
};

type DataTableSelectionControlProps = ComponentPropsWithoutRef<'span'> & {
  readonly selected?: boolean;
};

type DataTableSelectionRootProps = ComponentPropsWithoutRef<'div'>;
type DataTableSelectionViewportProps = ComponentPropsWithoutRef<'div'>;
type DataTableSelectionLabelProps = ComponentPropsWithoutRef<'span'>;

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
  selectionAnchor = false,
  scope = 'col',
  width,
  ...props
}, ref) {
  return (
    <th
      className={cx(
        'resend-ui-data-table__header',
        align === 'right' && 'resend-ui-data-table__header--right',
        selectionAnchor && 'resend-ui-data-table__selection-anchor',
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
  selectionAnchor = false,
  ...props
}, ref) {
  return (
    <td
      className={cx(
        'resend-ui-data-table__cell',
        mono && 'resend-ui-data-table__cell--mono',
        borderless && 'resend-ui-data-table__cell--borderless',
        selectionAnchor && 'resend-ui-data-table__selection-anchor',
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

const DataTableSelectionRoot = forwardRef<ComponentRef<'div'>, DataTableSelectionRootProps>(
  function DataTableSelectionRoot({ className, ...props }, ref) {
    return (
      <div
        className={cx('resend-ui-data-table__selection-root', className)}
        data-resend-data-table-selection-root=""
        ref={ref}
        {...props}
      />
    );
  }
);

const DataTableSelectionViewport = forwardRef<
  ComponentRef<'div'>,
  DataTableSelectionViewportProps
>(function DataTableSelectionViewport({ className, ...props }, ref) {
  return (
    <div
      className={cx('resend-ui-data-table__selection-viewport', className)}
      data-resend-data-table-selection-viewport=""
      ref={ref}
      {...props}
    />
  );
});

const DataTableSelectionLabel = forwardRef<ComponentRef<'span'>, DataTableSelectionLabelProps>(
  function DataTableSelectionLabel({ className, ...props }, ref) {
    return (
      <span
        className={cx('resend-ui-data-table__selection-label', className)}
        data-resend-data-table-selection-label=""
        ref={ref}
        {...props}
      />
    );
  }
);

const DataTableSelectAll = forwardRef<ComponentRef<'span'>, DataTableSelectionControlProps>(
  function DataTableSelectAll({ className, selected = false, ...props }, ref) {
    return (
      <span
        className={cx(
          'resend-ui-data-table__selection-control',
          'resend-ui-data-table__select-all',
          className
        )}
        data-resend-data-table-selection-control=""
        data-selected={selected ? '' : undefined}
        data-variant="header"
        ref={ref}
        {...props}
      />
    );
  }
);

const DataTableSelectionItem = forwardRef<ComponentRef<'span'>, DataTableSelectionControlProps>(
  function DataTableSelectionItem({ className, selected = false, ...props }, ref) {
    return (
      <span
        className={cx(
          'resend-ui-data-table__selection-control',
          'resend-ui-data-table__selection-item',
          className
        )}
        data-resend-data-table-selection-control=""
        data-selected={selected ? '' : undefined}
        data-variant="row"
        ref={ref}
        {...props}
      />
    );
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
  SelectAll: DataTableSelectAll,
  SelectionItem: DataTableSelectionItem,
  SelectionLabel: DataTableSelectionLabel,
  SelectionRoot: DataTableSelectionRoot,
  SelectionViewport: DataTableSelectionViewport,
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
  DataTableSelectAll,
  DataTableSelectionItem,
  DataTableSelectionLabel,
  DataTableSelectionRoot,
  DataTableSelectionViewport,
};
export { ClipboardUnavailableError, CopyRecord } from './copy-record';
export type {
  DataTableBodyProps,
  DataTableCellProps,
  DataTableHeaderProps,
  DataTableHeaderWidth,
  DataTableLoadingCellProps,
  DataTableRootProps,
  DataTableSelectionControlProps,
  DataTableSelectionLabelProps,
  DataTableSelectionRootProps,
  DataTableSelectionViewportProps,
};
export type { CopyRecordProps } from './copy-record';
