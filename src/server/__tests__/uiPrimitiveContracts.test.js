import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FileUploadField } from '../../components/ui/FileUploadField.jsx';
import { ChoiceCardGroup } from '../../components/ui/ChoiceCardGroup.jsx';
import {
  FormField,
  FormFieldControl,
  FormFieldCounter,
  FormFieldError,
  FormFieldHelp,
  FormFieldInput,
  FormFieldLabel,
  FormFieldRoot,
  FormFieldSelect,
  FormFieldTextarea,
} from '../../components/ui/FormField.jsx';
import { Notice } from '../../components/ui/Notice.jsx';
import { ValidationChecklist } from '../../components/ui/ValidationChecklist.jsx';

function renderFormField(element) {
  return renderToStaticMarkup(element);
}

describe('FormField primitive contract', () => {
  it('renders dense label/control structure with semantic help, error, and counter slots', () => {
    const html = renderFormField(
      React.createElement(
        FormFieldRoot,
        {
          action: React.createElement('button', { type: 'button' }, 'Action'),
          className: 'custom-root',
        },
        React.createElement(
          FormFieldLabel,
          {
            error: 'Required value missing',
            htmlFor: 'template-name',
            required: true,
          },
          'Template name'
        ),
        React.createElement(
          FormFieldControl,
          null,
          React.createElement(FormFieldInput, {
            'aria-describedby': 'template-name-help template-name-error',
            'aria-invalid': 'true',
            disabled: true,
            id: 'template-name',
            name: 'templateName',
            placeholder: 'Internal label',
            readOnly: true,
            value: 'Order update',
          }),
          React.createElement(FormFieldHelp, { id: 'template-name-help' }, 'Shown only in the console.'),
          React.createElement(FormFieldError, { id: 'template-name-error' }, 'Enter a template name.'),
          React.createElement(FormFieldCounter, { current: 12, invalid: true, max: 40 })
        )
      )
    );

    expect(html).toContain('form-field-root has-action custom-root');
    expect(html).toContain('class="form-field-label"');
    expect(html).toContain('for="template-name"');
    expect(html).toContain('class="form-field-label-text"');
    expect(html).toContain('Template name');
    expect(html).toContain('class="form-field-required"');
    expect(html).toContain('class="form-field-affordance"');
    expect(html).toContain('aria-label="Required value missing"');
    expect(html).toContain('class="form-field-control"');
    expect(html).toContain('class="form-field-input"');
    expect(html).toContain('aria-describedby="template-name-help template-name-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('class="form-field-help"');
    expect(html).toContain('class="form-field-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('class="form-field-counter"');
    expect(html).toContain('data-invalid="true"');
    expect(html).toContain('12 / 40');
    expect(html).toContain('class="form-field-action"');
  });

  it('renders textarea and native select controls while preserving arbitrary native props', () => {
    const html = renderFormField(
      React.createElement(
        FormFieldControl,
        { 'data-kind': 'advanced' },
        React.createElement(FormFieldTextarea, {
          'aria-label': 'Template body',
          maxLength: 1000,
          name: 'body',
          placeholder: 'Message body',
          rows: 4,
        }),
        React.createElement(
          FormFieldSelect,
          {
            'aria-label': 'Template type',
            defaultValue: 'basic',
            name: 'templateType',
          },
          React.createElement('option', { value: 'basic' }, 'Basic'),
          React.createElement('option', { value: 'image' }, 'Image')
        )
      )
    );

    expect(html).toContain('data-kind="advanced"');
    expect(html).toContain('class="form-field-textarea"');
    expect(html).toContain('maxLength="1000"');
    expect(html).toContain('rows="4"');
    expect(html).toContain('class="form-field-select"');
    expect(html).toContain('name="templateType"');
    expect(html).toContain('<option value="basic" selected="">Basic</option>');
    expect(html).toContain('<option value="image">Image</option>');
  });

  it('exposes the namespace object with every public primitive', () => {
    expect(FormField.Root).toBe(FormFieldRoot);
    expect(FormField.Label).toBe(FormFieldLabel);
    expect(FormField.Control).toBe(FormFieldControl);
    expect(FormField.Input).toBe(FormFieldInput);
    expect(FormField.Textarea).toBe(FormFieldTextarea);
    expect(FormField.Select).toBe(FormFieldSelect);
    expect(FormField.Help).toBe(FormFieldHelp);
    expect(FormField.Error).toBe(FormFieldError);
    expect(FormField.Counter).toBe(FormFieldCounter);

    expect(FormField.FormFieldRoot).toBe(FormFieldRoot);
    expect(FormField.FormFieldLabel).toBe(FormFieldLabel);
    expect(FormField.FormFieldControl).toBe(FormFieldControl);
    expect(FormField.FormFieldInput).toBe(FormFieldInput);
    expect(FormField.FormFieldTextarea).toBe(FormFieldTextarea);
    expect(FormField.FormFieldSelect).toBe(FormFieldSelect);
    expect(FormField.FormFieldHelp).toBe(FormFieldHelp);
    expect(FormField.FormFieldError).toBe(FormFieldError);
    expect(FormField.FormFieldCounter).toBe(FormFieldCounter);
  });
});

describe('FileUploadField primitive contract', () => {
  it('renders a hidden native file input, upload action, selected tags, previews, and remove controls', () => {
    const html = renderFormField(
      React.createElement(FileUploadField, {
        'aria-describedby': 'image-help image-error',
        'aria-invalid': 'true',
        accept: 'image/png,image/jpeg',
        actionLabel: 'Upload',
        disabled: true,
        files: [
          {
            id: 'image-file-1',
            fileName: 'template-main-image.png',
            metadata: ['PNG', '142 KB'],
            previewAlt: 'Uploaded template image',
            previewUrl: 'data:image/png;base64,preview',
          },
        ],
        id: 'template-image',
        multiple: true,
        name: 'templateImage',
        onFileChange: () => {},
        onRemoveFile: () => {},
        removeLabel: 'Remove uploaded file',
      })
    );

    expect(html).toContain('class="file-upload-field"');
    expect(html).toContain('data-disabled="true"');
    expect(html).toContain('class="file-upload-input"');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/png,image/jpeg"');
    expect(html).toContain('aria-describedby="image-help image-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('id="template-image"');
    expect(html).toContain('multiple=""');
    expect(html).toContain('name="templateImage"');
    expect(html).toContain('class="file-upload-list"');
    expect(html).toContain('class="file-upload-tag"');
    expect(html).toContain('class="file-upload-preview"');
    expect(html).toContain('aria-label="Uploaded template image"');
    expect(html).toContain('template-main-image.png');
    expect(html).toContain('PNG / 142 KB');
    expect(html).not.toContain('file-upload-empty');
    expect(html).not.toContain('No files selected');
    expect(html).toContain('file-upload-remove');
    expect(html).toContain('aria-label="Remove uploaded file: template-main-image.png"');
    expect(html).toContain('aria-controls="template-image"');
    expect(html).toContain('file-upload-action');
    expect(html).toContain('Upload');
  });

  it('renders generic empty-state copy when no file items are selected', () => {
    const html = renderFormField(
      React.createElement(FileUploadField, {
        actionLabel: 'Choose file',
        emptyDescription: 'Accepted files are shown by the feature using this primitive.',
        emptyLabel: 'No file selected',
        files: [],
        id: 'empty-upload',
      })
    );

    expect(html).toContain('class="file-upload-empty"');
    expect(html).toContain('No file selected');
    expect(html).toContain('Accepted files are shown by the feature using this primitive.');
    expect(html).toContain('Choose file');
  });
});

describe('ValidationChecklist primitive contract', () => {
  it('renders positive, neutral, and error rows with visible machine-readable error copy', () => {
    const html = renderFormField(
      React.createElement(ValidationChecklist, {
        items: [
          { checked: true, id: 'name', label: 'Template name is set' },
          { checked: false, id: 'image', label: 'Image is optional' },
          {
            checked: false,
            error: true,
            errorLabel: 'Upload an approved image before submitting.',
            id: 'image-required',
            label: 'Required image is ready',
          },
        ],
      })
    );

    expect(html).toContain('class="validation-checklist"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('data-error="false"');
    expect(html).toContain('data-error="true"');
    expect(html).toContain('data-state="checked"');
    expect(html).toContain('data-state="neutral"');
    expect(html).toContain('data-state="error"');
    expect(html).toContain('Template name is set');
    expect(html).toContain('Image is optional');
    expect(html).toContain('Required image is ready');
    expect(html).toContain('aria-describedby="image-required-error"');
    expect(html).toContain('id="image-required-error"');
    expect(html).toContain('Upload an approved image before submitting.');
  });
});

describe('Notice primitive contract', () => {
  it('renders compact icon, title, content, action, and urgent variant semantics without docs tokens', () => {
    const html = renderFormField(
      React.createElement(
        Notice,
        {
          action: React.createElement('a', { href: '/settings' }, 'Open settings'),
          className: 'custom-notice',
          title: 'Sender setup required',
          variant: 'warning',
        },
        React.createElement('p', null, 'Add an approved sender resource before submitting this template.')
      )
    );

    expect(html).toContain('class="notice notice-warning custom-notice"');
    expect(html).toContain('data-variant="warning"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('class="notice-icon"');
    expect(html).toContain('class="notice-title"');
    expect(html).toContain('Sender setup required');
    expect(html).toContain('class="notice-content"');
    expect(html).toContain('Add an approved sender resource before submitting this template.');
    expect(html).toContain('class="notice-action"');
    expect(html).toContain('Open settings');
    expect(html).not.toContain('--docs-');
  });

  it('supports non-urgent neutral, info, success, critical, and explicit role variants', () => {
    const neutralHtml = renderFormField(
      React.createElement(
        Notice,
        {
          role: 'status',
          title: 'Draft saved',
          variant: 'neutral',
        },
        'This notice uses product tokens.'
      )
    );
    const successHtml = renderFormField(React.createElement(Notice, { title: 'Ready', variant: 'success' }, 'Complete'));
    const infoHtml = renderFormField(React.createElement(Notice, { title: 'Info', variant: 'info' }, 'Readable'));
    const criticalHtml = renderFormField(React.createElement(Notice, { title: 'Blocked', variant: 'critical' }, 'Fix errors'));

    expect(neutralHtml).toContain('class="notice notice-neutral"');
    expect(neutralHtml).toContain('role="status"');
    expect(successHtml).toContain('class="notice notice-success"');
    expect(successHtml).toContain('role="note"');
    expect(infoHtml).toContain('class="notice notice-info"');
    expect(criticalHtml).toContain('class="notice notice-critical"');
    expect(criticalHtml).toContain('role="alert"');
  });
});

describe('ChoiceCardGroup primitive contract', () => {
  it('renders a semantic radio group with selected, disabled, meta, icon, and error states', () => {
    const TemplateIcon = React.forwardRef(function TemplateIcon(props, ref) {
      return React.createElement('svg', { ...props, ref, viewBox: '0 0 16 16' });
    });

    const html = renderFormField(
      React.createElement(ChoiceCardGroup, {
        defaultValue: 'image',
        description: 'Choose the template shape for this sender.',
        error: 'Select a supported template type.',
        id: 'template-type',
        invalid: true,
        items: [
          {
            description: 'A compact notification without media.',
            icon: TemplateIcon,
            label: 'Basic',
            meta: 'Stable',
            value: 'basic',
          },
          {
            description: 'Adds one required image.',
            label: 'Image',
            meta: 'Requires upload',
            value: 'image',
          },
          {
            description: 'Not enabled for this account.',
            disabled: true,
            label: 'Item list',
            meta: 'Unavailable',
            value: 'item-list',
          },
        ],
        label: 'Template type',
        name: 'templateType',
        onValueChange: () => {},
      })
    );

    expect(html).toContain('class="choice-card-group choice-card-group-grid is-invalid has-error"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-labelledby="template-type-label"');
    expect(html).toContain('aria-describedby="template-type-description template-type-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('class="choice-card-group-label"');
    expect(html).toContain('Template type');
    expect(html).toContain('Choose the template shape for this sender.');
    expect(html).toContain('class="choice-card-list"');
    expect(html).toContain('class="choice-card');
    expect(html).toContain('class="choice-card-input"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="templateType"');
    expect(html).toContain('value="image"');
    expect(html).toContain('checked=""');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('data-disabled="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('class="choice-card-icon"');
    expect(html).toContain('class="choice-card-label"');
    expect(html).toContain('Basic');
    expect(html).toContain('Adds one required image.');
    expect(html).toContain('Requires upload');
    expect(html).toContain('class="choice-card-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Select a supported template type.');
  });

  it('supports controlled compact stack layout and group-level disabled state', () => {
    const html = renderFormField(
      React.createElement(ChoiceCardGroup, {
        compact: true,
        disabled: true,
        items: [
          { label: 'SMS fallback', value: 'sms' },
          { label: 'No fallback', value: 'none' },
        ],
        layout: 'stack',
        onValueChange: () => {},
        value: 'none',
      })
    );

    expect(html).toContain('choice-card-group choice-card-group-stack is-compact is-disabled');
    expect(html).toContain('data-layout="stack"');
    expect(html).toContain('value="none"');
    expect(html).toContain('checked=""');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('No fallback');
  });
});
