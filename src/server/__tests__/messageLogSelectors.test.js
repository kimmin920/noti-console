import { describe, expect, it } from 'vitest';

import {
  MESSAGE_LOG_CHANNEL_OPTIONS,
  formatMessageLogGroupCounts,
  getMessageLogFiltersFromSearchParams,
  getMessageLogFailureReason,
  getMessageLogFailureResultLabel,
  getMessageLogGroupKindLabel,
  getMessageLogGroupResultSummary,
  getMessageLogGroupSentAt,
  getMessageLogGroupSourceDetailItems,
  getMessageLogGroupSourceLabel,
  getMessageLogGroupStatus,
  getMessageLogResultLabel,
  getMessageLogStatus,
  toMessageLogQueryParams,
} from '../../features/console/messageLogs/selectors.js';

describe('message log selectors', () => {
  it('shows the recipient number for a single-recipient group', () => {
    expect(formatMessageLogGroupCounts({
      recipientCount: 1,
      representativeRecipientNo: '01012345678',
      successCount: 1,
    })).toBe('01012345678');
  });

  it('shows only the recipient count for multi-recipient groups', () => {
    expect(formatMessageLogGroupCounts({
      failedCount: 2,
      pendingCount: 3,
      recipientCount: 1200,
      successCount: 1195,
    })).toBe('1,200명');
  });

  it('covers the webhook-first primary display status contract', () => {
    const cases = [
      [
        '접수 중',
        { pendingCount: 100, providerState: 'queued', resultState: 'not_synced' },
      ],
      [
        '접수 완료 · 결과 집계 중',
        { pendingCount: 100, providerState: 'accepted', resultState: 'not_synced' },
      ],
      [
        '접수 일부 실패 · 결과 집계 중',
        { failedCount: 1, pendingCount: 89, providerState: 'partial', resultState: 'partially_synced', successCount: 10 },
      ],
      [
        '완료 · 성공',
        { failedCount: 0, pendingCount: 0, providerState: 'accepted', resultState: 'synced', successCount: 100 },
      ],
      [
        '완료 · 일부 실패',
        { failedCount: 10, pendingCount: 0, providerState: 'accepted', resultState: 'synced', successCount: 90 },
      ],
      [
        '집계 마감 · 일부 미확인',
        {
          failedCount: 10,
          pendingCount: 10,
          providerState: 'accepted',
          resultFinalizedAt: '2026-06-09T08:00:00.000Z',
          resultState: 'stale',
          successCount: 80,
        },
      ],
    ];

    expect(cases.map(([, group]) => getMessageLogGroupStatus(group).label)).toEqual(
      cases.map(([label]) => label)
    );
  });

  it('keeps pending result summaries numeric without implying final zero-success', () => {
    expect(getMessageLogGroupResultSummary({
      pendingCount: 1000,
      providerState: 'accepted',
      resultState: 'not_synced',
    })).toBe('성공 0 · 실패 0 · 미확인 1,000');
  });

  it('summarizes terminal counts with success rate', () => {
    expect(getMessageLogGroupResultSummary({
      canceledCount: 1,
      failedCount: 3,
      pendingCount: 0,
      resultState: 'synced',
      successCount: 992,
    })).toBe('성공 992 · 실패 4 · 성공률 99.6%');
  });

  it('summarizes finalized unresolved counts as unknown instead of stale state names', () => {
    expect(getMessageLogGroupResultSummary({
      failedCount: 10,
      pendingCount: 10,
      resultFinalizedAt: '2026-06-09T08:00:00.000Z',
      resultState: 'stale',
      successCount: 80,
    })).toBe('성공 80 · 실패 10 · 미확인 10');
  });

  it('preserves the development demo case query flag', () => {
    const filters = getMessageLogFiltersFromSearchParams(
      new URLSearchParams('demo=cases&channel=sms&from=2026-06-01&to=2026-06-02'),
      new Date('2026-06-09T00:00:00.000Z')
    );

    expect(filters.demoCases).toBe(true);
    expect(toMessageLogQueryParams(filters)).toMatchObject({
      channel: 'sms',
      demo: 'cases',
    });
  });

  it('does not expose an all channel tab', () => {
    expect(MESSAGE_LOG_CHANNEL_OPTIONS.map((option) => option.value)).toEqual([
      'sms',
      'alimtalk',
      'brand-message',
    ]);
  });

  it('uses the best available sent time for grouped log rows', () => {
    expect(getMessageLogGroupSentAt({
      createdAt: '2026-06-09T06:00:00.000Z',
      requestDate: '2026-06-09T06:10:00.000Z',
      scheduledAt: '2026-06-09T06:05:00.000Z',
    })).toBe('2026-06-09T06:10:00.000Z');
    expect(getMessageLogGroupSentAt({
      createdAt: '2026-06-09T06:00:00.000Z',
      scheduledAt: '2026-06-09T06:05:00.000Z',
    })).toBe('2026-06-09T06:05:00.000Z');
    expect(getMessageLogGroupSentAt({
      createdAt: '2026-06-09T06:00:00.000Z',
    })).toBe('2026-06-09T06:00:00.000Z');
  });

  it('separates send source labels from existing send kind labels', () => {
    const automationGroup = {
      sendKind: 'bulk',
      sendTiming: 'scheduled',
      source: {
        type: 'automation',
        label: '자동화',
        eventKey: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER',
        externalEventId: 'event-1',
        channelCode: 'publ-demo-vvee-001',
        automationRuleId: 'rule-1',
        automationDeliveryId: 'delivery-1',
      },
    };

    expect(getMessageLogGroupSourceLabel(automationGroup)).toBe('자동화');
    expect(getMessageLogGroupSourceDetailItems(automationGroup)).toEqual([
      { label: '이벤트 키', value: 'MEMBER_GENERAL_CHANNEL_ACCOUNT_REGISTER' },
      { label: '외부 이벤트 ID', value: 'event-1' },
      { label: '채널 코드', value: 'publ-demo-vvee-001' },
      { label: '자동화 Rule ID', value: 'rule-1' },
      { label: '자동화 Delivery ID', value: 'delivery-1' },
    ]);
    expect(getMessageLogGroupKindLabel(automationGroup)).toBe('예약');
    expect(getMessageLogGroupKindLabel({ sendKind: 'bulk' })).toBe('대량');
    expect(getMessageLogGroupSourceLabel({})).toBe('직접 발송');
    expect(getMessageLogGroupSourceDetailItems({ source: { type: 'manual', label: '직접 발송' } })).toEqual([]);
  });

  it('labels SMS recipient result codes without raw provider messages', () => {
    expect(getMessageLogResultLabel({
      channel: 'sms',
      resultCode: '1000',
      resultMessage: 'SUCCESS',
      status: '3',
    })).toBe('성공');
    expect(getMessageLogResultLabel({
      channel: 'sms',
      resultCode: '3003',
      resultMessage: '원문 제공사 메시지',
      status: '4',
    })).toBe('실패 · 수신 번호 오류 또는 결번');
    expect(getMessageLogResultLabel({
      channel: 'sms',
      resultCode: '9876',
      status: '4',
    })).toBe('실패 · 코드 9876');
    expect(getMessageLogResultLabel({
      channel: 'sms',
      resultCode: null,
      status: '4',
    })).toBe('실패');
  });

  it('treats Kakao completed rows with non-success result codes as failures', () => {
    const log = {
      channel: 'alimtalk',
      resultCode: '1030',
      status: 'COMPLETED',
    };

    expect(getMessageLogStatus(log)).toMatchObject({
      label: '실패',
      state: 'failed',
    });
    expect(getMessageLogResultLabel(log)).toBe('실패 · 잘못된 파라미터 요청');
    expect(getMessageLogFailureReason(log)).toBe('잘못된 파라미터 요청');
  });

  it('keeps completed rows without result codes pending', () => {
    const smsLog = {
      channel: 'sms',
      resultCode: null,
      status: 'COMPLETED',
    };
    const kakaoLog = {
      channel: 'alimtalk',
      resultCode: null,
      status: 'COMPLETED',
    };

    expect(getMessageLogStatus(smsLog)).toMatchObject({
      label: '처리 중',
      state: 'pending',
    });
    expect(getMessageLogResultLabel(smsLog)).toBe('-');
    expect(getMessageLogStatus(kakaoLog)).toMatchObject({
      label: '처리 중',
      state: 'pending',
    });
    expect(getMessageLogResultLabel(kakaoLog)).toBe('-');
  });

  it('labels snapshot failure rows with known labels and unknown fallbacks', () => {
    expect(getMessageLogFailureResultLabel({
      resultCode: '3003',
      resultCodeLabel: '실패 · 수신 번호 오류 또는 결번',
    })).toBe('실패 · 수신 번호 오류 또는 결번');
    expect(getMessageLogFailureResultLabel({
      channel: 'alimtalk',
      resultCode: '1030',
    })).toBe('실패 · 잘못된 파라미터 요청');
    expect(getMessageLogFailureResultLabel({ resultCode: '9876' })).toBe('실패 · 코드 9876');
    expect(getMessageLogFailureResultLabel({ resultCode: null })).toBe('실패');
  });
});
