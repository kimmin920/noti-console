import { describe, expect, it } from 'vitest';

import {
  PUBL_PAPP_PARENT_ORIGIN_ENV,
  resolvePublClientFramePolicy,
  resolvePublParentOrigins,
} from '../publPapp/framePolicy.js';

describe('Publ client frame policy', () => {
  it('selects test parent origins and normalizes trailing slashes', () => {
    const origins = resolvePublParentOrigins({
      NODE_ENV: 'development',
      PUBL_PAPP_CLIENT_STAGE: 'test',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.TEST]: 'https://console.dev.publ.biz/, http://localhost:3000/',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.RELEASE]: 'https://console.publ.biz',
    });

    expect(origins).toEqual(['https://console.dev.publ.biz', 'http://localhost:3000']);
  });

  it('selects release parent origins from production app env', () => {
    const origins = resolvePublParentOrigins({
      APP_ENV: 'production',
      NODE_ENV: 'production',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.RELEASE]: 'https://console.publ.biz',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.TEST]: 'https://console.dev.publ.biz',
    });

    expect(origins).toEqual(['https://console.publ.biz']);
  });

  it.each([
    ['https://console.publ.biz/path', 'must not include a path'],
    ['https://user:pass@console.publ.biz', 'must not include credentials'],
    ['https://*.publ.biz', 'must not include wildcards'],
  ])('rejects malformed parent origin %s', (origin, message) => {
    expect(() => resolvePublParentOrigins({
      NODE_ENV: 'development',
      PUBL_PAPP_CLIENT_STAGE: 'test',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.TEST]: origin,
    })).toThrow(message);
  });

  it('allows HTTP loopback only outside production', () => {
    expect(resolvePublParentOrigins({
      NODE_ENV: 'development',
      PUBL_PAPP_CLIENT_STAGE: 'test',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.TEST]: 'http://127.0.0.1:3000,http://localhost:5173',
    })).toEqual(['http://127.0.0.1:3000', 'http://localhost:5173']);

    expect(() => resolvePublParentOrigins({
      NODE_ENV: 'production',
      PUBL_PAPP_CLIENT_STAGE: 'test',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.TEST]: 'http://127.0.0.1:3000',
    })).toThrow('HTTP parent origins are not allowed in production');
  });

  it('rejects non-loopback HTTP origins', () => {
    expect(() => resolvePublParentOrigins({
      NODE_ENV: 'development',
      PUBL_PAPP_CLIENT_STAGE: 'test',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.TEST]: 'http://console.dev.publ.biz',
    })).toThrow('HTTP parent origins must be localhost loopback');
  });

  it('returns frame-ancestors none when the origin policy is missing or invalid', () => {
    expect(resolvePublClientFramePolicy({
      NODE_ENV: 'development',
      PUBL_PAPP_CLIENT_STAGE: 'test',
    })).toEqual({
      configured: false,
      contentSecurityPolicy: "frame-ancestors 'none'",
      origins: [],
    });

    expect(resolvePublClientFramePolicy({
      NODE_ENV: 'production',
      PUBL_PAPP_CLIENT_STAGE: 'release',
      [PUBL_PAPP_PARENT_ORIGIN_ENV.RELEASE]: 'http://localhost:3000',
    })).toMatchObject({
      configured: false,
      contentSecurityPolicy: "frame-ancestors 'none'",
    });
  });
});
