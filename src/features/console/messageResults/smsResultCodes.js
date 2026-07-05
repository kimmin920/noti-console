export const SMS_SUCCESS_RESULT_CODE = '1000';
export const SMS_SUCCESS_RESULT_CODES = new Set([SMS_SUCCESS_RESULT_CODE]);

const SMS_NEUTRAL_RESULT_CODES = new Set(['0']);
const SMS_FAILED_STATUSES = new Set(['4', '5', 'FAILED', 'FAILED_AD', 'DUPLICATED', 'FAIL', 'ERROR']);

const SMS_RESULT_CODE_LABELS = {
  1000: '성공',
  1002: '수신 번호 형식 오류',
  1003: '발신 번호 형식 오류',
  2000: '전송 시간 초과',
  2001: '전송 실패',
  2003: '단말기 전원 꺼짐',
  3000: '전송할 수 없음',
  3001: '가입자 없음',
  3003: '수신 번호 오류 또는 결번',
  3006: '착신 거절',
  3012: '스팸',
  E915: '중복 메시지',
};

export function getSmsResultCodeLabel(code) {
  const normalizedCode = normalizeResultCode(code);
  if (!normalizedCode) return '';

  return SMS_RESULT_CODE_LABELS[normalizedCode] ?? `코드 ${normalizedCode}`;
}

export function isSmsSuccessResultCode(code) {
  return SMS_SUCCESS_RESULT_CODES.has(normalizeResultCode(code));
}

export function getSmsResultState({ resultCode, status } = {}) {
  const normalizedResultCode = normalizeResultCode(resultCode);
  const normalizedStatus = normalizeStatus(status);

  if (normalizedResultCode) {
    if (SMS_SUCCESS_RESULT_CODES.has(normalizedResultCode)) return 'success';
    if (!SMS_NEUTRAL_RESULT_CODES.has(normalizedResultCode)) return 'failed';
    if (isSmsFailedStatus(normalizedStatus)) return 'failed';
    return 'pending';
  }

  if (isSmsFailedStatus(normalizedStatus)) return 'failed';

  return 'pending';
}

export function isSmsSuccessResult(input) {
  return getSmsResultState(input) === 'success';
}

export function isSmsFailureResult(input) {
  return getSmsResultState(input) === 'failed';
}

function normalizeResultCode(code) {
  if (code === undefined || code === null) return '';

  return String(code).trim().toUpperCase();
}

function normalizeStatus(status) {
  if (status === undefined || status === null) return '';

  return String(status).trim().toUpperCase();
}

function isSmsFailedStatus(status) {
  return SMS_FAILED_STATUSES.has(status) || Boolean(status && /^[45]/.test(status));
}
