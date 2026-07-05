'use client';

import {
  defaultSmsSendFormSenderNumbers,
  defaultSmsSendFormValue,
} from './SmsSendForm.jsx';
import { getMessageTemplateVariableValue } from './MessageTemplateVariables.jsx';

const SMS_ADVERTISEMENT_PREFIX = '(광고)';
const SMS_ADVERTISEMENT_OPT_OUT_PREFIX = '무료수신거부';
const SMS_ADVERTISEMENT_FALLBACK_OPT_OUT_NUMBER = '080-500-4233';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSmsPreviewImages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((image, index) => {
    const fileName = image.fileName ?? image.name ?? '';

    return {
      fileName,
      id: image.id ?? `${fileName}-${image.size ?? index}-${index}`,
      previewUrl: image.previewUrl ?? image.src ?? '',
    };
  }).filter((image) => image.fileName || image.previewUrl);
}

function getSmsPreviewValue(value) {
  const mergedValue = { ...defaultSmsSendFormValue, ...value };
  const variables = Object.keys(mergedValue.variables ?? {}).length
    ? mergedValue.variables
    : mergedValue.templateParameter ?? {};

  return {
    ...mergedValue,
    body: mergedValue.body ?? '',
    imageAttachments: normalizeSmsPreviewImages(
      mergedValue.imageAttachments ?? mergedValue.attachments ?? mergedValue.images
    ),
    isAdvertisement: Boolean(mergedValue.isAdvertisement),
    senderNumber: mergedValue.senderNumber ?? '',
    unsubscribeNumber: mergedValue.unsubscribeNumber ?? '',
    variables,
  };
}

function stripLeadingAdvertisementPrefix(body) {
  return body.replace(/^\(광고\)\s*/u, '').trimStart();
}

function formatSms080Number(value) {
  const input = String(value ?? '').trim();
  const digits = input.replace(/\D/g, '');

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return input;
}

function formatSmsAdvertisementOptOutText(unsubscribeNumber) {
  const number = formatSms080Number(unsubscribeNumber) || SMS_ADVERTISEMENT_FALLBACK_OPT_OUT_NUMBER;

  return `${SMS_ADVERTISEMENT_OPT_OUT_PREFIX} ${number}`;
}

function isSmsAdvertisementOptOutLine(line) {
  return new RegExp(`^${escapeRegex(SMS_ADVERTISEMENT_OPT_OUT_PREFIX)}\\s+080[-\\d\\s]+$`, 'u').test(line);
}

function formatSmsPreviewBody(message) {
  const normalizedBody = message.body.replace(/\r\n?/g, '\n').trim();

  if (!message.isAdvertisement) {
    return normalizedBody;
  }

  const content = stripLeadingAdvertisementPrefix(
    normalizedBody
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => !isSmsAdvertisementOptOutLine(line.trim()))
      .join('\n')
      .trim()
  );

  return [
    SMS_ADVERTISEMENT_PREFIX,
    content,
    formatSmsAdvertisementOptOutText(message.unsubscribeNumber),
  ].filter(Boolean).join('\n');
}

function getSmsPreviewSenderNumber(message, senderNumbers) {
  const selectedSenderNumber = senderNumbers.find((senderNumber) => (
    senderNumber.value === message.senderNumber
    || senderNumber.phoneNumber === message.senderNumber
  ));

  return selectedSenderNumber?.phoneNumber
    ?? selectedSenderNumber?.value
    ?? message.senderNumber;
}

function renderSmsPreviewText(text, variables) {
  return text.split(/(##[^#]+##)/g).map((part, index) => {
    const match = part.match(/^##([^#]+)##$/);

    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    const value = getMessageTemplateVariableValue(variables, match[1].trim());

    return value ? (
      <span key={`${part}-${index}`}>{value}</span>
    ) : (
      <span className="sms-preview-token" key={`${part}-${index}`} translate="no">
        {part}
      </span>
    );
  });
}

export function SmsPreview({
  className = '',
  senderNumbers = defaultSmsSendFormSenderNumbers,
  timeLabel = '오늘 오후 2:30',
  value,
  ...props
}) {
  const message = getSmsPreviewValue(value);
  const body = formatSmsPreviewBody(message);
  const senderNumber = getSmsPreviewSenderNumber(message, senderNumbers);
  const previewImages = message.imageAttachments.filter((image) => image.previewUrl);

  return (
    <aside
      aria-label="SMS 미리보기"
      className={['sms-preview', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="sms-preview-title">미리보기</div>
      <div className="sms-preview-phone">
        <div className="sms-preview-time">{timeLabel}</div>
        <div className="sms-preview-scroll">
          {previewImages.length ? (
            <div className="sms-preview-images">
              {previewImages.map((image) => (
                <div className="sms-preview-media-row" key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.previewUrl} alt={image.fileName || 'SMS 첨부 이미지'} />
                </div>
              ))}
            </div>
          ) : null}
          <div className="sms-preview-media-row">
            <div className="sms-preview-bubble">
              {body.trim() ? renderSmsPreviewText(body, message.variables) : <span className="sms-preview-placeholder">내용을 입력하면 표시됩니다</span>}
            </div>
          </div>
          <div className="sms-preview-sender">{senderNumber || '발신번호 없음'}</div>
        </div>
      </div>
    </aside>
  );
}
