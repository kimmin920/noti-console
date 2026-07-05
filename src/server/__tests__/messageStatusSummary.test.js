import { describe, expect, it } from 'vitest';

import { getMessageDeliverySummary } from '../../features/console/messageSend/statusSummary.js';

describe('message delivery status summary', () => {
  it('reports SMS delivery success when every NHN row has a success result code', () => {
    const summary = getMessageDeliverySummary('SMS', [
      {
        channel: 'sms',
        resultCode: 1000,
        resultMessage: 'SUCCESS',
        status: '3',
      },
    ]);

    expect(summary).toEqual({
      text: 'SMS 발송 성공: 1명에게 도달했습니다.',
      tone: 'success',
    });
  });

  it('reports SMS failures with the verified result-code label', () => {
    const summary = getMessageDeliverySummary('SMS', [
      {
        channel: 'sms',
        resultCode: '2000',
        resultMessage: '원문 제공사 메시지',
        status: '4',
      },
    ]);

    expect(summary).toEqual({
      text: 'SMS 발송 실패: 1명 중 1명 실패했습니다. 전송 시간 초과',
      tone: 'critical',
    });
  });

  it('falls back to the SMS result code when the failure code is unknown', () => {
    const summary = getMessageDeliverySummary('SMS', [
      {
        channel: 'sms',
        resultCode: '9876',
        status: '4',
      },
    ]);

    expect(summary).toEqual({
      text: 'SMS 발송 실패: 1명 중 1명 실패했습니다. 코드 9876',
      tone: 'critical',
    });
  });

  it('summarizes mixed SMS delivery results', () => {
    const summary = getMessageDeliverySummary('SMS', [
      { channel: 'sms', resultCode: '1000', status: '3' },
      { channel: 'sms', resultCode: '2000', resultMessage: '실패', status: '4' },
      { channel: 'sms', resultCode: null, status: '2' },
    ]);

    expect(summary).toEqual({
      text: 'SMS 발송 결과: 성공 1명, 실패 1명, 처리 중 1명',
      tone: 'warning',
    });
  });

  it('reports Kakao completed rows with non-success result codes as failures', () => {
    const summary = getMessageDeliverySummary('알림톡', [
      {
        channel: 'alimtalk',
        resultCode: '1030',
        status: 'COMPLETED',
      },
    ]);

    expect(summary).toEqual({
      text: '알림톡 발송 실패: 1명 중 1명 실패했습니다. 잘못된 파라미터 요청',
      tone: 'critical',
    });
  });

  it('does not report completed rows without result codes as successful', () => {
    expect(getMessageDeliverySummary('SMS', [
      {
        channel: 'sms',
        resultCode: null,
        status: 'COMPLETED',
      },
    ])).toEqual({
      text: 'SMS 발송 결과: 처리 중 1명',
      tone: 'neutral',
    });

    expect(getMessageDeliverySummary('알림톡', [
      {
        channel: 'alimtalk',
        resultCode: null,
        status: 'COMPLETED',
      },
    ])).toEqual({
      text: '알림톡 발송 결과: 처리 중 1명',
      tone: 'neutral',
    });
  });
});
