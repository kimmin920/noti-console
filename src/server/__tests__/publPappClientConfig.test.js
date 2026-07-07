import { describe, expect, it } from 'vitest';

import {
  PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS,
  PUBL_PAPP_CLIENT_ENV,
  PUBL_PAPP_CLIENT_STAGES,
  resolvePublPappClientConfig,
  resolvePublPappClientConfigResult,
} from '../publPapp/clientConfig.js';

describe('Publ PApp client runtime config', () => {
  it('resolves TEST client-visible values without exposing server secrets', () => {
    const config = resolvePublPappClientConfig({
      PUBL_PAPP_CLIENT_STAGE: 'test',
      PUBL_PAPP_TEST_CLIENT_HASH: ' test-client-hash ',
      PUBL_PAPP_TEST_MEMBER_CONTACTS_PERMISSION_ID: 'PM_TEST_CONTACTS',
      PUBL_PAPP_TEST_OUTGOING_API_KEY: 'must-not-leak',
      PUBL_PAPP_TEST_OUTGOING_SECRET_KEY: 'must-not-leak-secret',
    });

    expect(config).toMatchObject({
      clientHash: 'test-client-hash',
      pAppCode: '3RD_A00003_TEST',
      sdkSrc: '/vendor/publ-p-app-client-sdk.testflight.js',
      stage: PUBL_PAPP_CLIENT_STAGES.TEST,
    });
    expect(config.permissions.exchangeToken).toBe(
      PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.EXCHANGE_TOKEN
    );
    expect(config.permissions.refreshToken).toBe(
      PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.REFRESH_TOKEN
    );
    expect(config.permissions.memberContacts).toBe('PM_TEST_CONTACTS');

    const serialized = JSON.stringify(config);
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('OUTGOING');
    expect(serialized).not.toContain('SECRET');
  });

  it('defaults RELEASE stage from production app env', () => {
    const config = resolvePublPappClientConfig({
      APP_ENV: 'production',
      PUBL_PAPP_RELEASE_CLIENT_HASH: 'release-client-hash',
      PUBL_PAPP_RELEASE_CODE: '3RD_A00003',
      PUBL_PAPP_SDK_SRC: 'https://publ.example/sdk.js',
    });

    expect(config.stage).toBe(PUBL_PAPP_CLIENT_STAGES.RELEASE);
    expect(config.pAppCode).toBe('3RD_A00003');
    expect(config.clientHash).toBe('release-client-hash');
    expect(config.sdkSrc).toBe('https://publ.example/sdk.js');
  });

  it('returns a non-secret unavailable result when clientHash is missing', () => {
    const result = resolvePublPappClientConfigResult({
      PUBL_PAPP_CLIENT_STAGE: 'test',
    });

    expect(result).toMatchObject({
      ok: false,
      status: 'misconfigured',
    });
    expect(result.message).toContain(PUBL_PAPP_CLIENT_ENV.TEST_CLIENT_HASH);
    expect(result.message).not.toContain('secret');
    expect(result.message).not.toContain('outgoing');
  });

  it('does not require optional common or catalog tap permission IDs', () => {
    const config = resolvePublPappClientConfig({
      PUBL_PAPP_CLIENT_STAGE: 'test',
      PUBL_PAPP_TEST_CLIENT_HASH: 'test-client-hash',
    });

    expect(config.authorizationPermissionIds).toEqual([
      PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.EXCHANGE_TOKEN,
      PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.REFRESH_TOKEN,
    ]);
    expect(config.permissions.sellerBusinessInformation).toBeNull();
    expect(config.permissions.memberContacts).toBeNull();
  });
});
