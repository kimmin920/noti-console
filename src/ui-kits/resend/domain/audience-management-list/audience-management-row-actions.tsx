import { Ellipsis } from 'lucide-react';
import { DropdownMenu as RadixDropdownMenu } from 'radix-ui';
import { DropdownMenu } from '../../primitives/dropdown-menu';
import { IconButton } from '../../primitives/icon-button';
import type {
  AudienceManagementRecord,
  AudienceManagementRowAction,
  AudienceManagementRowActionDisabled,
  AudienceManagementRowActionHandler,
  AudienceManagementView,
} from './types';

type AudienceManagementRowActionsProps = {
  readonly isRowActionDisabled?: AudienceManagementRowActionDisabled | undefined;
  readonly onRowAction?: AudienceManagementRowActionHandler | undefined;
  readonly record: AudienceManagementRecord;
  readonly view: AudienceManagementView;
};

export function AudienceManagementRowActions({
  isRowActionDisabled,
  onRowAction,
  record,
  view,
}: AudienceManagementRowActionsProps) {
  const labels = {
    properties: { copy: 'Copy ID', delete: 'Delete property', edit: 'Edit property' },
    segments: { copy: 'Copy ID', delete: 'Delete segment', edit: 'Edit segment' },
    topics: { copy: 'Copy ID', delete: 'Delete topic', edit: 'Edit topic' },
  }[view];
  const isDisabled = (action: AudienceManagementRowAction) => isRowActionDisabled?.(action, record, view) ?? false;
  const handleSelect = (action: AudienceManagementRowAction) => {
    onRowAction?.(action, record, view);
  };

  return (
    <DropdownMenu.Root>
      <RadixDropdownMenu.Trigger asChild>
        <IconButton icon={<Ellipsis size={12} />} label="More actions" />
      </RadixDropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item
          disabled={isDisabled('edit')}
          onSelect={() => handleSelect('edit')}
        >
          {labels.edit}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={isDisabled('copy-id')}
          onSelect={() => handleSelect('copy-id')}
        >
          {labels.copy}
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          disabled={isDisabled('delete')}
          onSelect={() => handleSelect('delete')}
          variant="red"
        >
          {labels.delete}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
