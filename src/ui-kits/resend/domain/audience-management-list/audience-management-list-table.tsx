import { Checkbox } from '../../primitives/checkbox';
import { DataTable, useRowSelection } from '../../data-display/data-table';
import {
  AudienceManagementRows,
  getAudienceManagementRowIds,
} from './audience-management-rows';
import { audienceManagementHeaders } from './data';
import type {
  AudienceManagementRowActionDisabled,
  AudienceManagementRowActionHandler,
  AudienceManagementView,
  AudiencePropertyRecord,
  AudienceSegmentRecord,
  AudienceTopicRecord,
} from './types';

type AudienceManagementListTableProps = {
  readonly defaultSelectedAudienceManagementIds?: readonly string[] | undefined;
  readonly isRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly getSegmentHref: (segment: AudienceSegmentRecord) => string;
  readonly getTopicHref: (topic: AudienceTopicRecord) => string;
  readonly loading: boolean;
  readonly onRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly onSelectedAudienceManagementIdsChange?: ((selectedIds: readonly string[]) => void) | undefined;
  readonly propertiesHref: string;
  readonly properties: readonly AudiencePropertyRecord[];
  readonly segments: readonly AudienceSegmentRecord[];
  readonly selectedAudienceManagementIds?: readonly string[] | undefined;
  readonly topics: readonly AudienceTopicRecord[];
  readonly view: AudienceManagementView;
};

function LoadingBody({ view }: { readonly view: AudienceManagementView }) {
  const rows = Array.from({ length: 8 }, (_, index) => `audience-management-loading-${index}`);
  return rows.map((row) => (
    <DataTable.Row key={row}>
      {audienceManagementHeaders[view].map((header) => (
        <DataTable.LoadingCell className={header.className} key={header.id}>
          <span className="resend-ui-audience-management-list__skeleton" />
        </DataTable.LoadingCell>
      ))}
    </DataTable.Row>
  ));
}

export function AudienceManagementListTable({
  defaultSelectedAudienceManagementIds,
  isRowActionDisabled,
  getSegmentHref,
  getTopicHref,
  loading,
  onRowAction,
  onSelectedAudienceManagementIdsChange,
  propertiesHref,
  properties,
  segments,
  selectedAudienceManagementIds,
  topics,
  view,
}: AudienceManagementListTableProps) {
  const selection = useRowSelection({
    defaultSelectedRowIds: defaultSelectedAudienceManagementIds,
    onSelectedRowIdsChange: onSelectedAudienceManagementIdsChange,
    rowIds: getAudienceManagementRowIds(view, properties, segments, topics),
    selectedRowIds: selectedAudienceManagementIds,
  });

  return (
    <DataTable.SelectionRoot>
      <DataTable.SelectionViewport className="resend-ui-audience-management-list__table-scroll">
        <DataTable.Root
          aria-busy={loading ? 'true' : undefined}
          className="resend-ui-audience-management-list__table"
          data-qa="audience-management-table"
        >
          <DataTable.Head>
            <DataTable.Row>
              {audienceManagementHeaders[view].map((header, index) => (
                <DataTable.Header
                  align={header.align}
                  className={header.className}
                  key={header.id}
                  selectionAnchor={index === 0}
                >
                  {index === 0 ? (
                    <DataTable.SelectionLabel className="resend-ui-audience-management-list__select-all">
                      <DataTable.SelectAll selected={selection.selectedRowIds.length > 0}>
                        <Checkbox
                          aria-label={`Select all ${view}`}
                          checked={selection.allRowsCheckboxState}
                          onCheckedChange={selection.setAllRowsChecked}
                        />
                      </DataTable.SelectAll>
                      {header.name}
                    </DataTable.SelectionLabel>
                  ) : (
                    header.name
                  )}
                </DataTable.Header>
              ))}
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {loading ? (
              <LoadingBody view={view} />
            ) : (
              <AudienceManagementRows
                getSegmentHref={getSegmentHref}
                getTopicHref={getTopicHref}
                isRowActionDisabled={isRowActionDisabled}
                onRowAction={onRowAction}
                propertiesHref={propertiesHref}
                properties={properties}
                segments={segments}
                selection={selection}
                topics={topics}
                view={view}
              />
            )}
          </DataTable.Body>
        </DataTable.Root>
      </DataTable.SelectionViewport>
    </DataTable.SelectionRoot>
  );
}

export type { AudienceManagementListTableProps };
