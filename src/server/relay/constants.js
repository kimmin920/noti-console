export const PROVIDERS = Object.freeze({
  NHN: 'nhn',
});

export const CHANNELS = Object.freeze({
  ALIMTALK: 'alimtalk',
  BRAND_MESSAGE: 'brand-message',
  SMS: 'sms',
  LMS: 'lms',
  MMS: 'mms',
});

export const SENDER_RESOURCE_TYPES = Object.freeze({
  SMS_SEND_NO: 'sms_send_no',
  KAKAO_SENDER_KEY: 'kakao_sender_key',
});

export const DEFAULT_SENDER_RESOURCE_QUOTA_LIMIT = 1000;

export const NHN_PRODUCTS = Object.freeze({
  SMS: 'sms',
  KAKAO_BIZMESSAGE: 'kakao_bizmessage',
});

export const NHN_API_VERSIONS = Object.freeze({
  SMS: 'v3.0',
  KAKAO_BIZMESSAGE: 'v2.3',
  BRAND_MESSAGE: 'v1.0',
});

export const NHN_DIRECT_API_BASE_URLS = Object.freeze({
  SMS: 'https://sms.api.nhncloudservice.com',
  KAKAO_BIZMESSAGE: 'https://kakaotalk-bizmessage.api.nhncloudservice.com',
});

export const NHN_PROVIDER_IDEMPOTENCY = Object.freeze({
  [CHANNELS.ALIMTALK]: true,
  [CHANNELS.BRAND_MESSAGE]: true,
  [CHANNELS.SMS]: false,
  [CHANNELS.LMS]: false,
  [CHANNELS.MMS]: false,
});

export const SMS_GROUPING_KEY_MAX_LENGTH = 100;

export const SEND_RESPONSE_STATES = Object.freeze({
  ACCEPTED_BY_PROVIDER: 'accepted_by_provider',
  REJECTED_BY_PROVIDER: 'rejected_by_provider',
  UNKNOWN_AFTER_PROVIDER_CALL: 'unknown_after_provider_call',
  LOCAL_VALIDATION_FAILED: 'local_validation_failed',
});

export const RELAY_ERROR_CODES = Object.freeze({
  LOCAL_VALIDATION_FAILED: 'LOCAL_VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  PROVIDER_REJECTED: 'PROVIDER_REJECTED',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  RELAY_CONFIG_ERROR: 'RELAY_CONFIG_ERROR',
  SENDER_RESOURCE_QUOTA_EXCEEDED: 'SENDER_RESOURCE_QUOTA_EXCEEDED',
  UNKNOWN_AFTER_PROVIDER_CALL: 'UNKNOWN_AFTER_PROVIDER_CALL',
});
