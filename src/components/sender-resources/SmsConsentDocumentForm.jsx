'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FileWarning, LoaderCircle } from 'lucide-react';
import {
  createSealImagePlugin,
  createSmsConsentDocumentTemplate,
  getMissingSmsConsentDocumentFields,
  SMS_CONSENT_DOCUMENT_FONT_NAME,
  SMS_CONSENT_DOCUMENT_INITIAL_INPUTS,
} from './smsConsentDocumentTemplate.js';

const CONSENT_DOCUMENT_FONT_URL = '/fonts/pdfme/NanumGothic-Regular.ttf';
const CONSENT_DOCUMENT_CONFIGS = Object.freeze({
  company: Object.freeze({
    ownerLabel: '발신번호 명의 사업자 정보',
    ownerPlaceholder: '예: 주식회사 비주오 / 123-45-67890 / 홍길동',
    signatureLabel: '발신번호 명의 사업자명',
    signaturePlaceholder: '예: 주식회사 비주오',
    url: '/documents/phone-number-consent-business.pdf',
  }),
  personal: Object.freeze({
    ownerLabel: '발신번호 명의자 정보',
    ownerPlaceholder: '예: 홍길동 / 1990.01.01 / 개인',
    signatureLabel: '발신번호 명의자 서명 이름',
    signaturePlaceholder: '예: 홍길동',
    url: '/documents/phone-number-consent-individual.pdf',
  }),
});

export const SmsConsentDocumentForm = forwardRef(function SmsConsentDocumentForm({
  initialInputs = SMS_CONSENT_DOCUMENT_INITIAL_INPUTS,
  numberType = 'personal',
  onInputsChange,
}, ref) {
  const containerRef = useRef(null);
  const formRef = useRef(null);
  const generationContextRef = useRef(null);
  const initialInputsRef = useRef({ ...initialInputs });
  const inputsRef = useRef({ ...initialInputs });
  const numberTypeRef = useRef(numberType);
  const onInputsChangeRef = useRef(onInputsChange);
  const [status, setStatus] = useState('loading');

  useImperativeHandle(ref, () => {
    const getInputs = () => {
      const formInputs = formRef.current?.getInputs()?.[0] ?? inputsRef.current;
      const liveOwnerName = getLiveTextFieldValue(containerRef.current, 'owner-name-details');
      const liveOwnerSignature = getLiveTextFieldValue(containerRef.current, 'owner-name-signature');
      const livePhoneNumbers = getLiveTextFieldValue(containerRef.current, 'phone-numbers');
      const nextInputs = {
        ...inputsRef.current,
        ...formInputs,
        ownerName: liveOwnerName ?? formInputs.ownerName ?? '',
        ownerSignature: liveOwnerSignature ?? formInputs.ownerSignature ?? '',
        phoneNumbers: livePhoneNumbers ?? formInputs.phoneNumbers ?? '',
      };

      inputsRef.current = nextInputs;
      return nextInputs;
    };

    return {
      async generatePdf() {
        const context = generationContextRef.current;

        if (!context) {
          throw new Error('이용승낙서가 아직 준비되지 않았습니다.');
        }

        const { generate } = await import('@pdfme/generator');
        const inputs = getInputs();
        const missingFields = getMissingSmsConsentDocumentFields(inputs);

        setDocumentValidationState(containerRef.current, missingFields);
        if (missingFields.length > 0) {
          focusFirstMissingDocumentField(containerRef.current, missingFields[0]);
          throw new Error('명의자 정보, 서명란 이름, 전화번호, 직인을 모두 입력해 주세요.');
        }

        const pdf = await generate({
          inputs: [inputs],
          options: {
            font: {
              [SMS_CONSENT_DOCUMENT_FONT_NAME]: {
                data: context.fontData,
                fallback: true,
                subset: true,
              },
            },
          },
          plugins: context.plugins,
          template: context.template,
        });

        return { inputs, pdf };
      },
      getInputs,
    };
  }, []);

  useEffect(() => {
    onInputsChangeRef.current = onInputsChange;
  }, [onInputsChange]);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelInitialViewport = () => {};
    let disposed = false;
    let form = null;

    async function mountForm() {
      try {
        const documentConfig = getConsentDocumentConfig(numberTypeRef.current);
        const [{ Form }, { image, text }, pdfResponse, fontResponse] = await Promise.all([
          import('@pdfme/ui'),
          import('@pdfme/schemas'),
          fetch(documentConfig.url, {
            cache: 'no-store',
            signal: abortController.signal,
          }),
          fetch(CONSENT_DOCUMENT_FONT_URL, {
            cache: 'force-cache',
            signal: abortController.signal,
          }),
        ]);

        const contentType = pdfResponse.headers.get('content-type') ?? '';

        if (!pdfResponse.ok || !contentType.includes('application/pdf')) {
          throw new Error(`Consent document request failed with ${pdfResponse.status}`);
        }

        if (!fontResponse.ok) {
          throw new Error(`Consent document font request failed with ${fontResponse.status}`);
        }

        const [basePdf, fontData] = await Promise.all([
          pdfResponse.arrayBuffer(),
          fontResponse.arrayBuffer(),
        ]);

        if (disposed || !containerRef.current) {
          return;
        }

        const plugins = {
          sealImage: createSealImagePlugin(image),
          text,
        };
        const template = createSmsConsentDocumentTemplate(basePdf, {
          numberType: numberTypeRef.current,
        });
        generationContextRef.current = {
          fontData,
          plugins,
          template,
        };
        form = new Form({
          domContainer: containerRef.current,
          inputs: [{ ...initialInputsRef.current }],
          options: {
            font: {
              [SMS_CONSENT_DOCUMENT_FONT_NAME]: {
                data: fontData,
                fallback: true,
                subset: true,
              },
            },
            lang: 'ko',
            maxZoom: 300,
            theme: {
              token: {
                borderRadius: 6,
                colorPrimary: '#191919',
              },
            },
            zoomLevel: 1,
          },
          plugins,
          template,
        });
        formRef.current = form;
        form.onChangeInput(({ name, value }) => {
          const nextInputs = {
            ...inputsRef.current,
            [name]: value,
          };
          inputsRef.current = nextInputs;
          clearDocumentFieldValidation(containerRef.current, name);
          onInputsChangeRef.current?.(nextInputs);
        });
        cancelInitialViewport = configureInitialFormViewport(
          containerRef.current,
          numberTypeRef.current,
        );
        setStatus('ready');
      } catch (error) {
        if (disposed || error?.name === 'AbortError') {
          return;
        }

        console.error('Failed to initialize the SMS consent document form.', error);
        setStatus('error');
      }
    }

    mountForm();

    return () => {
      disposed = true;
      abortController.abort();
      cancelInitialViewport();
      formRef.current = null;
      generationContextRef.current = null;
      form?.destroy();
    };
  }, []);

  return (
    <div
      aria-busy={status === 'loading'}
      className="sms-consent-document-form"
      data-state={status}
      data-sms-consent-document-form
    >
      <div className="sms-consent-document-form-host" ref={containerRef} />
      {status === 'loading' ? (
        <div className="sms-consent-document-form-status" role="status">
          <LoaderCircle aria-hidden="true" className="sms-consent-document-form-spinner" size={18} />
          <span>이용승낙서를 불러오는 중입니다.</span>
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="sms-consent-document-form-status" role="alert">
          <FileWarning aria-hidden="true" size={18} />
          <span>이용승낙서를 표시하지 못했습니다.</span>
        </div>
      ) : null}
    </div>
  );
});

function configureInitialFormViewport(host, numberType) {
  let animationFrame = 0;
  let settleTimer = 0;
  let attempts = 0;
  const observer = new MutationObserver(() => configureFormTextFields(host, numberType));
  const handleFieldShellClick = (event) => focusPdfmeTextFieldFromShell(event, host);
  const handleFieldKeyDown = (event) => moveFocusBetweenDocumentFields(event, host);

  observer.observe(host, {
    childList: true,
    subtree: true,
  });
  host.addEventListener('click', handleFieldShellClick);
  host.addEventListener('keydown', handleFieldKeyDown, true);

  const tryConfigure = () => {
    const fields = Array.from(host.querySelectorAll('[contenteditable]'));
    const fitWidthButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === '너비에 맞춤',
    );

    if (fields.length < 3 || !fitWidthButton || fitWidthButton.disabled) {
      attempts += 1;
      if (attempts < 180) {
        animationFrame = window.requestAnimationFrame(tryConfigure);
      }
      return;
    }

    configureFormTextFields(host, numberType);
    fitWidthButton.click();
    animationFrame = window.requestAnimationFrame(() => {
      scrollPdfmeFormToTop(host);
      animationFrame = window.requestAnimationFrame(() => scrollPdfmeFormToTop(host));
    });
    settleTimer = window.setTimeout(() => scrollPdfmeFormToTop(host), 180);
  };

  animationFrame = window.requestAnimationFrame(tryConfigure);

  return () => {
    observer.disconnect();
    host.removeEventListener('click', handleFieldShellClick);
    host.removeEventListener('keydown', handleFieldKeyDown, true);
    window.cancelAnimationFrame(animationFrame);
    window.clearTimeout(settleTimer);
  };
}

function configureFormTextFields(host, numberType) {
  const fields = Array.from(host.querySelectorAll('[contenteditable]'));
  const documentConfig = getConsentDocumentConfig(numberType);

  if (fields.length < 3) {
    return;
  }

  configureTextField(fields[0], {
    host,
    inputName: 'ownerName',
    label: documentConfig.ownerLabel,
    name: 'owner-name-details',
    placeholder: documentConfig.ownerPlaceholder,
  });
  configureTextField(fields[1], {
    host,
    inputMode: 'tel',
    inputName: 'phoneNumbers',
    label: '전화번호 목록',
    multiline: true,
    name: 'phone-numbers',
    placeholder: '예: 010-1234-5678',
  });
  configureTextField(fields[2], {
    host,
    inputName: 'ownerSignature',
    label: documentConfig.signatureLabel,
    name: 'owner-name-signature',
    placeholder: documentConfig.signaturePlaceholder,
  });
}

function getConsentDocumentConfig(numberType) {
  return CONSENT_DOCUMENT_CONFIGS[numberType] ?? CONSENT_DOCUMENT_CONFIGS.personal;
}

function configureTextField(field, {
  host,
  inputMode,
  inputName,
  label,
  multiline = false,
  name,
  placeholder,
}) {
  const fieldShell = field.closest('.selectable');

  field.dataset.pdfmeField = name;
  field.setAttribute('aria-label', label);
  field.setAttribute('aria-multiline', String(multiline));
  field.setAttribute('aria-placeholder', placeholder);
  field.dataset.placeholder = placeholder;
  field.setAttribute('role', 'textbox');
  field.spellcheck = false;
  field.tabIndex = 0;
  if (fieldShell) {
    fieldShell.dataset.pdfmeFieldShell = name;
  }

  if (inputMode) {
    field.setAttribute('inputmode', inputMode);
  }

  if (!field.hasAttribute('data-validation-listener')) {
    field.addEventListener('input', () => clearDocumentFieldValidation(host, inputName));
    field.setAttribute('data-validation-listener', 'true');
  }
}

function moveFocusBetweenDocumentFields(event, host) {
  if (
    event.key !== 'Tab'
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || !(event.target instanceof Element)
  ) {
    return;
  }

  const tabStops = [
    host.querySelector('[data-pdfme-field="owner-name-details"]'),
    host.querySelector('[data-pdfme-field="phone-numbers"]'),
    host.querySelector('[data-pdfme-field="owner-name-signature"]'),
    host.querySelector('.sms-consent-document-seal-input, .sms-consent-document-seal-remove'),
  ].filter((element) => element instanceof HTMLElement && !element.matches(':disabled'));
  const currentIndex = tabStops.findIndex(
    (element) => element === event.target || element.contains(event.target),
  );

  if (currentIndex < 0) {
    return;
  }

  const nextIndex = currentIndex + (event.shiftKey ? -1 : 1);
  let nextElement = tabStops[nextIndex];

  if (!nextElement && event.shiftKey) {
    nextElement = host.closest('[role="dialog"]')?.querySelector('button[aria-label="닫기"]');
  } else if (!nextElement) {
    nextElement = host.closest('[role="dialog"]')
      ?.querySelector('.sms-consent-document-modal-footer button:not(:disabled)');
  }

  if (!(nextElement instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  nextElement.focus();
}

function setDocumentValidationState(host, missingFields) {
  const missing = new Set(missingFields);

  setTextFieldValidation(host, 'owner-name-details', missing.has('ownerName'));
  setTextFieldValidation(host, 'owner-name-signature', missing.has('ownerSignature'));
  setTextFieldValidation(host, 'phone-numbers', missing.has('phoneNumbers'));

  const sealField = host?.querySelector('.sms-consent-document-seal-field');
  const sealInvalid = missing.has('sealImage');

  sealField?.toggleAttribute('data-invalid', sealInvalid);
  sealField?.setAttribute('aria-invalid', String(sealInvalid));
}

function setTextFieldValidation(host, name, invalid) {
  const field = host?.querySelector(`[data-pdfme-field="${name}"]`);
  const fieldShell = host?.querySelector(`[data-pdfme-field-shell="${name}"]`);

  field?.setAttribute('aria-invalid', String(invalid));
  fieldShell?.toggleAttribute('data-invalid', invalid);
}

function clearDocumentFieldValidation(host, name) {
  if (name === 'ownerName') {
    setTextFieldValidation(host, 'owner-name-details', false);
    return;
  }

  if (name === 'ownerSignature') {
    setTextFieldValidation(host, 'owner-name-signature', false);
    return;
  }

  if (name === 'phoneNumbers') {
    setTextFieldValidation(host, 'phone-numbers', false);
    return;
  }

  if (name === 'sealImage') {
    const sealField = host?.querySelector('.sms-consent-document-seal-field');
    sealField?.removeAttribute('data-invalid');
    sealField?.setAttribute('aria-invalid', 'false');
  }
}

function focusFirstMissingDocumentField(host, name) {
  if (name === 'sealImage') {
    host?.querySelector('.sms-consent-document-seal-input')?.focus({ preventScroll: true });
    return;
  }

  const pdfmeField = {
    ownerName: 'owner-name-details',
    ownerSignature: 'owner-name-signature',
    phoneNumbers: 'phone-numbers',
  }[name];
  host?.querySelector(`[data-pdfme-field="${pdfmeField}"]`)?.focus({ preventScroll: true });
}

function getLiveTextFieldValue(host, name) {
  const field = host?.querySelector(`[data-pdfme-field="${name}"]`);

  if (!field) {
    return undefined;
  }

  return field.innerText ?? field.textContent ?? '';
}

function focusPdfmeTextFieldFromShell(event, host) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const fieldShell = target.closest('[data-pdfme-field-shell]');

  if (!fieldShell || !host.contains(fieldShell)) {
    return;
  }

  const field = fieldShell.querySelector('[contenteditable]');

  if (!field || field.contains(target)) {
    return;
  }

  field.focus({ preventScroll: true });
  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function scrollPdfmeFormToTop(host) {
  const scrollContainer = Array.from(host.querySelectorAll('div')).find((element) => {
    const style = window.getComputedStyle(element);
    return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
  });

  scrollContainer?.scrollTo({
    behavior: 'auto',
    left: 0,
    top: 0,
  });
}
