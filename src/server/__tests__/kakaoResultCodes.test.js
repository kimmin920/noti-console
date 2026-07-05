import { describe, expect, it } from 'vitest';

import {
  KAKAO_SUCCESS_RESULT_CODE,
  KAKAO_SUCCESS_RESULT_CODES,
  getKakaoFailureReason,
  getKakaoFailureResultLabel,
  getKakaoResultCodeLabel,
  getKakaoResultState,
  isKakaoFailureResult,
  isKakaoSuccessResult,
} from '../../features/console/messageResults/kakaoResultCodes.js';

describe('Kakao result code classification', () => {
  it('treats Kakao delivery success codes as final success', () => {
    const result = { resultCode: 'mrc01', status: 'FAILED' };

    expect(KAKAO_SUCCESS_RESULT_CODE).toBe('MRC01');
    expect([...KAKAO_SUCCESS_RESULT_CODES].sort()).toEqual(['1000', 'MRC01']);
    expect(getKakaoResultState(result)).toBe('success');
    expect(getKakaoResultState({ resultCode: 1000, status: 'COMPLETED' })).toBe('success');
    expect(isKakaoSuccessResult(result)).toBe(true);
    expect(isKakaoFailureResult(result)).toBe(false);
  });

  it('does not let COMPLETED override a non-success result code', () => {
    const result = { resultCode: '1030', status: 'COMPLETED' };

    expect(getKakaoResultState(result)).toBe('failed');
    expect(isKakaoFailureResult(result)).toBe(true);
    expect(isKakaoSuccessResult(result)).toBe(false);
  });

  it('treats known Kakao message result failure codes as failures', () => {
    expect(getKakaoResultState({ resultCode: 'MRC04', status: 'COMPLETED' })).toBe('failed');
  });

  it('labels NHN Kakao delivery result codes with provider failure reasons', () => {
    expect(getKakaoResultCodeLabel('1030')).toBe('잘못된 파라미터 요청');
    expect(getKakaoFailureReason({ resultCode: '1030', resultMessage: 'FAILED' })).toBe('잘못된 파라미터 요청');
    expect(getKakaoFailureResultLabel({ resultCode: '1030' })).toBe('실패 · 잘못된 파라미터 요청');
    expect(getKakaoFailureResultLabel({ resultCode: 'MRC04' })).toBe('실패 · 코드 MRC04');
    expect(getKakaoFailureReason({ resultCode: '1030', resultMessage: '버튼 파라미터 오류' })).toBe('버튼 파라미터 오류');
  });

  it('does not use completed status as success when there is no final result code yet', () => {
    expect(getKakaoResultState({ resultCode: null, status: 'COMPLETED' })).toBe('pending');
    expect(getKakaoResultState({ resultCode: null, status: 'FAILED' })).toBe('failed');
    expect(getKakaoResultState({ resultCode: null, status: 'READY' })).toBe('pending');
  });

  it('treats API response code zero as neutral rather than delivery success', () => {
    expect(getKakaoResultState({ resultCode: 0, status: 'FAILED' })).toBe('failed');
    expect(getKakaoResultState({ resultCode: 0, status: 'COMPLETED' })).toBe('pending');
    expect(getKakaoResultState({ resultCode: 0, status: '' })).toBe('pending');
  });
});
