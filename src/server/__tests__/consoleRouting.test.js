import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONSOLE_PAGE_ID,
  buildConsolePath,
  buildPublClientPath,
  getConsolePageIdFromPathname,
  matchConsolePath,
  matchPublClientPath,
} from '../../features/console/routing.js';

describe('console route helpers', () => {
  const routeCases = [
    ['message send', DEFAULT_CONSOLE_PAGE_ID, {}, '/message-send', {}],
    ['automations list', 'automations', {}, '/automations', {}],
    ['automations new', 'automations-new', {}, '/automations/new', {}],
    ['automations detail', 'automations-detail', { ruleId: 'rule 1' }, '/automations/rule%201', { automationDetail: { ruleId: 'rule 1' } }],
    ['automations edit', 'automations-edit', { ruleId: 'rule 1' }, '/automations/rule%201/edit', { automationDetail: { ruleId: 'rule 1' } }],
    ['Publ event new', 'publ-event-new', {}, '/automations/publ-events/new', {}],
    ['Publ event detail', 'publ-event-detail', { eventKey: 'order.created' }, '/automations/publ-events/order.created', { publEventDetail: { eventKey: 'order.created' } }],
    ['templates list', 'templates', {}, '/templates', {}],
    ['SMS template new', 'templates-sms-new', {}, '/templates/sms/new', {}],
    ['AlimTalk template new', 'templates-alimtalk-new', {}, '/templates/alimtalk/new', {}],
    ['Brand template new', 'templates-brand-new', {}, '/templates/brand/new', {}],
    ['template detail', 'templates-detail', { channel: 'sms', templateCode: 'welcome 1' }, '/templates/sms/welcome%201', { templateDetail: { channel: 'sms', templateCode: 'welcome 1', query: {} } }],
    ['audience', 'audience', {}, '/audience', {}],
    ['metrics', 'metrics', {}, '/metrics', {}],
    ['reservations list', 'reservations', {}, '/reservations', {}],
    ['reservation detail', 'reservation-detail', { groupId: 'group 1' }, '/reservations/group%201', { reservationDetail: { groupId: 'group 1' } }],
    ['logs list', 'logs', {}, '/logs', {}],
    ['log detail', 'log-detail', { groupId: 'group 1' }, '/logs/group%201', { logDetail: { groupId: 'group 1' } }],
    ['settings', 'settings', {}, '/settings', {}],
    ['SMS sender setup', 'settings-sender-sms-new', {}, '/settings/sender-resources/sms/new', {}],
    ['Kakao sender setup', 'settings-sender-kakao-new', {}, '/settings/sender-resources/kakao/new', {}],
    ['docs', 'docs', {}, '/docs', {}],
    ['operator admin', 'admin-sender-resource-applications', {}, '/admin/sender-resource-applications', {}],
  ];

  it.each(routeCases)('builds and matches %s', (_, pageId, params, pathname, pageProps) => {
    expect(buildConsolePath({ pageId, params })).toBe(pathname);
    expect(matchConsolePath(`${pathname}?channel=sms&page=2`)).toEqual({
      canonicalPathname: pathname,
      ok: true,
      pageId,
      pageProps,
      queryString: 'channel=sms&page=2',
    });
    expect(matchPublClientPath(`/publ-client${pathname}?channel=sms&page=2`)).toEqual({
      canonicalPathname: pathname,
      ok: true,
      pageId,
      pageProps,
      queryString: 'channel=sms&page=2',
    });
    expect(buildPublClientPath({ pageId, params, queryString: 'channel=sms&page=2' })).toBe(
      `/publ-client${pathname}?channel=sms&page=2`
    );
  });

  it('maps stable console URLs to page ids through the descriptor registry', () => {
    expect(getConsolePageIdFromPathname('/message-send')).toBe(DEFAULT_CONSOLE_PAGE_ID);
    expect(getConsolePageIdFromPathname('/automations')).toBe('automations');
    expect(getConsolePageIdFromPathname('/templates/sms/welcome')).toBe('templates-detail');
    expect(getConsolePageIdFromPathname('/settings/sender-resources/sms/new')).toBe('settings-sender-sms-new');
    expect(getConsolePageIdFromPathname('/admin/sender-resource-applications')).toBe('admin-sender-resource-applications');
  });

  it('leaves non-console URLs outside the persistent shell', () => {
    expect(getConsolePageIdFromPathname('/')).toBeNull();
    expect(getConsolePageIdFromPathname('/publ-client')).toBeNull();
    expect(getConsolePageIdFromPathname('/sign-in')).toBeNull();
    expect(getConsolePageIdFromPathname('/api/message-logs')).toBeNull();
  });

  it('rejects malformed dynamic routes instead of falling back', () => {
    expect(matchPublClientPath('/publ-client/logs/group-1/extra')).toMatchObject({ ok: false });
    expect(matchPublClientPath('/publ-client/publ-client/logs/group-1')).toMatchObject({ ok: false });
    expect(matchPublClientPath('/publ-client/logs/group%2F1')).toMatchObject({ ok: false });
    expect(matchPublClientPath('/publ-client/logs/group%5C1')).toMatchObject({ ok: false });
    expect(matchPublClientPath('/publ-client/https:%2F%2Fevil.example')).toMatchObject({ ok: false });
  });
});
