export const KAKAO_SUCCESS_RESULT_CODE = 'MRC01';
export const KAKAO_SUCCESS_RESULT_CODES = new Set([KAKAO_SUCCESS_RESULT_CODE, '1000']);

const KAKAO_NEUTRAL_RESULT_CODES = new Set(['0']);
const KAKAO_FAILED_STATUSES = new Set(['4', '5', 'FAILED', 'FAIL', 'CANCELED', 'CANCELLED', 'ERROR']);
const KAKAO_GENERIC_RESULT_MESSAGES = new Set(['FAILED', 'FAIL', 'SUCCESS']);
const KAKAO_RESULT_CODE_LABELS = new Map([
  ['1000', '성공'],
  ['1001', 'Request Body가 JSON 형식이 아님'],
  ['1002', '허브 파트너 키가 유효하지 않음'],
  ['1003', '발신 프로필 키가 유효하지 않음'],
  ['1020', '전화번호 또는 app user id가 유효하지 않거나 누락됨'],
  ['1021', '차단 상태의 카카오톡 채널'],
  ['1022', '닫힘 상태의 카카오톡 채널'],
  ['1023', '삭제된 카카오톡 채널'],
  ['1025', '채널 제재 상태로 인한 메시지 전송 실패'],
  ['1030', '잘못된 파라미터 요청'],
  ['1033', '템플릿 메시지 타입과 chat_bubble_type 파라미터 불일치'],
  ['2001', '메시지 전송 불가'],
  ['3000', '예기치 않은 오류 발생'],
  ['3005', '수신 확인 안 됨'],
  ['3006', '내부 시스템 오류로 메시지 전송 실패'],
  ['3008', '전화번호 오류'],
  ['3012', '카카오 통신 실패'],
  ['3013', '메시지가 비어 있음'],
  ['3014', '메시지 길이 제한 오류'],
  ['3015', '템플릿을 찾을 수 없음'],
  ['3016', '메시지 내용이 템플릿과 일치하지 않음'],
  ['3018', '메시지를 전송할 수 없음'],
  ['3019', '카카오톡 유저가 아님'],
  ['3020', '알림톡 수신 차단'],
  ['3021', '카카오톡 최소 버전 미지원'],
  ['3022', '발송 가능한 시간이 아님'],
  ['3023', '메시지 문법 오류'],
  ['3024', '이미지 주소 또는 규격 오류'],
  ['3025', '변수 글자 수 제한 초과'],
  ['3027', '메시지 버튼/바로연결이 템플릿과 일치하지 않음'],
  ['3028', '메시지 강조 표기 타이틀이 템플릿과 일치하지 않음'],
  ['3030', '메시지 타입과 템플릿 강조 타입이 일치하지 않음'],
  ['3031', '헤더가 템플릿과 일치하지 않음'],
  ['3033', '아이템 하이라이트가 템플릿과 일치하지 않음'],
  ['3036', '아이템 리스트가 템플릿과 일치하지 않음'],
  ['3042', '대표 링크가 템플릿과 일치하지 않음'],
  ['3043', '이미지 변수 개수 템플릿 불일치'],
  ['3044', '쿠폰 변수 템플릿 불일치'],
  ['3045', '커머스 정보 변수 템플릿 불일치'],
  ['3053', '캐러셀 템플릿 불일치'],
  ['3054', '캐러셀 버튼 템플릿 불일치'],
  ['3055', '캐러셀 쿠폰 템플릿 불일치'],
  ['4000', '메시지 전송 결과를 찾을 수 없음'],
  ['4001', '알 수 없는 메시지 상태'],
  ['4100', 'requestId 오류'],
  ['4101', '요청 날짜 오류'],
  ['4102', 'Template 요청 오류'],
  ['4103', '유효한 허브 파트너를 찾을 수 없음'],
  ['4104', '유효한 발신 프로필을 찾을 수 없음'],
  ['4110', '유효하지 않은 챗버블 타입 또는 메시지 타입 요청'],
]);

export function getKakaoResultState({ resultCode, status } = {}) {
  const normalizedResultCode = normalizeResultCode(resultCode);
  const normalizedStatus = normalizeStatus(status);

  if (normalizedResultCode) {
    if (KAKAO_SUCCESS_RESULT_CODES.has(normalizedResultCode)) return 'success';
    if (!KAKAO_NEUTRAL_RESULT_CODES.has(normalizedResultCode)) return 'failed';
    if (isKakaoFailedStatus(normalizedStatus)) return 'failed';
    return 'pending';
  }

  if (isKakaoFailedStatus(normalizedStatus)) return 'failed';

  return 'pending';
}

export function isKakaoSuccessResult(input) {
  return getKakaoResultState(input) === 'success';
}

export function isKakaoFailureResult(input) {
  return getKakaoResultState(input) === 'failed';
}

export function getKakaoResultCodeLabel(resultCode) {
  const normalizedResultCode = normalizeResultCode(resultCode);
  if (!normalizedResultCode) return '';

  return KAKAO_RESULT_CODE_LABELS.get(normalizedResultCode) || `코드 ${normalizedResultCode}`;
}

export function getKakaoFailureReason({ resultCode, resultMessage } = {}) {
  const normalizedMessage = normalizeResultMessage(resultMessage);
  if (normalizedMessage) return normalizedMessage;

  return getKakaoResultCodeLabel(resultCode);
}

export function getKakaoFailureResultLabel(input = {}) {
  const reason = getKakaoFailureReason(input);
  return reason ? `실패 · ${reason}` : '실패';
}

function normalizeResultCode(value) {
  if (value === undefined || value === null) return '';

  return String(value).trim().toUpperCase();
}

function normalizeStatus(value) {
  if (value === undefined || value === null) return '';

  return String(value).trim().toUpperCase();
}

function isKakaoFailedStatus(status) {
  return KAKAO_FAILED_STATUSES.has(status) || Boolean(status && /^[45]/.test(status));
}

function normalizeResultMessage(value) {
  if (value === undefined || value === null) return '';

  const message = String(value).trim();
  if (!message) return '';

  return KAKAO_GENERIC_RESULT_MESSAGES.has(message.toUpperCase()) ? '' : message;
}
