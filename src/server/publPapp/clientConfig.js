import { PUBL_PAPP_DEFAULT_CODES } from './config.js';

export const PUBL_PAPP_CLIENT_STAGES = Object.freeze({
  RELEASE: 'release',
  TEST: 'test',
});

export const PUBL_PAPP_CLIENT_ENV = Object.freeze({
  CLIENT_STAGE: 'PUBL_PAPP_CLIENT_STAGE',
  RELEASE_CLIENT_HASH: 'PUBL_PAPP_RELEASE_CLIENT_HASH',
  RELEASE_CODE: 'PUBL_PAPP_RELEASE_CODE',
  RELEASE_MEMBER_CONTACTS_PERMISSION_ID: 'PUBL_PAPP_RELEASE_MEMBER_CONTACTS_PERMISSION_ID',
  RELEASE_SELLER_INFO_PERMISSION_ID: 'PUBL_PAPP_RELEASE_SELLER_INFO_PERMISSION_ID',
  SDK_SRC: 'PUBL_PAPP_SDK_SRC',
  TEST_CLIENT_HASH: 'PUBL_PAPP_TEST_CLIENT_HASH',
  TEST_CODE: 'PUBL_PAPP_TEST_CODE',
  TEST_MEMBER_CONTACTS_PERMISSION_ID: 'PUBL_PAPP_TEST_MEMBER_CONTACTS_PERMISSION_ID',
  TEST_SELLER_INFO_PERMISSION_ID: 'PUBL_PAPP_TEST_SELLER_INFO_PERMISSION_ID',
});

export const PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS = Object.freeze({
  EXCHANGE_TOKEN: 'PM_00000_EXCHANGE_TOKEN',
  REFRESH_TOKEN: 'PM_00000_REFRESH_TOKEN',
  TEST_MEMBER_CONTACTS: 'PM_19177_READ_MEMBER_CONTACTS',
});

export const PUBL_PAPP_CLIENT_DEFAULT_SDK_SRC = '/vendor/publ-p-app-client-sdk.testflight.js';

const STAGE_DEFINITIONS = Object.freeze({
  [PUBL_PAPP_CLIENT_STAGES.TEST]: Object.freeze({
    clientHashEnvName: PUBL_PAPP_CLIENT_ENV.TEST_CLIENT_HASH,
    defaultMemberContactsPermissionId: PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.TEST_MEMBER_CONTACTS,
    defaultPAppCode: PUBL_PAPP_DEFAULT_CODES.TEST,
    memberContactsPermissionEnvName: PUBL_PAPP_CLIENT_ENV.TEST_MEMBER_CONTACTS_PERMISSION_ID,
    pAppCodeEnvName: PUBL_PAPP_CLIENT_ENV.TEST_CODE,
    sellerInfoPermissionEnvName: PUBL_PAPP_CLIENT_ENV.TEST_SELLER_INFO_PERMISSION_ID,
  }),
  [PUBL_PAPP_CLIENT_STAGES.RELEASE]: Object.freeze({
    clientHashEnvName: PUBL_PAPP_CLIENT_ENV.RELEASE_CLIENT_HASH,
    defaultMemberContactsPermissionId: null,
    defaultPAppCode: PUBL_PAPP_DEFAULT_CODES.RELEASE,
    memberContactsPermissionEnvName: PUBL_PAPP_CLIENT_ENV.RELEASE_MEMBER_CONTACTS_PERMISSION_ID,
    pAppCodeEnvName: PUBL_PAPP_CLIENT_ENV.RELEASE_CODE,
    sellerInfoPermissionEnvName: PUBL_PAPP_CLIENT_ENV.RELEASE_SELLER_INFO_PERMISSION_ID,
  }),
});

export function resolvePublPappClientConfigResult(env = process.env) {
  try {
    return {
      config: resolvePublPappClientConfig(env),
      ok: true,
      status: 'ready',
    };
  } catch (error) {
    return {
      message: error?.message || 'Publ client configuration is invalid.',
      ok: false,
      status: 'misconfigured',
    };
  }
}

export function resolvePublPappClientConfig(env = process.env) {
  const stage = resolveClientStage(env);
  const definition = STAGE_DEFINITIONS[stage];
  const clientHash = readOptionalEnv(env, definition.clientHashEnvName);

  if (!clientHash) {
    throw new Error(`${definition.clientHashEnvName} is required for Publ client bootstrap.`);
  }

  const permissions = Object.freeze({
    exchangeToken: PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.EXCHANGE_TOKEN,
    memberContacts: readOptionalEnv(env, definition.memberContactsPermissionEnvName)
      ?? definition.defaultMemberContactsPermissionId,
    refreshToken: PUBL_PAPP_CLIENT_DEFAULT_PERMISSION_IDS.REFRESH_TOKEN,
    sellerBusinessInformation: readOptionalEnv(env, definition.sellerInfoPermissionEnvName),
  });

  return Object.freeze({
    authorizationPermissionIds: Object.freeze(getAuthorizationPermissionIds(permissions)),
    clientHash,
    pAppCode: readOptionalEnv(env, definition.pAppCodeEnvName) ?? definition.defaultPAppCode,
    permissions,
    sdkSrc: resolveSdkSrc(env, stage),
    stage,
  });
}

function resolveClientStage(env) {
  const configuredStage = readOptionalEnv(env, PUBL_PAPP_CLIENT_ENV.CLIENT_STAGE)?.toLowerCase();

  if (configuredStage) {
    if (configuredStage === 'test' || configuredStage === 'test_flight') {
      return PUBL_PAPP_CLIENT_STAGES.TEST;
    }

    if (configuredStage === 'release' || configuredStage === 'production') {
      return PUBL_PAPP_CLIENT_STAGES.RELEASE;
    }

    throw new Error(`${PUBL_PAPP_CLIENT_ENV.CLIENT_STAGE} must be test or release.`);
  }

  return readOptionalEnv(env, 'APP_ENV') === 'production'
    ? PUBL_PAPP_CLIENT_STAGES.RELEASE
    : PUBL_PAPP_CLIENT_STAGES.TEST;
}

function resolveSdkSrc(env, stage) {
  const configuredSrc = readOptionalEnv(env, PUBL_PAPP_CLIENT_ENV.SDK_SRC);

  if (configuredSrc) {
    return configuredSrc;
  }

  return stage === PUBL_PAPP_CLIENT_STAGES.TEST ? PUBL_PAPP_CLIENT_DEFAULT_SDK_SRC : null;
}

function getAuthorizationPermissionIds(permissions) {
  return [
    permissions.exchangeToken,
    permissions.refreshToken,
    permissions.sellerBusinessInformation,
    permissions.memberContacts,
  ].filter(Boolean);
}

function readOptionalEnv(env, name) {
  const value = typeof env[name] === 'string' ? env[name].trim() : '';
  return value || null;
}
