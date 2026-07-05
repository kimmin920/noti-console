import {
  Checkbox as ResendCheckbox,
  DropdownMenu as ResendDropdownMenu,
  DropdownMenuContent as ResendDropdownMenuContent,
  DropdownMenuItem as ResendDropdownMenuItem,
  DropdownMenuRoot as ResendDropdownMenuRoot,
  DropdownMenuSeparator as ResendDropdownMenuSeparator,
  FormField as ResendFormField,
  FormLabel as ResendFormLabel,
  FormMessage as ResendFormMessage,
  Input as ResendInput,
  RadioGroup as ResendRadioGroup,
  RadioGroupIndicator as ResendRadioGroupIndicator,
  RadioGroupItem as ResendRadioGroupItem,
  Select as ResendSelect,
  SelectContent as ResendSelectContent,
  SelectItem as ResendSelectItem,
  Switch as ResendSwitch,
  Textarea as ResendTextarea,
} from '../resend-ui';

function asBoolean(values, key) {
  return values[key] === true;
}

function asString(values, key, fallback = '') {
  const value = values[key];
  return typeof value === 'string' ? value : fallback;
}

export const resendFormPrimitiveEntries = [
  {
    id: 'radio-group',
    name: 'Resend RadioGroup',
    path: 'src/resend-ui/primitives/radio-group/radio-group.tsx',
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
    path: 'src/resend-ui/primitives/checkbox/checkbox.tsx',
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
    path: 'src/resend-ui/primitives/switch/switch.tsx',
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
    path: 'src/resend-ui/primitives/textarea/textarea.tsx',
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
    path: 'src/resend-ui/primitives/form-field/form-field.tsx',
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
    path: 'src/resend-ui/primitives/form-field/form-field.tsx',
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
    path: 'src/resend-ui/primitives/form-field/form-field.tsx',
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
    path: 'src/resend-ui/primitives/select/select.tsx',
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
    path: 'src/resend-ui/primitives/dropdown-menu/dropdown-menu.tsx',
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
