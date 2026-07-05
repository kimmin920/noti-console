'use client';

import { useId } from 'react';

import {
  Button,
  ConfirmationDialog,
  TextField,
} from '../../../components/ui/index.js';

export function AutomationTextField({ error, label, required = false, ...props }) {
  const generatedErrorId = useId();
  const errorId = error ? `${generatedErrorId}-error` : undefined;
  const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

  return (
    <label className="automation-rule-editor-field">
      <span>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <TextField.Root>
        <TextField.Input
          {...props}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
        />
      </TextField.Root>
      {error ? <span className="automation-rule-editor-field-error" id={errorId} role="alert">{error}</span> : null}
    </label>
  );
}

export function AutomationSelectField({ children, error, label, required = false, ...props }) {
  const generatedErrorId = useId();
  const errorId = error ? `${generatedErrorId}-error` : undefined;
  const describedBy = [props['aria-describedby'], errorId].filter(Boolean).join(' ') || undefined;

  return (
    <label className="automation-rule-editor-field">
      <span>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <select
        {...props}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        className="automation-rule-editor-select"
      >
        {children}
      </select>
      {error ? <span className="automation-rule-editor-field-error" id={errorId} role="alert">{error}</span> : null}
    </label>
  );
}

export function CancelButton({ dirty, onCancel }) {
  if (!dirty) {
    return <Button onClick={onCancel} variant="secondary">취소</Button>;
  }

  return (
    <ConfirmationDialog
      cancelLabel="계속 편집"
      confirmLabel="나가기"
      description="저장하지 않은 변경 사항이 있습니다. 목록으로 돌아가면 현재 입력값은 사라집니다."
      onConfirm={onCancel}
      title="저장하지 않고 나갈까요?"
    >
      <Button variant="secondary">취소</Button>
    </ConfirmationDialog>
  );
}
