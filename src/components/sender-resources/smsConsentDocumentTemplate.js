import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ImageUp, X } from 'lucide-react';

export const SMS_CONSENT_DOCUMENT_FONT_NAME = 'NanumGothic';

export const SMS_CONSENT_DOCUMENT_INITIAL_INPUTS = Object.freeze({
  ownerName: '',
  ownerSignature: '',
  phoneNumbers: '',
  sealImage: '',
});

export const SMS_CONSENT_DOCUMENT_REQUIRED_FIELDS = Object.freeze([
  'ownerName',
  'ownerSignature',
  'phoneNumbers',
  'sealImage',
]);

export function getMissingSmsConsentDocumentFields(inputs = {}) {
  return SMS_CONSENT_DOCUMENT_REQUIRED_FIELDS.filter((field) => {
    const value = inputs[field];

    return typeof value !== 'string' || value.trim() === '';
  });
}

const TEXT_FIELD_BASE = {
  alignment: 'left',
  backgroundColor: '',
  characterSpacing: 0,
  content: '',
  fontColor: '#111111',
  fontName: SMS_CONSENT_DOCUMENT_FONT_NAME,
  fontSize: 10,
  lineHeight: 1,
  opacity: 1,
  padding: {
    bottom: 0.7,
    left: 1,
    right: 1,
    top: 0.7,
  },
  required: true,
  type: 'text',
  verticalAlignment: 'middle',
};

const SMS_CONSENT_DOCUMENT_LAYOUTS = Object.freeze({
  company: Object.freeze({
    ownerName: Object.freeze({
      height: 8,
      position: Object.freeze({ x: 61, y: 78.5 }),
      width: 133,
    }),
    ownerSignature: Object.freeze({
      fontSize: 9,
      height: 8,
      position: Object.freeze({ x: 151, y: 188 }),
      width: 32.5,
    }),
    phoneNumbers: Object.freeze({
      fontSize: 11,
      height: 10,
      position: Object.freeze({ x: 50, y: 114.7 }),
      width: 144,
    }),
    sealImage: Object.freeze({
      height: 16,
      position: Object.freeze({ x: 184.5, y: 184.1 }),
      width: 16,
    }),
  }),
  personal: Object.freeze({
    ownerName: Object.freeze({
      height: 7.5,
      position: Object.freeze({ x: 51, y: 59.5 }),
      width: 143,
    }),
    ownerSignature: Object.freeze({
      height: 8,
      position: Object.freeze({ x: 162, y: 151.2 }),
      width: 22,
    }),
    phoneNumbers: Object.freeze({
      height: 8,
      position: Object.freeze({ x: 39, y: 87.8 }),
      width: 155,
    }),
    sealImage: Object.freeze({
      height: 16,
      position: Object.freeze({ x: 184.5, y: 146.8 }),
      width: 16,
    }),
  }),
});

export function createSmsConsentDocumentTemplate(basePdf, {
  numberType = 'personal',
} = {}) {
  const layout = SMS_CONSENT_DOCUMENT_LAYOUTS[numberType]
    ?? SMS_CONSENT_DOCUMENT_LAYOUTS.personal;

  return {
    basePdf,
    schemas: [[
      {
        ...TEXT_FIELD_BASE,
        ...layout.ownerName,
        name: 'ownerName',
      },
      {
        ...TEXT_FIELD_BASE,
        ...layout.phoneNumbers,
        name: 'phoneNumbers',
      },
      {
        ...TEXT_FIELD_BASE,
        ...layout.ownerSignature,
        alignment: 'center',
        name: 'ownerSignature',
      },
      {
        content: '',
        ...layout.sealImage,
        name: 'sealImage',
        opacity: 1,
        required: true,
        type: 'sealImage',
      },
    ]],
  };
}

export function createSealImagePlugin(imagePlugin) {
  return {
    ...imagePlugin,
    propPanel: {
      ...imagePlugin.propPanel,
      defaultSchema: {
        ...imagePlugin.propPanel?.defaultSchema,
        content: '',
        height: 16,
        type: 'sealImage',
        width: 16,
      },
    },
    ui: (args) => renderSealImageField(args),
  };
}

function renderSealImageField({ mode, onChange, rootElement, schema, value }) {
  const editable = mode !== 'viewer' && !schema.readOnly;
  const iconRoots = [];
  const container = document.createElement('div');

  rootElement.replaceChildren();
  rootElement.classList.add('sms-consent-document-seal-field');
  container.className = 'sms-consent-document-seal-container';
  rootElement.appendChild(container);

  if (value) {
    const image = document.createElement('img');
    image.alt = '인감 이미지';
    image.className = 'sms-consent-document-seal-image';
    image.src = value;
    container.appendChild(image);
  }

  if (editable && value) {
    const removeButton = document.createElement('button');
    const iconHost = document.createElement('span');

    removeButton.type = 'button';
    removeButton.className = 'sms-consent-document-seal-remove';
    removeButton.setAttribute('aria-label', '인감 이미지 제거');
    removeButton.title = '인감 이미지 제거';
    removeButton.appendChild(iconHost);
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onChange?.({ key: 'content', value: '' });
    });
    container.appendChild(removeButton);
    iconRoots.push(mountIcon(iconHost, X, 12));
  }

  if (editable && !value) {
    const label = document.createElement('label');
    const iconHost = document.createElement('span');
    const uploadLabel = document.createElement('span');
    const input = document.createElement('input');

    label.className = 'sms-consent-document-seal-upload';
    label.title = '인감 이미지 올리기';
    iconHost.className = 'sms-consent-document-seal-upload-icon';
    uploadLabel.className = 'sms-consent-document-seal-upload-label';
    uploadLabel.textContent = '인감 업로드';
    input.className = 'sms-consent-document-seal-input';
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.tabIndex = 0;
    input.setAttribute('aria-label', '인감 이미지 올리기');
    input.addEventListener('change', async (event) => {
      const [file] = event.target.files ?? [];

      if (!file) {
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        onChange?.({ key: 'content', value: dataUrl });
      } catch (error) {
        console.error('Failed to read the SMS consent seal image.', error);
      }
    });
    label.append(iconHost, uploadLabel, input);
    container.appendChild(label);
    iconRoots.push(mountIcon(iconHost, ImageUp, 15));
  }

  const cleanup = () => {
    iconRoots.forEach((unmount) => unmount());
  };

  rootElement.addEventListener('beforeRemove', cleanup, { once: true });
}

function mountIcon(container, Icon, size) {
  const root = createRoot(container);
  root.render(createElement(Icon, {
    'aria-hidden': true,
    size,
    strokeWidth: 1.8,
  }));
  return () => window.setTimeout(() => root.unmount(), 0);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Image read failed')));
    reader.readAsDataURL(file);
  });
}
