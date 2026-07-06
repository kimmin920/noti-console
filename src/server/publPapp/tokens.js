import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const PUBL_PAPP_TOKEN_CONSTANTS = Object.freeze({
  PUBL_JWT_ISSUER: 'publ-developers',
  LOCAL_ACCESS_TOKEN_ISSUER: 'vizuo-publ-papp',
  LOCAL_ACCESS_TOKEN_AUDIENCE: 'vizuo-publ-client',
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,
});

export const PUBL_PAPP_HMAC_JWT_ALGORITHMS = Object.freeze({
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
});

export class PublPappTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublPappTokenError';
  }
}

export function signHmacJwt(payload, {
  alg = 'HS256',
  expiresInSeconds,
  now = () => new Date(),
  secret,
} = {}) {
  const digest = PUBL_PAPP_HMAC_JWT_ALGORITHMS[alg];
  if (!digest) {
    throw new PublPappTokenError('Unsupported JWT algorithm.');
  }

  const issuedAt = toNumericDate(now());
  const jwtPayload = {
    ...payload,
    iat: payload?.iat ?? issuedAt,
    ...(expiresInSeconds ? { exp: payload?.exp ?? issuedAt + expiresInSeconds } : {}),
  };
  const encodedHeader = encodeJwtSegment({ alg, typ: 'JWT' });
  const encodedPayload = encodeJwtSegment(jwtPayload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createJwtSignature(signingInput, secret, digest);

  return `${signingInput}.${signature}`;
}

export function verifyHmacJwt(token, {
  audience,
  ignoreExpiration = false,
  issuer,
  now = () => new Date(),
  secret,
} = {}) {
  const [encodedHeader, encodedPayload, encodedSignature, ...extra] = String(token ?? '').split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra.length) {
    throw new PublPappTokenError('JWT must have three segments.');
  }

  const header = decodeJwtSegment(encodedHeader, 'JWT header');
  const payload = decodeJwtSegment(encodedPayload, 'JWT payload');
  const digest = PUBL_PAPP_HMAC_JWT_ALGORITHMS[header.alg];

  if (!digest) {
    throw new PublPappTokenError('Unsupported JWT algorithm.');
  }

  const expectedSignature = createJwtSignature(`${encodedHeader}.${encodedPayload}`, secret, digest);
  if (!safeEqualString(encodedSignature, expectedSignature)) {
    throw new PublPappTokenError('Invalid JWT signature.');
  }

  if (issuer && payload.iss !== issuer) {
    throw new PublPappTokenError('Invalid JWT issuer.');
  }

  if (audience && payload.aud !== audience) {
    throw new PublPappTokenError('Invalid JWT audience.');
  }

  if (!ignoreExpiration) {
    assertNotExpired(payload, now());
  }

  return payload;
}

export function verifyPublOutgoingJwt(token, {
  now = () => new Date(),
  secret,
} = {}) {
  return verifyHmacJwt(token, {
    issuer: PUBL_PAPP_TOKEN_CONSTANTS.PUBL_JWT_ISSUER,
    now,
    secret,
  });
}

export function createLocalAccessToken({
  claim,
  now = () => new Date(),
  secret,
  session,
  user,
}) {
  return signHmacJwt({
    aud: PUBL_PAPP_TOKEN_CONSTANTS.LOCAL_ACCESS_TOKEN_AUDIENCE,
    channelCode: claim.channelCode,
    consumerId: claim.consumerId,
    iss: PUBL_PAPP_TOKEN_CONSTANTS.LOCAL_ACCESS_TOKEN_ISSUER,
    jti: session.accessTokenJti,
    pAppCode: claim.pAppCode,
    sessionId: session.id,
    sub: `Consumer:${claim.consumerId}`,
    userId: user.id,
    exp: toNumericDate(session.accessTokenExpiresAt),
  }, {
    now,
    secret,
  });
}

export function verifyLocalAccessToken(token, {
  ignoreExpiration = false,
  now = () => new Date(),
  secret,
} = {}) {
  return verifyHmacJwt(token, {
    audience: PUBL_PAPP_TOKEN_CONSTANTS.LOCAL_ACCESS_TOKEN_AUDIENCE,
    ignoreExpiration,
    issuer: PUBL_PAPP_TOKEN_CONSTANTS.LOCAL_ACCESS_TOKEN_ISSUER,
    now,
    secret,
  });
}

export function generatePublPappRefreshToken() {
  return randomBytes(32).toString('base64url');
}

export function generatePublPappAccessTokenJti() {
  return randomBytes(16).toString('base64url');
}

export function hashPublPappRefreshToken(refreshToken, secret) {
  if (!isNonEmptyString(refreshToken)) {
    throw new PublPappTokenError('refreshToken is required.');
  }

  return createHmac('sha256', normalizeSecret(secret))
    .update(refreshToken)
    .digest('hex');
}

export function addTokenSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

function assertNotExpired(payload, now) {
  const exp = Number(payload.exp);
  if (!Number.isSafeInteger(exp)) {
    throw new PublPappTokenError('JWT expiration is required.');
  }

  if (exp <= toNumericDate(now)) {
    throw new PublPappTokenError('JWT is expired.');
  }
}

function createJwtSignature(signingInput, secret, digest) {
  return createHmac(digest, normalizeSecret(secret))
    .update(signingInput)
    .digest('base64url');
}

function encodeJwtSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJwtSegment(segment, label) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new PublPappTokenError(`${label} is not base64url encoded.`);
  }

  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new PublPappTokenError(`${label} is invalid JSON.`);
  }
}

function normalizeSecret(secret) {
  if (!isNonEmptyString(secret)) {
    throw new PublPappTokenError('JWT secret is required.');
  }

  return secret;
}

function safeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function toNumericDate(date) {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const time = parsedDate.getTime();

  if (Number.isNaN(time)) {
    throw new PublPappTokenError('Date value is invalid.');
  }

  return Math.floor(time / 1000);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
