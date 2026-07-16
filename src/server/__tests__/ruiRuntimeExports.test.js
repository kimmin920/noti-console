import { describe, expect, it } from 'vitest';

import { DataTable } from '../../ui-kits/resend/data-display/data-table';
import { EmptyState } from '../../ui-kits/resend/data-display/empty-state';
import { ApiDrawer } from '../../ui-kits/resend/layout/api-drawer';
import { Card } from '../../ui-kits/resend/primitives/card';
import { Drawer } from '../../ui-kits/resend/primitives/drawer';
import { DropdownMenu } from '../../ui-kits/resend/primitives/dropdown-menu';
import { MultiSelect } from '../../ui-kits/resend/primitives/multi-select';
import { Select } from '../../ui-kits/resend/primitives/select';
import {
  AudienceContactList,
  AudienceManagementList,
} from '../../ui-kits/resend/index';
import { AppFormField } from '../../components/ui-extensions/AppFormField.jsx';
import { AppTextField } from '../../components/ui-extensions/AppTextField.jsx';

function expectComponents(namespace, members) {
  for (const member of members) {
    const component = namespace[member];
    expect(
      component !== null && (typeof component === 'function' || typeof component === 'object'),
      `${member} must be a renderable component`
    ).toBe(true);
  }
}

describe('RUI runtime export contracts', () => {
  it('keeps every compound member used by application wrappers defined', () => {
    expectComponents(Card, ['Body', 'Root']);
    expectComponents(DataTable, [
      'Body',
      'Cell',
      'Head',
      'Header',
      'Root',
      'Row',
      'SelectAll',
      'SelectionItem',
      'SelectionLabel',
      'SelectionRoot',
      'SelectionViewport',
    ]);
    expectComponents(Drawer, ['Close', 'Content', 'Root', 'Trigger']);
    expectComponents(DropdownMenu, ['Content', 'Item', 'Root', 'Separator', 'Trigger']);
    expectComponents(EmptyState, ['Actions', 'Content', 'Description', 'Root', 'Title']);
    expectComponents(MultiSelect, ['Content', 'Root', 'Trigger']);
    expectComponents(Select, ['Content', 'Item', 'Root', 'Trigger', 'Value']);
  });

  it('keeps application compatibility namespaces renderable', () => {
    expectComponents(AppFormField, [
      'Control',
      'Counter',
      'Error',
      'Help',
      'Input',
      'Label',
      'Root',
      'Select',
      'Textarea',
    ]);
    expectComponents(AppTextField, ['Input', 'Root', 'Slot']);
    expect(typeof AudienceContactList).toBe('function');
    expect(typeof AudienceManagementList).toBe('function');
    expect(typeof ApiDrawer).toBe('function');
  });
});
