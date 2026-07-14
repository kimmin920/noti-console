'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FileWarning, LoaderCircle } from 'lucide-react';
import {
  createSealImagePlugin,
} from './smsConsentDocumentTemplate.js';
import {
  createSmsRelationshipProofDocumentTemplate,
  createSmsRelationshipProofInitialInputs,
  getMissingSmsRelationshipProofFields,
  SMS_RELATIONSHIP_PROOF_DOCUMENT_FONT_NAME,
} from './smsRelationshipProofDocumentTemplate.js';

const DOCUMENT_URL = '/documents/sender-number-relationship-proof.pdf';
const DOCUMENT_FONT_URL = '/fonts/pdfme/NanumGothic-Regular.ttf';
const TEXT_FIELDS = Object.freeze([
  {
    inputName: 'ownerCompanyName',
    label: '번호 명의 사업자 상호',
    name: 'relationship-owner-company-name',
    placeholder: '예: 주식회사 예시',
  },
  {
    inputMode: 'numeric',
    inputName: 'ownerBusinessNumber',
    label: '번호 명의 사업자 사업자등록번호',
    name: 'relationship-owner-business-number',
    placeholder: '예: 123-45-67890',
  },
  {
    inputMode: 'tel',
    inputName: 'senderNumber',
    label: '대상 발신번호',
    name: 'relationship-sender-number',
    placeholder: '예: 02-1234-5678',
  },
  {
    inputName: 'relationshipDescription',
    label: '번호 명의 사업자와 실제 이용 사업자 간 관계 설명',
    name: 'relationship-description',
    placeholder: '예: 위임인의 요청에 따라 발신번호 사전등록 및 문자 발송 업무를 수행합니다.',
  },
  {
    inputName: 'signedDate',
    label: '작성일',
    name: 'relationship-signed-date',
    placeholder: '예: 2026년 07월 14일',
  },
  {
    inputName: 'ownerSignature',
    label: '번호 명의 사업자 서명란 상호',
    name: 'relationship-owner-signature',
    placeholder: '예: 주식회사 예시',
  },
]);

export const SmsRelationshipProofDocumentForm = forwardRef(function SmsRelationshipProofDocumentForm({
  initialInputs = createSmsRelationshipProofInitialInputs(),
  onInputsChange,
}, ref) {
  const containerRef = useRef(null);
  const formRef = useRef(null);
  const generationContextRef = useRef(null);
  const initialInputsRef = useRef({ ...initialInputs });
  const inputsRef = useRef({ ...initialInputs });
  const onInputsChangeRef = useRef(onInputsChange);
  const [status, setStatus] = useState('loading');

  useImperativeHandle(ref, () => {
    const getInputs = () => {
      const formInputs = formRef.current?.getInputs()?.[0] ?? inputsRef.current;
      const liveInputs = Object.fromEntries(TEXT_FIELDS.map(({ inputName, name }) => [
        inputName,
        getLiveTextFieldValue(containerRef.current, name) ?? formInputs[inputName] ?? '',
      ]));
      const nextInputs = {
        ...inputsRef.current,
        ...formInputs,
        ...liveInputs,
      };

      inputsRef.current = nextInputs;
      return nextInputs;
    };

    return {
      async generatePdf() {
        const context = generationContextRef.current;

        if (!context) {
          throw new Error('관계확인서가 아직 준비되지 않았습니다.');
        }

        const { generate } = await import('@pdfme/generator');
        const inputs = getInputs();
        const missingFields = getMissingSmsRelationshipProofFields(inputs);

        setDocumentValidationState(containerRef.current, missingFields);
        if (missingFields.length > 0) {
          focusFirstMissingDocumentField(containerRef.current, missingFields[0]);
          throw new Error('사업자 정보, 발신번호, 관계 설명, 작성일, 서명란 상호, 직인을 모두 입력해 주세요.');
        }

        const pdf = await generate({
          inputs: [inputs],
          options: {
            font: {
              [SMS_RELATIONSHIP_PROOF_DOCUMENT_FONT_NAME]: {
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
        const [{ Form }, { image, text }, pdfResponse, fontResponse] = await Promise.all([
          import('@pdfme/ui'),
          import('@pdfme/schemas'),
          fetch(DOCUMENT_URL, {
            cache: 'no-store',
            signal: abortController.signal,
          }),
          fetch(DOCUMENT_FONT_URL, {
            cache: 'force-cache',
            signal: abortController.signal,
          }),
        ]);
        const contentType = pdfResponse.headers.get('content-type') ?? '';

        if (!pdfResponse.ok || !contentType.includes('application/pdf')) {
          throw new Error(`Relationship proof document request failed with ${pdfResponse.status}`);
        }

        if (!fontResponse.ok) {
          throw new Error(`Relationship proof font request failed with ${fontResponse.status}`);
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
        const template = createSmsRelationshipProofDocumentTemplate(basePdf);

        generationContextRef.current = { fontData, plugins, template };
        form = new Form({
          domContainer: containerRef.current,
          inputs: [{ ...initialInputsRef.current }],
          options: {
            font: {
              [SMS_RELATIONSHIP_PROOF_DOCUMENT_FONT_NAME]: {
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
        cancelInitialViewport = configureInitialFormViewport(containerRef.current);
        setStatus('ready');
      } catch (error) {
        if (disposed || error?.name === 'AbortError') {
          return;
        }

        console.error('Failed to initialize the SMS relationship proof document form.', error);
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
      data-sms-relationship-proof-document-form
      data-state={status}
    >
      <div className="sms-consent-document-form-host" ref={containerRef} />
      {status === 'loading' ? (
        <div className="sms-consent-document-form-status" role="status">
          <LoaderCircle aria-hidden="true" className="sms-consent-document-form-spinner" size={18} />
          <span>관계확인서를 불러오는 중입니다.</span>
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="sms-consent-document-form-status" role="alert">
          <FileWarning aria-hidden="true" size={18} />
          <span>관계확인서를 표시하지 못했습니다.</span>
        </div>
      ) : null}
    </div>
  );
});

function configureInitialFormViewport(host) {
  let animationFrame = 0;
  let attempts = 0;
  const settleTimers = [];
  const observer = new MutationObserver(() => configureFormTextFields(host));
  const handleFieldShellClick = (event) => focusPdfmeTextFieldFromShell(event, host);
  const handleFieldKeyDown = (event) => moveFocusBetweenDocumentFields(event, host);

  observer.observe(host, { childList: true, subtree: true });
  host.addEventListener('click', handleFieldShellClick);
  host.addEventListener('keydown', handleFieldKeyDown, true);

  const tryConfigure = () => {
    const fitWidthButton = host.querySelector('[title="너비에 맞춤"], [title="Fit to width"]');

    attempts += 1;
    if (!fitWidthButton || fitWidthButton.disabled) {
      if (attempts < 180) {
        animationFrame = window.requestAnimationFrame(tryConfigure);
      }
      return;
    }

    configureFormTextFields(host);
    fitWidthButton.click();
    animationFrame = window.requestAnimationFrame(() => {
      scrollPdfmeFormToTop(host);
      animationFrame = window.requestAnimationFrame(() => scrollPdfmeFormToTop(host));
    });
    for (const delay of [180, 500, 1000]) {
      settleTimers.push(window.setTimeout(() => scrollPdfmeFormToTop(host), delay));
    }
  };

  animationFrame = window.requestAnimationFrame(tryConfigure);

  return () => {
    observer.disconnect();
    host.removeEventListener('click', handleFieldShellClick);
    host.removeEventListener('keydown', handleFieldKeyDown, true);
    window.cancelAnimationFrame(animationFrame);
    settleTimers.forEach((timer) => window.clearTimeout(timer));
  };
}

function configureFormTextFields(host) {
  const fields = Array.from(host.querySelectorAll('[contenteditable]'));

  if (fields.length < TEXT_FIELDS.length) {
    return;
  }

  TEXT_FIELDS.forEach((config, index) => configureTextField(fields[index], {
    host,
    ...config,
  }));
}

function configureTextField(field, {
  host,
  inputMode,
  inputName,
  label,
  name,
  placeholder,
}) {
  const fieldShell = field.closest('.selectable');

  field.dataset.pdfmeField = name;
  field.setAttribute('aria-label', label);
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
    ...TEXT_FIELDS.map(({ name }) => host.querySelector(`[data-pdfme-field="${name}"]`)),
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

  TEXT_FIELDS.forEach(({ inputName, name }) => {
    setTextFieldValidation(host, name, missing.has(inputName));
  });

  const sealField = host?.querySelector('.sms-consent-document-seal-field');
  const sealInvalid = missing.has('ownerSealImage');

  sealField?.toggleAttribute('data-invalid', sealInvalid);
  sealField?.setAttribute('aria-invalid', String(sealInvalid));
}

function setTextFieldValidation(host, name, invalid) {
  const field = host?.querySelector(`[data-pdfme-field="${name}"]`);
  const fieldShell = host?.querySelector(`[data-pdfme-field-shell="${name}"]`);

  field?.setAttribute('aria-invalid', String(invalid));
  fieldShell?.toggleAttribute('data-invalid', invalid);
}

function clearDocumentFieldValidation(host, inputName) {
  if (inputName === 'ownerSealImage') {
    const sealField = host?.querySelector('.sms-consent-document-seal-field');
    sealField?.removeAttribute('data-invalid');
    sealField?.setAttribute('aria-invalid', 'false');
    return;
  }

  const fieldConfig = TEXT_FIELDS.find((field) => field.inputName === inputName);

  if (fieldConfig) {
    setTextFieldValidation(host, fieldConfig.name, false);
  }
}

function focusFirstMissingDocumentField(host, inputName) {
  if (inputName === 'ownerSealImage') {
    host?.querySelector('.sms-consent-document-seal-input')?.focus({ preventScroll: true });
    return;
  }

  const fieldConfig = TEXT_FIELDS.find((field) => field.inputName === inputName);
  host?.querySelector(`[data-pdfme-field="${fieldConfig?.name}"]`)?.focus({ preventScroll: true });
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
