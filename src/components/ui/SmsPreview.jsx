'use client';

import { useState } from 'react';
import {
  defaultSmsSendFormSenderNumbers,
  defaultSmsSendFormValue,
} from './SmsSendForm.jsx';
import { getMessageTemplateVariableValue } from './MessageTemplateVariables.jsx';

const SMS_ADVERTISEMENT_PREFIX = '(광고)';
const SMS_ADVERTISEMENT_OPT_OUT_PREFIX = '무료수신거부';
const SMS_ADVERTISEMENT_FALLBACK_OPT_OUT_NUMBER = '080 번호 입력';
const SMS_MAX_BYTES = 90;

function isSameDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function formatSmsPreviewTime(value, referenceDate = new Date()) {
  const scheduledDate = value ? new Date(value) : null;
  const date = scheduledDate && !Number.isNaN(scheduledDate.getTime())
    ? scheduledDate
    : referenceDate;
  const tomorrow = new Date(referenceDate);

  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateLabel = isSameDate(date, referenceDate)
    ? '오늘'
    : isSameDate(date, tomorrow)
      ? '내일'
      : date.getFullYear() === referenceDate.getFullYear()
        ? `${date.getMonth() + 1}월 ${date.getDate()}일`
        : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  const hour = date.getHours();
  const meridiem = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${dateLabel} ${meridiem} ${displayHour}:${minute}`;
}

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

function getSmsPreviewByteLength(value) {
  return Array.from(value).reduce((total, character) => (
    total + (character.charCodeAt(0) > 127 ? 2 : 1)
  ), 0);
}

function shouldRenderSmsPreviewTitle(message, body) {
  const title = String(message.managementTitle ?? '').trim();

  if (!title) {
    return false;
  }

  return message.imageAttachments.length > 0 || getSmsPreviewByteLength(body) > SMS_MAX_BYTES;
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
  timeLabel,
  value,
  ...props
}) {
  const [initialPreviewDate] = useState(() => new Date());
  const message = getSmsPreviewValue(value);
  const body = formatSmsPreviewBody(message);
  const shouldRenderTitle = shouldRenderSmsPreviewTitle(message, body);
  const senderNumber = getSmsPreviewSenderNumber(message, senderNumbers);
  const previewImages = message.imageAttachments.filter((image) => image.previewUrl);
  const resolvedTimeLabel = timeLabel ?? formatSmsPreviewTime(message.scheduledAt, initialPreviewDate);

  return (
    <aside
      aria-label="SMS 미리보기"
      className={['sms-preview', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="sms-preview-title">미리보기</div>
      <div className="sms-preview-phone">
        <div className="sms-preview-time">{resolvedTimeLabel}</div>
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
              {shouldRenderTitle ? (
                <div className="sms-preview-message-title">
                  {renderSmsPreviewText(message.managementTitle.trim(), message.variables)}
                </div>
              ) : null}
              {body.trim() ? renderSmsPreviewText(body, message.variables) : <span className="sms-preview-placeholder">내용을 입력하면 표시됩니다</span>}
            </div>
          </div>
          <div className="sms-preview-sender">{senderNumber || '발신번호 없음'}</div>
        </div>
      </div>
    </aside>
  );
}
