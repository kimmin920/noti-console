import { describe, expect, it } from 'vitest';

import {
  AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV,
  AUTOMATION_EVENT_PAYLOAD_VERSION,
  decryptAutomationEventPayload,
  encryptAutomationEventPayload,
  hashTargetRef,
  maskPhoneNumber,
  resolveAutomationPayloadVaultConfig,
} from '../automations/payloadVault.js';

const TEST_KEY = Buffer.from('0123456789abcdef0123456789abcdef');
const OTHER_TEST_KEY = Buffer.from('abcdef0123456789abcdef0123456789');
const TEST_KEY_BASE64 = TEST_KEY.toString('base64');

describe('automation payload vault', () => {
  it('encrypts and decrypts JSON-compatible event payloads with an injected key', () => {
    const payload = {
      eventKey: 'order.created',
      orderId: 'order_123',
      targetPhoneNumber: '01012345678',
      nested: {
        amount: 12000,
      },
    };

    const encrypted = encryptAutomationEventPayload(payload, { key: TEST_KEY });
    const serializedEncrypted = JSON.stringify(encrypted);

    expect(encrypted).toMatchObject({
      eventPayloadVersion: AUTOMATION_EVENT_PAYLOAD_VERSION,
      eventPayloadCiphertext: expect.any(String),
      eventPayloadIv: expect.any(String),
      eventPayloadTag: expect.any(String),
    });
    expect(serializedEncrypted).not.toContain('order_123');
    expect(serializedEncrypted).not.toContain('01012345678');
    expect(decryptAutomationEventPayload(encrypted, { key: TEST_KEY })).toEqual(payload);
  });

  it('fails safely when decrypting with a different key', () => {
    const payload = {
      externalEventId: 'evt_123',
      targetPhoneNumber: '01012345678',
    };
    const encrypted = encryptAutomationEventPayload(payload, { key: TEST_KEY });

    expect(() => decryptAutomationEventPayload(encrypted, { key: OTHER_TEST_KEY }))
      .toThrow('Automation event payload could not be decrypted.');

    try {
      decryptAutomationEventPayload(encrypted, { key: OTHER_TEST_KEY });
    } catch (error) {
      expect(error.message).not.toContain('evt_123');
      expect(error.message).not.toContain('01012345678');
    }
  });

  it('rejects missing or invalid encryption keys with safe configuration errors', () => {
    expect(() => resolveAutomationPayloadVaultConfig({})).toThrow(
      `${AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV} is required.`
    );
    expect(() => resolveAutomationPayloadVaultConfig({
      [AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV]: Buffer.alloc(16).toString('base64'),
    })).toThrow(`${AUTOMATION_EVENT_DATA_ENCRYPTION_KEY_ENV} must be a base64-encoded 32-byte key.`);
  });

  it('masks phone numbers without exposing the full value', () => {
    const masked = maskPhoneNumber('010-1234-5678');

    expect(masked).toBe('010****5678');
    expect(masked).not.toContain('1234');
    expect(masked).not.toBe('01012345678');
  });

  it('computes deterministic target hashes with an injected server-only key', () => {
    const firstHash = hashTargetRef('010-1234-5678', { key: TEST_KEY_BASE64 });
    const secondHash = hashTargetRef('01012345678', { key: TEST_KEY_BASE64 });

    expect(firstHash).toBe(secondHash);
    expect(firstHash).not.toContain('01012345678');
    expect(firstHash).toHaveLength(43);
  });
});
