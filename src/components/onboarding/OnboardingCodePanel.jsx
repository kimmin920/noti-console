'use client';

import { useId, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { OnboardingTabs } from './OnboardingTabs.jsx';
import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function toSafeId(value, index = 0) {
  const safeValue = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return safeValue || `panel-${index + 1}`;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function OnboardingCodePanel({
  className = '',
  copiedLabel = 'Copied',
  copyLabel = 'Copy for AI',
  copyFailedLabel = 'Copy unavailable',
  defaultValue,
  description,
  examples = [],
  footer,
  onValueChange,
  selectedValue,
  title,
}) {
  const id = useId();
  const timeoutRef = useRef(null);
  const firstExample = examples[0];
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstExample?.value);
  const [copyState, setCopyState] = useState('idle');
  const requestedValue = selectedValue ?? internalValue ?? firstExample?.value;
  const activeIndex = Math.max(0, examples.findIndex((example) => example.value === requestedValue));
  const activeExample = examples[activeIndex] ?? firstExample;
  const activeValue = activeExample?.value;
  const panelPrefix = `${id}-code`;
  const copied = copyState === 'copied';
  const copyButtonLabel = copyState === 'failed' ? copyFailedLabel : copied ? copiedLabel : copyLabel;

  function handleValueChange(nextValue) {
    if (selectedValue === undefined) {
      setInternalValue(nextValue);
    }
    setCopyState('idle');
    onValueChange?.(nextValue);
  }

  async function handleCopy() {
    try {
      await copyText(activeExample?.code ?? '');
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopyState('idle'), 1500);
  }

  if (!activeExample) {
    return null;
  }

  return (
    <section className={cx(styles.codePanel, className)} aria-label={title ?? 'Code example'} data-active-example={activeValue}>
      <div className={styles.codePanelHeader}>
        {title || description ? (
          <div className={styles.codePanelTitleGroup}>
            {title ? <h3 className={styles.codePanelTitle}>{title}</h3> : null}
            {description ? <p className={styles.codePanelDescription}>{description}</p> : null}
          </div>
        ) : null}
        <div className={styles.codePanelHeaderTop}>
          <OnboardingTabs
            className={styles.codePanelTabs}
            getPanelId={(item, index) => `${panelPrefix}-${toSafeId(item.value, index)}-panel`}
            getTabId={(item, index) => `${panelPrefix}-${toSafeId(item.value, index)}-tab`}
            items={examples.map((example) => ({
              disabled: example.disabled,
              label: example.label,
              value: example.value,
            }))}
            label="Code language"
            onValueChange={handleValueChange}
            selectedValue={activeValue}
          />
          <button
            aria-label={`${copyButtonLabel}: ${activeExample.label}`}
            className={styles.copyControl}
            data-copy-state={copyState}
            onClick={handleCopy}
            type="button"
          >
            {copied ? <Check aria-hidden="true" size={15} strokeWidth={1.9} /> : <Copy aria-hidden="true" size={15} strokeWidth={1.9} />}
            <span>{copyButtonLabel}</span>
          </button>
        </div>
      </div>

      {examples.map((example, index) => {
        const safeId = toSafeId(example.value, index);
        const isSelected = example.value === activeValue;

        return (
          <div
            aria-labelledby={`${panelPrefix}-${safeId}-tab`}
            className={styles.codePanelBody}
            data-selected={isSelected ? true : undefined}
            hidden={!isSelected}
            id={`${panelPrefix}-${safeId}-panel`}
            key={example.value}
            role="tabpanel"
          >
            <pre className={styles.codePre}>
              <code data-language={example.language ?? example.value}>{example.code}</code>
            </pre>
          </div>
        );
      })}

      {footer ? <div className={styles.codePanelFooter}>{footer}</div> : null}

      <span aria-live="polite" className={styles.visuallyHidden} role="status">
        {copyState === 'idle' ? '' : `${copyButtonLabel}: ${activeExample.label}`}
      </span>
    </section>
  );
}
