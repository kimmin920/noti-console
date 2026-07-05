import { describe, expect, it } from 'vitest';

import {
  SMS_SUCCESS_RESULT_CODE,
  SMS_SUCCESS_RESULT_CODES,
  getSmsResultCodeLabel,
  getSmsResultState,
  isSmsFailureResult,
  isSmsSuccessResult,
  isSmsSuccessResultCode,
} from '../../features/console/messageResults/smsResultCodes.js';

describe('SMS result code labels', () => {
  it('labels the delivery success code', () => {
    expect(SMS_SUCCESS_RESULT_CODE).toBe('1000');
    expect([...SMS_SUCCESS_RESULT_CODES]).toEqual(['1000']);
    expect(getSmsResultCodeLabel('1000')).toBe('성공');
    expect(isSmsSuccessResultCode(1000)).toBe(true);
    expect(getSmsResultState({ resultCode: 1000, status: 'FAILED' })).toBe('success');
    expect(isSmsSuccessResult({ resultCode: 1000 })).toBe(true);
  });

  it('labels verified delivery failure codes', () => {
    expect(getSmsResultCodeLabel('2000')).toBe('전송 시간 초과');
    expect(getSmsResultCodeLabel(3003)).toBe('수신 번호 오류 또는 결번');
    expect(getSmsResultCodeLabel('e915')).toBe('중복 메시지');
  });

  it('falls back safely for unknown result codes', () => {
    expect(getSmsResultCodeLabel('9876')).toBe('코드 9876');
    expect(getSmsResultCodeLabel('')).toBe('');
    expect(getSmsResultCodeLabel(null)).toBe('');
    expect(isSmsSuccessResultCode('9876')).toBe(false);
  });

  it('does not treat API response result code zero as delivery success', () => {
    expect(getSmsResultCodeLabel(0)).toBe('코드 0');
    expect(isSmsSuccessResultCode(0)).toBe(false);
    expect(getSmsResultState({ resultCode: 0, status: 'COMPLETED' })).toBe('pending');
    expect(getSmsResultState({ resultCode: 0, status: 'FAILED' })).toBe('failed');
  });

  it('does not let completed status override a non-success result code', () => {
    const result = { resultCode: '3003', status: 'COMPLETED' };

    expect(getSmsResultState(result)).toBe('failed');
    expect(isSmsFailureResult(result)).toBe(true);
    expect(isSmsSuccessResult(result)).toBe(false);
  });

  it('does not use completed status as success when there is no final result code yet', () => {
    expect(getSmsResultState({ resultCode: null, status: '3' })).toBe('pending');
    expect(getSmsResultState({ resultCode: null, status: 'COMPLETED' })).toBe('pending');
    expect(getSmsResultState({ resultCode: null, status: 'FAILED_AD' })).toBe('failed');
    expect(getSmsResultState({ resultCode: null, status: 'READY' })).toBe('pending');
  });
});
