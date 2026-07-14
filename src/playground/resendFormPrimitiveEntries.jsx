import { EmptyState as ResendEmptyState } from '../ui-kits/resend/data-display/empty-state';
import { DataTable as ResendDataTable } from '../ui-kits/resend/data-display/data-table';
import { StatusLabel as ResendStatusLabel } from '../ui-kits/resend/data-display/status-label';
import { Toaster as ResendToaster } from '../ui-kits/resend/feedback/toast';
import { ApiDrawer } from '../ui-kits/resend/layout/api-drawer';
import {
  PageHeaderActions as ResendPageHeaderActions,
  PageHeaderApiAction as ResendPageHeaderApiAction,
  PageHeaderPrimaryButton as ResendPageHeaderPrimaryButton,
} from '../ui-kits/resend/layout/page-header-actions';
import { Button as ResendButton } from '../ui-kits/resend/primitives/button';
import { Card as ResendCard } from '../ui-kits/resend/primitives/card';
import { Checkbox as ResendCheckbox } from '../ui-kits/resend/primitives/checkbox';
import { Drawer as ResendDrawer } from '../ui-kits/resend/primitives/drawer';
import {
  DropdownMenu as ResendDropdownMenu,
  DropdownMenuContent as ResendDropdownMenuContent,
  DropdownMenuItem as ResendDropdownMenuItem,
  DropdownMenuRoot as ResendDropdownMenuRoot,
  DropdownMenuSeparator as ResendDropdownMenuSeparator,
} from '../ui-kits/resend/primitives/dropdown-menu';
import { FilterButton as ResendFilterButton } from '../ui-kits/resend/primitives/filter-button';
import {
  FormField as ResendFormField,
  FormLabel as ResendFormLabel,
  FormMessage as ResendFormMessage,
} from '../ui-kits/resend/primitives/form-field';
import { IconButton as ResendIconButton } from '../ui-kits/resend/primitives/icon-button';
import { Input as ResendInput } from '../ui-kits/resend/primitives/input';
import { MultiSelect as ResendMultiSelect } from '../ui-kits/resend/primitives/multi-select';
import {
  RadioGroup as ResendRadioGroup,
  RadioGroupIndicator as ResendRadioGroupIndicator,
  RadioGroupItem as ResendRadioGroupItem,
} from '../ui-kits/resend/primitives/radio-group';
import { SearchField as ResendSearchField } from '../ui-kits/resend/primitives/search-field';
import {
  Select as ResendSelect,
  SelectContent as ResendSelectContent,
  SelectItem as ResendSelectItem,
} from '../ui-kits/resend/primitives/select';
import { SelectTrigger as ResendSelectTrigger } from '../ui-kits/resend/primitives/select-trigger';
import { Switch as ResendSwitch } from '../ui-kits/resend/primitives/switch';
import { Tabs as ResendTabs } from '../ui-kits/resend/primitives/tabs';
import { Textarea as ResendTextarea } from '../ui-kits/resend/primitives/textarea';
import { Heading as ResendHeading, Text as ResendText } from '../ui-kits/resend/primitives/typography';
import { Code2, MoreHorizontal } from 'lucide-react';

function asBoolean(values, key) {
  return values[key] === true;
}

function asString(values, key, fallback = '') {
  const value = values[key];
  return typeof value === 'string' ? value : fallback;
}

const resendFormPrimitiveEntriesBase = [
  {
    id: 'radio-group',
    name: 'Resend RadioGroup',
    path: 'src/ui-kits/resend/primitives/radio-group/radio-group.tsx',
    description: 'Copied Radix-backed Resend radio group primitive for API and visual comparison.',
    controls: [
      { id: 'value', label: 'value', type: 'select', options: ['admin', 'member'], defaultValue: 'admin' },
      { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
    ],
    render(values) {
      return (
        <div style={{ width: 360 }}>
          <ResendFormLabel>Select role</ResendFormLabel>
          <ResendRadioGroup
            aria-label="Select role"
            disabled={asBoolean(values, 'disabled')}
            value={asString(values, 'value', 'admin')}
          >
            <div className="resend-ui-radio-group__option">
              <ResendRadioGroupItem id="resend-role-admin" value="admin">
                <ResendRadioGroupIndicator />
              </ResendRadioGroupItem>
              <ResendFormLabel
                description="Invite users, update payment, and delete the team."
                htmlFor="resend-role-admin"
              >
                Admin
              </ResendFormLabel>
            </div>
            <div className="resend-ui-radio-group__option">
              <ResendRadioGroupItem id="resend-role-member" value="member">
                <ResendRadioGroupIndicator />
              </ResendRadioGroupItem>
              <ResendFormLabel
                description="Manage emails, domains, and webhooks."
                htmlFor="resend-role-member"
              >
                Member
              </ResendFormLabel>
            </div>
          </ResendRadioGroup>
        </div>
      );
    },
  },
  {
    id: 'checkbox',
    name: 'Resend Checkbox',
    path: 'src/ui-kits/resend/primitives/checkbox/checkbox.tsx',
    description: 'Copied Radix-backed Resend checkbox primitive.',
    controls: [
      { id: 'checked', label: 'checked', type: 'boolean', defaultValue: false },
      { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
    ],
    render(values) {
      return (
        <ResendCheckbox
          aria-label="Select automation"
          checked={asBoolean(values, 'checked')}
          disabled={asBoolean(values, 'disabled')}
          onCheckedChange={() => undefined}
        />
      );
    },
  },
  {
    id: 'switch',
    name: 'Resend Switch',
    path: 'src/ui-kits/resend/primitives/switch/switch.tsx',
    description: 'Copied Radix-backed Resend switch primitive.',
    controls: [
      { id: 'checked', label: 'checked', type: 'boolean', defaultValue: false },
      { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
    ],
    render(values) {
      return (
        <ResendSwitch
          aria-label="Allow overages"
          checked={asBoolean(values, 'checked')}
          disabled={asBoolean(values, 'disabled')}
          onCheckedChange={() => undefined}
        />
      );
    },
  },
  {
    id: 'textarea',
    name: 'Resend Textarea',
    path: 'src/ui-kits/resend/primitives/textarea/textarea.tsx',
    description: 'Copied Resend textarea primitive with invalid and disabled states.',
    controls: [
      { id: 'placeholder', label: 'placeholder', type: 'text', defaultValue: 'Tell us what happened...' },
      { id: 'value', label: 'defaultValue', type: 'text', defaultValue: '' },
      { id: 'invalid', label: 'invalid', type: 'boolean', defaultValue: false },
      { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
    ],
    render(values) {
      return (
        <div style={{ width: 360 }}>
          <ResendTextarea
            defaultValue={asString(values, 'value')}
            disabled={asBoolean(values, 'disabled')}
            invalid={asBoolean(values, 'invalid')}
            maxLength={240}
            minLength={4}
            placeholder={asString(values, 'placeholder', 'Tell us what happened...')}
            rows={4}
          />
        </div>
      );
    },
  },
  {
    id: 'form-field',
    name: 'Resend FormField',
    path: 'src/ui-kits/resend/primitives/form-field/form-field.tsx',
    description: 'Copied Resend form field wrapper with label, input, and message.',
    controls: [
      { id: 'invalid', label: 'invalid', type: 'boolean', defaultValue: true },
      { id: 'placeholder', label: 'placeholder', type: 'text', defaultValue: 'Email subject line' },
    ],
    render(values) {
      const invalid = asBoolean(values, 'invalid');
      return (
        <div style={{ width: 320 }}>
          <ResendFormField>
            <ResendFormLabel htmlFor="resend-form-field-subject">Subject</ResendFormLabel>
            <ResendInput
              aria-describedby={invalid ? 'resend-form-field-subject-message' : undefined}
              id="resend-form-field-subject"
              invalid={invalid}
              placeholder={asString(values, 'placeholder', 'Email subject line')}
            />
            <ResendFormMessage id="resend-form-field-subject-message" message={invalid ? 'Subject is required' : undefined} />
          </ResendFormField>
        </div>
      );
    },
  },
  {
    id: 'form-label',
    name: 'Resend FormLabel',
    path: 'src/ui-kits/resend/primitives/form-field/form-field.tsx',
    description: 'Copied Resend form label primitive with optional description.',
    controls: [
      { id: 'label', label: 'children', type: 'text', defaultValue: 'Admin' },
      { id: 'description', label: 'description', type: 'text', defaultValue: 'Invite users, update payment, and delete the team.' },
    ],
    render(values) {
      return (
        <ResendFormLabel
          description={asString(values, 'description', 'Invite users, update payment, and delete the team.')}
          htmlFor="resend-form-label-demo"
        >
          {asString(values, 'label', 'Admin')}
        </ResendFormLabel>
      );
    },
  },
  {
    id: 'form-message',
    name: 'Resend FormMessage',
    path: 'src/ui-kits/resend/primitives/form-field/form-field.tsx',
    description: 'Copied Resend form message primitive; empty content renders nothing.',
    controls: [
      { id: 'message', label: 'message', type: 'text', defaultValue: 'Email subject is required' },
    ],
    render(values) {
      return <ResendFormMessage message={asString(values, 'message', 'Email subject is required')} />;
    },
  },
  {
    id: 'select-content',
    name: 'Resend SelectContent',
    path: 'src/ui-kits/resend/primitives/select/select.tsx',
    description: 'Copied Radix-backed Resend select content, item, trigger, and value primitives.',
    controls: [
      { id: 'open', label: 'open', type: 'boolean', defaultValue: false },
      { id: 'value', label: 'value', type: 'select', options: ['vat', 'gst', 'ein'], defaultValue: 'vat' },
    ],
    render(values) {
      const open = asBoolean(values, 'open');
      return (
        <div style={{ width: 320 }}>
          <ResendSelect.Root
            onOpenChange={() => undefined}
            onValueChange={() => undefined}
            open={open}
            value={asString(values, 'value', 'vat')}
          >
            <ResendSelect.Trigger aria-label="Tax ID type">
              <ResendSelect.Value placeholder="Select tax ID" />
            </ResendSelect.Trigger>
            <ResendSelectContent>
              <ResendSelectItem value="vat">European VAT number</ResendSelectItem>
              <ResendSelectItem value="gst">GST number</ResendSelectItem>
              <ResendSelectItem disabled value="ein">Employer identification number</ResendSelectItem>
            </ResendSelectContent>
          </ResendSelect.Root>
        </div>
      );
    },
  },
  {
    id: 'dropdown-menu-content',
    name: 'Resend DropdownMenuContent',
    path: 'src/ui-kits/resend/primitives/dropdown-menu/dropdown-menu.tsx',
    description: 'Copied Radix-backed Resend dropdown menu content, item, and separator primitives.',
    controls: [
      { id: 'open', label: 'open', type: 'boolean', defaultValue: false },
      { id: 'label', label: 'trigger', type: 'text', defaultValue: 'All Statuses' },
    ],
    render(values) {
      const open = asBoolean(values, 'open');
      return (
        <div style={{ minWidth: 220 }}>
          <ResendDropdownMenuRoot onOpenChange={() => undefined} open={open}>
            <ResendDropdownMenu.Trigger expanded={open}>
              {asString(values, 'label', 'All Statuses')}
            </ResendDropdownMenu.Trigger>
            <ResendDropdownMenuContent align="start">
              <ResendDropdownMenuItem>Delivered</ResendDropdownMenuItem>
              <ResendDropdownMenuItem>Bounced</ResendDropdownMenuItem>
              <ResendDropdownMenuItem disabled>Deferred</ResendDropdownMenuItem>
              <ResendDropdownMenuSeparator />
              <ResendDropdownMenuItem variant="red">Remove filter</ResendDropdownMenuItem>
            </ResendDropdownMenuContent>
          </ResendDropdownMenuRoot>
        </div>
      );
    },
  },
];

const additionalReadyEntries = [
  {
    id: 'button',
    name: 'RUI Button',
    path: 'src/ui-kits/resend/primitives/button/button.tsx',
    description: 'Accent and interactive RUI button variants.',
    controls: [],
    render() {
      return <div style={{ display: 'flex', gap: 8 }}><ResendButton variant="accent">Create</ResendButton><ResendButton>Cancel</ResendButton></div>;
    },
  },
  {
    id: 'icon-button',
    name: 'RUI IconButton',
    path: 'src/ui-kits/resend/primitives/icon-button/icon-button.tsx',
    description: 'Responsive icon action with an accessible label.',
    controls: [],
    render() {
      return <ResendIconButton icon={<MoreHorizontal />} label="More actions" />;
    },
  },
  {
    id: 'input',
    name: 'RUI Input',
    path: 'src/ui-kits/resend/primitives/input/input.tsx',
    description: 'RUI text input.',
    controls: [],
    render() {
      return <ResendInput aria-label="Email" placeholder="name@example.com" style={{ width: 320 }} />;
    },
  },
  {
    id: 'search-field',
    name: 'RUI SearchField',
    path: 'src/ui-kits/resend/primitives/search-field/search-field.tsx',
    description: 'Search input with the RUI search slot.',
    controls: [],
    render() {
      return <ResendSearchField aria-label="Search" placeholder="Search messages" style={{ width: 320 }} />;
    },
  },
  {
    id: 'filter-button',
    name: 'RUI FilterButton',
    path: 'src/ui-kits/resend/primitives/filter-button/filter-button.tsx',
    description: 'Filter trigger used by menus and multi-selects.',
    controls: [],
    render() {
      return <ResendFilterButton>All statuses</ResendFilterButton>;
    },
  },
  {
    id: 'select-trigger',
    name: 'RUI SelectTrigger',
    path: 'src/ui-kits/resend/primitives/select-trigger/select-trigger.tsx',
    description: 'Standalone select-style trigger.',
    controls: [],
    render() {
      return <ResendSelectTrigger aria-controls="rui-select-trigger-demo" aria-expanded="false">Choose a sender</ResendSelectTrigger>;
    },
  },
  {
    id: 'multi-select',
    name: 'RUI MultiSelect',
    path: 'src/ui-kits/resend/primitives/multi-select/multi-select.tsx',
    description: 'Multi-select with all-option semantics.',
    controls: [],
    render() {
      const options = [{ label: 'All statuses', value: 'all' }, { label: 'Delivered', value: 'delivered' }, { label: 'Failed', value: 'failed' }];
      return <ResendMultiSelect.Root options={options}><ResendMultiSelect.Trigger label="statuses" /><ResendMultiSelect.Content /></ResendMultiSelect.Root>;
    },
  },
  {
    id: 'tabs',
    name: 'RUI Tabs',
    path: 'src/ui-kits/resend/primitives/tabs/tabs.tsx',
    description: 'Controlled or uncontrolled RUI tabs.',
    controls: [],
    render() {
      return <ResendTabs items={[{ label: 'Overview', value: 'overview' }, { label: 'Activity', value: 'activity' }]} />;
    },
  },
  {
    id: 'typography',
    name: 'RUI Typography',
    path: 'src/ui-kits/resend/primitives/typography/typography.tsx',
    description: 'RUI heading and text tokens.',
    controls: [],
    render() {
      return <div><ResendHeading as="h3">Message activity</ResendHeading><ResendText as="p">Delivery events from the last 24 hours.</ResendText></div>;
    },
  },
  {
    id: 'card',
    name: 'RUI Card',
    path: 'src/ui-kits/resend/primitives/card/card.tsx',
    description: 'RUI card root and body.',
    controls: [],
    render() {
      return <ResendCard.Root style={{ width: 320 }}><ResendCard.Body>API key created</ResendCard.Body></ResendCard.Root>;
    },
  },
  {
    id: 'drawer',
    name: 'RUI Drawer',
    path: 'src/ui-kits/resend/primitives/drawer/drawer.tsx',
    description: 'Radix-backed RUI drawer.',
    controls: [],
    render() {
      return <ResendDrawer.Root><ResendDrawer.Trigger><ResendButton>Open drawer</ResendButton></ResendDrawer.Trigger><ResendDrawer.Content title="API details"><p>Drawer content</p></ResendDrawer.Content></ResendDrawer.Root>;
    },
  },
  {
    id: 'status-label',
    name: 'RUI StatusLabel',
    path: 'src/ui-kits/resend/data-display/status-label/status-label.tsx',
    description: 'Compact status label.',
    controls: [],
    render() {
      return <ResendStatusLabel tooltipTrigger={false}>Delivered</ResendStatusLabel>;
    },
  },
  {
    id: 'empty-state',
    name: 'RUI EmptyState',
    path: 'src/ui-kits/resend/data-display/empty-state/empty-state.tsx',
    description: 'RUI empty state composition.',
    controls: [],
    render() {
      return <ResendEmptyState.Root><ResendEmptyState.Content><ResendEmptyState.Title>No messages yet</ResendEmptyState.Title><ResendEmptyState.Description>Send a message to see activity.</ResendEmptyState.Description></ResendEmptyState.Content></ResendEmptyState.Root>;
    },
  },
  {
    id: 'data-table',
    name: 'RUI DataTable',
    path: 'src/ui-kits/resend/data-display/data-table/data-table.tsx',
    description: 'RUI semantic table primitives.',
    controls: [],
    render() {
      return <ResendDataTable.Root><ResendDataTable.Head><ResendDataTable.Row><ResendDataTable.Header>Status</ResendDataTable.Header><ResendDataTable.Header>Recipient</ResendDataTable.Header></ResendDataTable.Row></ResendDataTable.Head><ResendDataTable.Body><ResendDataTable.Row><ResendDataTable.Cell>Delivered</ResendDataTable.Cell><ResendDataTable.Cell>user@example.com</ResendDataTable.Cell></ResendDataTable.Row></ResendDataTable.Body></ResendDataTable.Root>;
    },
  },
  {
    id: 'toast',
    name: 'RUI Toast',
    path: 'src/ui-kits/resend/feedback/toast/toast.tsx',
    description: 'RUI toast viewport and card.',
    controls: [],
    render() {
      return <ResendToaster autoDismiss={false} defaultToasts={[{ appearance: 'green', title: 'Message sent' }]} />;
    },
  },
  {
    id: 'page-header-actions',
    name: 'RUI PageHeaderActions',
    path: 'src/ui-kits/resend/layout/page-header-actions/page-header-actions.tsx',
    description: 'Primary and API page header actions.',
    controls: [],
    render() {
      return <ResendPageHeaderActions><ResendPageHeaderPrimaryButton>Create key</ResendPageHeaderPrimaryButton><ResendPageHeaderApiAction /></ResendPageHeaderActions>;
    },
  },
  {
    id: 'api-drawer',
    name: 'RUI ApiDrawer',
    path: 'src/ui-kits/resend/layout/api-drawer/api-drawer.tsx',
    description: 'API code drawer with SDK navigation.',
    controls: [],
    render() {
      return <ApiDrawer trigger={<ResendButton><Code2 size={16} />API</ResendButton>} />;
    },
  },
];

export const resendFormPrimitiveEntries = [
  ...resendFormPrimitiveEntriesBase,
  ...additionalReadyEntries,
];
