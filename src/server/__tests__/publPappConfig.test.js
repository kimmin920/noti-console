import { describe, expect, it } from 'vitest';

import {
  PUBL_PAPP_DEFAULT_CODES,
  PUBL_PAPP_STAGES,
  resolvePublPappConfig,
  resolvePublPappCredentials,
  selectPublPappCredentialByApiKey,
  selectPublPappCredentialByPAppCode,
} from '../publPapp/config.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';

describe('Publ PApp config', () => {
  it('selects the configured credential by apiKey and pAppCode', () => {
    const env = createPublPappEnv();

    expect(selectPublPappCredentialByApiKey('publ-test-api-key', { env })).toMatchObject({
      stage: PUBL_PAPP_STAGES.TEST,
      pAppCode: PUBL_PAPP_DEFAULT_CODES.TEST,
      outgoingSecretKey: 'publ-test-secret-key',
    });
    expect(selectPublPappCredentialByPAppCode('3RD_A00003', { env })).toMatchObject({
      stage: PUBL_PAPP_STAGES.RELEASE,
      outgoingApiKey: 'publ-release-api-key',
      outgoingSecretKey: 'publ-release-secret-key',
    });
  });

  it('rejects unknown api keys without echoing the submitted key', () => {
    expect(() =>
      selectPublPappCredentialByApiKey('unknown-publ-api-key', { env: createPublPappEnv() })
    ).toThrow('Publ PApp credential was not found.');

    try {
      selectPublPappCredentialByApiKey('unknown-publ-api-key', { env: createPublPappEnv() });
    } catch (error) {
      expect(error.code).toBe(RELAY_ERROR_CODES.UNAUTHORIZED);
      expect(error.status).toBe(401);
      expect(error.message).not.toContain('unknown-publ-api-key');
    }
  });

  it('defaults only pApp code values when env vars are absent', () => {
    const credentials = resolvePublPappCredentials({
      PUBL_PAPP_TEST_OUTGOING_API_KEY: 'publ-test-api-key',
      PUBL_PAPP_TEST_OUTGOING_SECRET_KEY: 'publ-test-secret-key',
    });

    expect(credentials).toHaveLength(1);
    expect(credentials[0]).toMatchObject({
      stage: PUBL_PAPP_STAGES.TEST,
      pAppCode: PUBL_PAPP_DEFAULT_CODES.TEST,
      outgoingApiKey: 'publ-test-api-key',
      outgoingSecretKey: 'publ-test-secret-key',
    });
  });

  it('rejects missing paired secrets without defaulting them', () => {
    expect(() =>
      resolvePublPappCredentials({
        PUBL_PAPP_TEST_OUTGOING_API_KEY: 'publ-test-api-key',
      })
    ).toThrow('PUBL_PAPP_TEST_OUTGOING_SECRET_KEY is required');
  });

  it('returns token secrets from env values only', () => {
    const config = resolvePublPappConfig(createPublPappEnv());

    expect(config.tokenSecrets).toEqual({
      accessTokenSecret: 'publ-access-token-secret',
      refreshTokenHashSecret: 'publ-refresh-token-hash-secret',
    });
  });

  it('keeps raw configured secret values out of config error messages', () => {
    const rawSecrets = [
      'publ-test-secret-key',
      'publ-release-secret-key',
      'publ-access-token-secret',
      'publ-refresh-token-hash-secret',
    ];

    for (const action of [
      () =>
        resolvePublPappCredentials({
          PUBL_PAPP_TEST_OUTGOING_API_KEY: 'shared-api-key',
          PUBL_PAPP_TEST_OUTGOING_SECRET_KEY: rawSecrets[0],
          PUBL_PAPP_RELEASE_OUTGOING_API_KEY: 'shared-api-key',
          PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY: rawSecrets[1],
        }),
      () =>
        resolvePublPappConfig({
          PUBL_PAPP_TEST_OUTGOING_API_KEY: 'publ-test-api-key',
          PUBL_PAPP_TEST_OUTGOING_SECRET_KEY: rawSecrets[0],
          PUBL_PAPP_RELEASE_OUTGOING_API_KEY: 'publ-release-api-key',
          PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY: rawSecrets[1],
          PUBL_PAPP_ACCESS_TOKEN_SECRET: rawSecrets[2],
        }),
    ]) {
      try {
        action();
      } catch (error) {
        const message = String(error.message);
        for (const rawSecret of rawSecrets) {
          expect(message).not.toContain(rawSecret);
        }
      }
    }
  });
});

function createPublPappEnv() {
  return {
    PUBL_PAPP_TEST_OUTGOING_API_KEY: 'publ-test-api-key',
    PUBL_PAPP_TEST_OUTGOING_SECRET_KEY: 'publ-test-secret-key',
    PUBL_PAPP_RELEASE_OUTGOING_API_KEY: 'publ-release-api-key',
    PUBL_PAPP_RELEASE_OUTGOING_SECRET_KEY: 'publ-release-secret-key',
    PUBL_PAPP_ACCESS_TOKEN_SECRET: 'publ-access-token-secret',
    PUBL_PAPP_REFRESH_TOKEN_HASH_SECRET: 'publ-refresh-token-hash-secret',
  };
}
