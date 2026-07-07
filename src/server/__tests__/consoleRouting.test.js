import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONSOLE_PAGE_ID,
  getConsolePageIdFromPathname,
} from '../../features/console/routing.js';

describe('console route helpers', () => {
  it('maps stable console URLs to page ids', () => {
    expect(getConsolePageIdFromPathname('/message-send')).toBe(DEFAULT_CONSOLE_PAGE_ID);
    expect(getConsolePageIdFromPathname('/automations')).toBe('automations');
    expect(getConsolePageIdFromPathname('/automations/new')).toBe('automations-new');
    expect(getConsolePageIdFromPathname('/automations/rule-1')).toBe('automations-detail');
    expect(getConsolePageIdFromPathname('/automations/rule-1/edit')).toBe('automations-edit');
    expect(getConsolePageIdFromPathname('/automations/publ-events/new')).toBe('publ-event-new');
    expect(getConsolePageIdFromPathname('/automations/publ-events/order-created')).toBe('publ-event-detail');
    expect(getConsolePageIdFromPathname('/templates')).toBe('templates');
    expect(getConsolePageIdFromPathname('/templates/sms/new')).toBe('templates-sms-new');
    expect(getConsolePageIdFromPathname('/templates/alimtalk/new')).toBe('templates-alimtalk-new');
    expect(getConsolePageIdFromPathname('/templates/brand/new')).toBe('templates-brand-new');
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
});
