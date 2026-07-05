import {
  getKakaoFailureReason,
  isKakaoFailureResult,
  isKakaoSuccessResult,
} from '../messageResults/kakaoResultCodes.js';
import {
  getSmsResultCodeLabel,
  isSmsFailureResult,
  isSmsSuccessResult,
} from '../messageResults/smsResultCodes.js';

export function getMessageDeliverySummary(channelLabel, logs) {
  const rows = Array.isArray(logs) ? logs : [];
  const counts = rows.reduce((current, log) => {
    const state = getLogDeliveryState(log);

    return {
      ...current,
      [state]: current[state] + 1,
      firstFailureMessage: current.firstFailureMessage || getFailureMessage(log, state, channelLabel),
    };
  }, {
    failed: 0,
    firstFailureMessage: '',
    pending: 0,
    success: 0,
  });
  const totalCount = rows.length;

  if (totalCount === 0) {
    return {
      text: `${channelLabel} 발송 요청이 접수되었습니다.`,
      tone: 'neutral',
    };
  }

  if (counts.success === totalCount) {
    return {
      text: `${channelLabel} 발송 성공: ${formatCount(totalCount)}에게 도달했습니다.`,
      tone: 'success',
    };
  }

  if (counts.failed === totalCount) {
    return {
      text: [
        `${channelLabel} 발송 실패: ${formatCount(totalCount)} 중 ${formatCount(counts.failed)} 실패했습니다.`,
        counts.firstFailureMessage,
      ].filter(Boolean).join(' '),
      tone: 'critical',
    };
  }

  return {
    text: `${channelLabel} 발송 결과: ${formatResultParts(counts).join(', ')}`,
    tone: counts.failed > 0 ? 'warning' : 'neutral',
  };
}

function getLogDeliveryState(log) {
  if (isSuccessLog(log)) {
    return 'success';
  }

  if (isFailedLog(log)) {
    return 'failed';
  }

  return 'pending';
}

function isSuccessLog(log) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const resultCode = normalizeValue(log?.resultCode).toUpperCase();
  const status = normalizeValue(log?.status).toUpperCase();

  if (channel === 'alimtalk' || channel === 'brand-message') {
    return isKakaoSuccessResult({ resultCode, status });
  }

  return isSmsSuccessResult({ resultCode, status });
}

function isFailedLog(log) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const resultCode = normalizeValue(log?.resultCode).toUpperCase();
  const status = normalizeValue(log?.status).toUpperCase();

  if (channel === 'alimtalk' || channel === 'brand-message') {
    return isKakaoFailureResult({ resultCode, status });
  }

  return isSmsFailureResult({ resultCode, status });
}

function getFailureMessage(log, state, channelLabel) {
  if (state !== 'failed') {
    return '';
  }

  if (isSmsLog(log, channelLabel)) {
    return getSmsResultCodeLabel(log?.resultCode);
  }

  if (isKakaoLog(log, channelLabel)) {
    return getKakaoFailureReason({
      resultCode: log?.resultCode,
      resultMessage: log?.resultMessage,
    });
  }

  return normalizeValue(log?.resultMessage) || normalizeValue(log?.resultCode);
}

function isKakaoLog(log, channelLabel) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const normalizedChannelLabel = normalizeValue(channelLabel);

  return channel === 'alimtalk'
    || channel === 'brand-message'
    || (!channel && (normalizedChannelLabel === '알림톡' || normalizedChannelLabel === '브랜드 메시지'));
}

function isSmsLog(log, channelLabel) {
  const channel = normalizeValue(log?.channel).toLowerCase();
  const normalizedChannelLabel = normalizeValue(channelLabel).toLowerCase();

  return channel === 'sms'
    || channel === 'lms'
    || channel === 'mms'
    || (!channel && normalizedChannelLabel === 'sms');
}

function formatResultParts({ failed, pending, success }) {
  return [
    success > 0 ? `성공 ${formatCount(success)}` : '',
    failed > 0 ? `실패 ${formatCount(failed)}` : '',
    pending > 0 ? `처리 중 ${formatCount(pending)}` : '',
  ].filter(Boolean);
}

function formatCount(value) {
  return `${Number(value).toLocaleString()}명`;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}
