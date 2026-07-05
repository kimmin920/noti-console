import { describe, expect, it } from 'vitest';

import {
  getReservationsHrefForChannel,
  getSmsBulkSendRunResultHref,
  shouldShowSmsReservationAcceptedToast,
} from '../../features/console/messageSend/reservationRouting.js';
import { getSmsBulkSendRunToastView } from '../../features/console/messageSend/smsBulkSendRunToast.js';

describe('SMS reservation routing decisions', () => {
  it('finishes accepted direct reservations without entering status polling', () => {
    expect(shouldShowSmsReservationAcceptedToast(
      { requestDate: '2026-06-07 10:00' },
      { state: 'accepted_by_provider' }
    )).toBe(true);
    expect(shouldShowSmsReservationAcceptedToast(
      { requestDate: '2026-06-07 10:00' },
      { state: 'rejected_by_provider' }
    )).toBe(false);
    expect(shouldShowSmsReservationAcceptedToast(
      {},
      { state: 'accepted_by_provider' }
    )).toBe(false);
  });

  it('routes scheduled bulk run completion to reservations', () => {
    const run = {
      actions: {
        logsHref: '/logs?channel=sms',
        reservationsHref: '/reservations?channel=sms',
      },
      channel: 'sms',
      id: 'run_1',
      isReservation: true,
      status: 'completed',
      totalRecipientCount: 2000,
    };

    expect(getReservationsHrefForChannel('mms')).toBe('/reservations?channel=sms');
    expect(getSmsBulkSendRunResultHref(run)).toBe('/reservations?channel=sms');
    expect(getSmsBulkSendRunToastView(run, { formatNumber: String })).toMatchObject({
      actionLabel: '예약 보기',
      description: '2000명 예약 등록 완료',
      resultHref: '/reservations?channel=sms',
      title: 'SMS 예약 등록 완료',
      variant: 'success',
    });
  });

  it('keeps immediate bulk run completion linked to logs', () => {
    const run = {
      actions: {
        logsHref: '/logs?channel=sms',
      },
      channel: 'sms',
      id: 'run_2',
      status: 'completed',
      totalRecipientCount: 2000,
    };

    expect(getSmsBulkSendRunResultHref(run)).toBe('/logs?channel=sms');
    expect(getSmsBulkSendRunToastView(run, { formatNumber: String })).toMatchObject({
      actionLabel: '발송 결과 보기',
      resultHref: '/logs?channel=sms',
      title: 'SMS 발송 요청 접수 완료',
    });
  });

  it('labels scheduled bulk progress as NHN reservation registration', () => {
    const run = {
      acceptedRecipientCount: 1000,
      channel: 'sms',
      id: 'run_3',
      requestDate: '2026-06-07 10:00',
      status: 'running',
      totalRecipientCount: 2000,
    };

    expect(getSmsBulkSendRunToastView(run, { formatNumber: String })).toMatchObject({
      animation: 'spinner',
      description: '1000 / 2000명 NHN 예약 등록',
      title: 'SMS 예약 등록 중',
    });
  });
});
