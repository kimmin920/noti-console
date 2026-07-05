import { describe, expect, it, vi } from 'vitest';
import {
  getDeliveryResultToast,
  getMessageStatusPollAttemptCount,
  getReservationAcceptedToast,
  getStatusCheckingToast,
  getStatusLookupErrorToast,
  getStatusTimeoutToast,
  MESSAGE_STATUS_POLL_INTERVAL_MS,
  MESSAGE_STATUS_POLL_TIMEOUT_MS,
  MESSAGE_STATUS_TOAST_ID,
  showMessageStatusResultToast,
  showMessageStatusSubmitToast,
} from '../../features/console/messageSend/statusToast.js';

const SYSTEM_EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe('message status toast polling', () => {
  it('polls every three seconds for at most thirty seconds', () => {
    expect(MESSAGE_STATUS_POLL_INTERVAL_MS).toBe(3000);
    expect(MESSAGE_STATUS_POLL_TIMEOUT_MS).toBe(30000);
    expect(getMessageStatusPollAttemptCount()).toBe(10);
  });

  it('uses the spinner animation while sending and checking status', () => {
    let submitToast = null;
    showMessageStatusSubmitToast((toast) => {
      submitToast = toast;
    }, 'SMS');

    expect(submitToast).toMatchObject({
      animation: 'spinner',
      duration: 0,
      title: 'SMS 전송 중...',
    });
    expect(getStatusCheckingToast('SMS')).toMatchObject({
      animation: 'spinner',
      description: 'NHN 결과를 확인하는 중입니다.',
      duration: 0,
      title: 'SMS 상태 확인 중...',
    });
    expect(getStatusCheckingToast('SMS').description).not.toContain('3초 간격');
    expect(getStatusCheckingToast('SMS').description).not.toContain('최대 30초');
  });

  it('summarizes successful found logs as a success toast', () => {
    const toast = getDeliveryResultToast('SMS', [
      {
        resultCode: 1000,
        status: 3,
      },
    ]);

    expect(toast).toMatchObject({
      id: MESSAGE_STATUS_TOAST_ID,
      variant: 'success',
    });
    expect(toast.description).toContain('SMS 발송 성공');
    expect(toast.description).toContain('1명');
  });

  it('stops with a finite warning toast when provider logs are still missing', () => {
    const toast = getStatusTimeoutToast('SMS');

    expect(toast).toMatchObject({
      duration: 10000,
      id: MESSAGE_STATUS_TOAST_ID,
      variant: 'warning',
    });
    expect(toast.description).toContain('NHN 로그 반영을 아직 확인하지 못했습니다');
  });

  it('renders scheduled sends as accepted reservations without status lookup copy', () => {
    const onViewReservations = vi.fn();
    const toast = getReservationAcceptedToast('SMS', { recipientCount: 3 }, onViewReservations);

    expect(toast).toMatchObject({
      action: {
        label: '예약 보기',
      },
      id: MESSAGE_STATUS_TOAST_ID,
      duration: 5000,
      title: 'SMS 예약 접수됨',
      variant: 'success',
    });
    expect(toast.description).toContain('3명');
    expect(toast.description).not.toContain('NHN 결과');

    toast.action.onClick();

    expect(onViewReservations).toHaveBeenCalledTimes(1);
  });

  it('renders status lookup failures in the message status toast slot', () => {
    const toast = getStatusLookupErrorToast('알림톡');

    expect(toast).toMatchObject({
      id: MESSAGE_STATUS_TOAST_ID,
      title: '알림톡 상태 확인 실패',
      variant: 'critical',
    });
  });

  it('runs the found-status callback after showing the delivery result toast', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        state: 'found',
        logs: [{ resultCode: 1000, status: 3 }],
      },
    }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })));

    try {
      const showToast = vi.fn();
      const onFound = vi.fn();

      showMessageStatusResultToast({
        channelLabel: 'SMS',
        lookup: {
          channel: 'sms',
          senderResourceId: 'sms_resource_1',
          clientRequestId: 'de305d54-75b4-431b-adb2-eb6b9e546014',
        },
        result: { state: 'accepted_by_provider' },
        showToast,
        onFound,
      });
      await vi.advanceTimersByTimeAsync(MESSAGE_STATUS_POLL_INTERVAL_MS);

      expect(fetch).toHaveBeenCalledWith(
        '/api/messages/status?channel=sms&senderResourceId=sms_resource_1&clientRequestId=de305d54-75b4-431b-adb2-eb6b9e546014',
        { cache: 'no-store' }
      );
      expect(onFound).toHaveBeenCalledWith({
        state: 'found',
        logs: [{ resultCode: 1000, status: 3 }],
      });
      expect(showToast).toHaveBeenLastCalledWith(expect.objectContaining({
        id: MESSAGE_STATUS_TOAST_ID,
        title: '발송 성공',
        variant: 'success',
      }));
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('does not run the found-status callback when polling times out unknown', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        state: 'unknown',
        logs: [],
      },
    }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    })));

    try {
      const showToast = vi.fn();
      const onFound = vi.fn();

      showMessageStatusResultToast({
        channelLabel: 'SMS',
        lookup: {
          channel: 'sms',
          senderResourceId: 'sms_resource_1',
          clientRequestId: 'de305d54-75b4-431b-adb2-eb6b9e546014',
        },
        result: { state: 'accepted_by_provider' },
        showToast,
        onFound,
      });
      await vi.advanceTimersByTimeAsync(MESSAGE_STATUS_POLL_TIMEOUT_MS);

      expect(onFound).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenLastCalledWith(expect.objectContaining({
        id: MESSAGE_STATUS_TOAST_ID,
        title: '상태 확인 대기',
        variant: 'warning',
      }));
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('does not render system emoji in message status toast titles', () => {
    const toasts = [
      getDeliveryResultToast('SMS', [{ resultCode: 1000, status: 3 }]),
      getDeliveryResultToast('SMS', [{ resultCode: 2001, status: 4 }]),
      getStatusCheckingToast('SMS'),
      getStatusLookupErrorToast('SMS'),
      getStatusTimeoutToast('SMS'),
    ];

    toasts.forEach((toast) => {
      expect(toast.title).not.toMatch(SYSTEM_EMOJI_PATTERN);
    });
  });
});
