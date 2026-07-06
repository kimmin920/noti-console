import { describe, expect, it } from 'vitest';

import {
  PUBL_PAPP_TOKEN_CONSTANTS,
  PublPappTokenError,
  hashPublPappRefreshToken,
  signHmacJwt,
  verifyHmacJwt,
  verifyPublOutgoingJwt,
} from '../publPapp/tokens.js';

const FIXED_NOW = new Date('2026-07-06T00:00:00.000Z');
const TEST_SECRET = 'test-only-publ-outgoing-secret';

describe('Publ PApp JWT utilities', () => {
  it('signs and verifies supported HMAC JWT algorithms with test-only secrets', () => {
    const token = signHmacJwt({
      claim: {
        consumerId: 'consumer_1',
      },
      iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
      sub: 'Consumer:consumer_1',
    }, {
      expiresInSeconds: 900,
      now: () => FIXED_NOW,
      secret: TEST_SECRET,
    });

    expect(verifyPublOutgoingJwt(token, {
      now: () => FIXED_NOW,
      secret: TEST_SECRET,
    })).toMatchObject({
      claim: {
        consumerId: 'consumer_1',
      },
      iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
      sub: 'Consumer:consumer_1',
    });
  });

  it('rejects unsupported and none JWT algorithms', () => {
    const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify({
      exp: Math.floor(FIXED_NOW.getTime() / 1000) + 900,
      iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
    })).toString('base64url');

    expect(() =>
      verifyHmacJwt(`${encodedHeader}.${encodedPayload}.unsigned`, {
        now: () => FIXED_NOW,
        secret: TEST_SECRET,
      })
    ).toThrow(PublPappTokenError);
  });

  it('rejects invalid signatures', () => {
    const token = signHmacJwt({
      iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
      sub: 'Consumer:consumer_1',
    }, {
      expiresInSeconds: 900,
      now: () => FIXED_NOW,
      secret: TEST_SECRET,
    });

    expect(() =>
      verifyPublOutgoingJwt(token, {
        now: () => FIXED_NOW,
        secret: 'wrong-secret',
      })
    ).toThrow('Invalid JWT signature.');
  });

  it('rejects expired JWTs', () => {
    const token = signHmacJwt({
      exp: Math.floor(FIXED_NOW.getTime() / 1000) - 1,
      iss: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
      sub: 'Consumer:consumer_1',
    }, {
      now: () => FIXED_NOW,
      secret: TEST_SECRET,
    });

    expect(() =>
      verifyPublOutgoingJwt(token, {
        now: () => FIXED_NOW,
        secret: TEST_SECRET,
      })
    ).toThrow('JWT is expired.');
  });

  it('hashes refresh tokens without returning the raw token', () => {
    const rawToken = 'THIRD_PARTY_REFRESH_TOKEN';
    const hash = hashPublPappRefreshToken(rawToken, 'test-refresh-hash-secret');

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(rawToken);
  });
});
