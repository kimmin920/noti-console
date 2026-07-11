import { describe, expect, it } from 'vitest';

import { getPublRecipientSourceState } from '../../features/publClient/usePublMessageRecipients.js';

describe('Publ recipient source state', () => {
  it('returns permission-denied when contact permission is missing or denied', () => {
    expect(getPublRecipientSourceState({
      configured: false,
      query: { isError: false, isPending: false },
    })).toBe('permission-denied');

    expect(getPublRecipientSourceState({
      configured: true,
      query: { error: { code: 'permission-denied' }, isError: true },
    })).toBe('permission-denied');
  });

  it('keeps loading, error, empty, and ready distinct', () => {
    expect(getPublRecipientSourceState({
      configured: true,
      query: { fetchStatus: 'fetching', isPending: true },
    })).toBe('loading');

    expect(getPublRecipientSourceState({
      configured: true,
      query: { fetchStatus: 'idle', isPending: true },
    })).toBe('empty');

    expect(getPublRecipientSourceState({
      configured: true,
      query: { isError: true },
    })).toBe('error');

    expect(getPublRecipientSourceState({
      configured: true,
      query: { isError: false, isPending: false },
    })).toBe('empty');

    expect(getPublRecipientSourceState({
      configured: true,
      contacts: [{ type: 'publ-contact', value: '01012345678' }],
      query: { isError: false, isPending: false },
    })).toBe('ready');
  });
});
