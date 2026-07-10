import { describe, expect, it } from 'vitest';

import {
  transformConsoleHref,
} from '../../features/console/routing.js';
import {
  getSmsBulkSendRunToastView,
} from '../../features/console/messageSend/smsBulkSendRunToast.js';

describe('console navigation href transformation', () => {
  it('keeps app-mode canonical console hrefs unchanged while preserving query strings', () => {
    expect(transformConsoleHref('/message-send?tab=alimtalk', { mode: 'app' })).toBe('/message-send?tab=alimtalk');
    expect(transformConsoleHref('/logs/group-1?channel=sms&page=2', { mode: 'app' })).toBe('/logs/group-1?channel=sms&page=2');
    expect(transformConsoleHref('/reservations/group-1?channel=sms&page=3', { mode: 'app' })).toBe('/reservations/group-1?channel=sms&page=3');
    expect(transformConsoleHref('/settings/sender-resources/sms/new?applicationId=app-1', { mode: 'app' })).toBe(
      '/settings/sender-resources/sms/new?applicationId=app-1'
    );
    expect(transformConsoleHref('/docs', { mode: 'app' })).toBe('/docs');
  });

  it('prefixes registered console hrefs exactly once in Publ embed mode', () => {
    expect(transformConsoleHref('/message-send?tab=alimtalk', { mode: 'embed' })).toBe('/publ-client/message-send?tab=alimtalk');
    expect(transformConsoleHref('/publ-client/message-send?tab=alimtalk', { mode: 'embed' })).toBe(
      '/publ-client/message-send?tab=alimtalk'
    );
    expect(transformConsoleHref('/logs/group-1?channel=sms&page=2', { mode: 'embed' })).toBe(
      '/publ-client/logs/group-1?channel=sms&page=2'
    );
    expect(transformConsoleHref('/reservations/group-1?channel=sms&page=3', { mode: 'embed' })).toBe(
      '/publ-client/reservations/group-1?channel=sms&page=3'
    );
    expect(transformConsoleHref('/settings/sender-resources/kakao/new', { mode: 'embed' })).toBe(
      '/publ-client/settings/sender-resources/kakao/new'
    );
    expect(transformConsoleHref('/docs', { mode: 'embed' })).toBe('/publ-client/docs');
  });

  it('does not rewrite external, API, blob, hash-only, or malformed route hrefs', () => {
    for (const href of [
      'https://example.com/logs',
      'mailto:support@example.com',
      'blob:https://example.com/file',
      '#send-message',
      '/api/message-logs/export?channel=sms',
      '/publ-client/publ-client/logs/group-1',
      '/logs/group%2F1',
      '/unknown',
    ]) {
      expect(transformConsoleHref(href, { mode: 'embed' })).toBe(href);
    }
  });

  it('routes canonical send-result and reservation model hrefs only at the final navigation boundary', () => {
    const logView = getSmsBulkSendRunToastView({
      actions: { logsHref: '/logs?channel=sms&page=2' },
      acceptedRecipientCount: 2,
      channel: 'sms',
      id: 'run-1',
      status: 'completed',
      totalRecipientCount: 2,
    });
    const reservationView = getSmsBulkSendRunToastView({
      actions: { reservationsHref: '/reservations?channel=sms&page=4' },
      acceptedRecipientCount: 2,
      channel: 'sms',
      id: 'run-2',
      isReservation: true,
      status: 'completed',
      totalRecipientCount: 2,
    });

    expect(logView.resultHref).toBe('/logs?channel=sms&page=2');
    expect(reservationView.resultHref).toBe('/reservations?channel=sms&page=4');
    expect(transformConsoleHref(logView.resultHref, { mode: 'embed' })).toBe('/publ-client/logs?channel=sms&page=2');
    expect(transformConsoleHref(reservationView.resultHref, { mode: 'embed' })).toBe(
      '/publ-client/reservations?channel=sms&page=4'
    );
  });
});
