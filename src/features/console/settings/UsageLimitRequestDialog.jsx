'use client';

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
} from '../../../components/ui/index.js';
import { formatLimitCount } from './limitIncreaseRequestLabels.js';

export function LimitRequestDialog({
  error,
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
  pending,
  requestOptions,
  selectedOption,
}) {
  const requestedLimit = Number(form.requestedLimit);
  const requestedLimitInvalid = !Number.isInteger(requestedLimit)
    || requestedLimit <= (selectedOption?.currentLimit ?? 0);
  const submitDisabled = pending || !selectedOption || !form.reason.trim() || requestedLimitInvalid;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="limit-request-dialog">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>한도 상향 신청</DialogTitle>
            <DialogDescription>
              문자 월 한도 또는 카카오 채널별 일 한도 상향을 운영자에게 요청합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="limit-request-form-grid">
              <FormField.Root>
                <FormField.Label htmlFor="limit-request-target" required>신청 대상</FormField.Label>
                <FormField.Control>
                  <FormField.Select
                    id="limit-request-target"
                    onChange={(event) => onFormChange((current) => ({ ...current, target: event.target.value }))}
                    value={selectedOption?.value ?? ''}
                  >
                    {requestOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </FormField.Select>
                  {selectedOption ? (
                    <FormField.Help>
                      {selectedOption.detail} · 현재 {formatLimitCount(selectedOption.currentLimit, {
                        cadence: selectedOption.cadence,
                      })}
                    </FormField.Help>
                  ) : null}
                </FormField.Control>
              </FormField.Root>

              <FormField.Root>
                <FormField.Label htmlFor="limit-request-count" required>요청 한도</FormField.Label>
                <FormField.Control>
                  <FormField.Input
                    aria-invalid={requestedLimitInvalid && form.requestedLimit ? 'true' : undefined}
                    id="limit-request-count"
                    inputMode="numeric"
                    min={(selectedOption?.currentLimit ?? 0) + 1}
                    onChange={(event) => onFormChange((current) => ({ ...current, requestedLimit: event.target.value }))}
                    placeholder="예: 5000"
                    type="number"
                    value={form.requestedLimit}
                  />
                  <FormField.Help>{selectedOption?.cadence ?? '월'} 기준 요청 건수</FormField.Help>
                </FormField.Control>
              </FormField.Root>

              <FormField.Root className="limit-request-reason-field">
                <FormField.Label htmlFor="limit-request-reason" required>신청 사유</FormField.Label>
                <FormField.Control>
                  <FormField.Textarea
                    id="limit-request-reason"
                    maxLength={1000}
                    onChange={(event) => onFormChange((current) => ({ ...current, reason: event.target.value }))}
                    placeholder="예상 발송량, 기간, 사용 목적을 적어 주세요."
                    rows={4}
                    value={form.reason}
                  />
                </FormField.Control>
              </FormField.Root>
            </div>
            {error ? <FormField.Error>{error}</FormField.Error> : null}
          </DialogBody>
          <DialogFooter>
            <Button disabled={pending} onClick={() => onOpenChange(false)} type="button" variant="secondary">
              취소
            </Button>
            <Button disabled={submitDisabled} type="submit" variant="primary">
              {pending ? '신청 중' : '신청 제출'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
