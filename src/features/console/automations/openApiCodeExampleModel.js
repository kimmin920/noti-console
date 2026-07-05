export const PUBL_OPEN_API_ENDPOINT_PATH = '/api/open/v1/publ/events';
export const PUBL_OPEN_API_ENDPOINT_URL = `https://YOUR_DOMAIN${PUBL_OPEN_API_ENDPOINT_PATH}`;
export const PUBL_OPEN_API_SECRET_ENV_VAR = 'PUBL_OPEN_API_WEBHOOK_SECRET';
export const PUBL_OPEN_API_SIGNATURE_INPUT = '${timestamp}.${rawBody}';

const DEFAULT_EVENT_KEY = 'order.created';
const DEFAULT_OCCURRED_AT = '2026-06-28T00:00:00.000Z';
const TARGET_PHONE_ALIAS = 'targetPhoneNumber';

export function buildPublOpenApiExample({ event, eventKey } = {}) {
  const normalizedEventKey = normalizeNonEmptyString(eventKey)
    ?? normalizeNonEmptyString(event?.eventKey)
    ?? DEFAULT_EVENT_KEY;
  const requestEnvelope = {
    eventKey: normalizedEventKey,
    externalEventId: buildExternalEventId(normalizedEventKey),
    channelCode: 'your-channel-code',
    occurredAt: DEFAULT_OCCURRED_AT,
    payload: buildSafePayloadExample(event),
  };
  const body = JSON.stringify(requestEnvelope, null, 2);

  return {
    endpointPath: PUBL_OPEN_API_ENDPOINT_PATH,
    endpointUrl: PUBL_OPEN_API_ENDPOINT_URL,
    headers: {
      'Content-Type': 'application/json',
      'x-publ-timestamp': '<unix-timestamp-or-iso-date>',
      'x-publ-signature': '<hex-hmac-sha256-signature>',
    },
    method: 'POST',
    requestEnvelope,
    secretEnvVar: PUBL_OPEN_API_SECRET_ENV_VAR,
    signatureInput: PUBL_OPEN_API_SIGNATURE_INPUT,
    snippets: {
      curl: buildCurlSnippet(body),
      fetch: buildFetchSnippet(body),
    },
  };
}

function buildSafePayloadExample(event) {
  const variables = getSafeEventVariables(event);
  const payload = {};

  for (const variable of variables) {
    payload[variable.alias] = getPlaceholderForVariable(variable);
  }

  if (!Object.prototype.hasOwnProperty.call(payload, TARGET_PHONE_ALIAS)) {
    payload[TARGET_PHONE_ALIAS] = '<recipient-phone-from-your-system>';
  }

  return payload;
}

function getSafeEventVariables(event) {
  const candidates = Array.isArray(event?.props)
    ? event.props
    : Array.isArray(event?.variableOptions)
      ? event.variableOptions
      : Array.isArray(event?.variablePreview)
        ? event.variablePreview
        : [];

  return candidates
    .filter((variable) => variable?.enabled !== false)
    .map((variable) => ({
      alias: normalizeAlias(variable?.alias),
      required: variable?.required === true,
      type: normalizeNonEmptyString(variable?.type) ?? 'text',
    }))
    .filter((variable) => variable.alias)
    .slice(0, 8);
}

function getPlaceholderForVariable(variable) {
  if (variable.alias === TARGET_PHONE_ALIAS) {
    return '<recipient-phone-from-your-system>';
  }

  if (variable.type === 'number') {
    return 1234;
  }

  if (variable.type === 'datetime') {
    return DEFAULT_OCCURRED_AT;
  }

  if (variable.type === 'array') {
    return [`<${variable.alias}-item>`];
  }

  return `<${variable.alias}>`;
}

function buildCurlSnippet(body) {
  return `timestamp=$(date +%s)
body=$(cat <<'JSON'
${body}
JSON
)
signature=$(printf "%s.%s" "$timestamp" "$body" | openssl dgst -sha256 -hmac "$${PUBL_OPEN_API_SECRET_ENV_VAR}" -hex | awk '{print $2}')

curl -X POST "${PUBL_OPEN_API_ENDPOINT_URL}" \\
  -H "Content-Type: application/json" \\
  -H "x-publ-timestamp: $timestamp" \\
  -H "x-publ-signature: $signature" \\
  --data "$body"`;
}

function buildFetchSnippet(body) {
  return `import { createHmac } from 'node:crypto';

const endpoint = '${PUBL_OPEN_API_ENDPOINT_URL}';
const body = JSON.stringify(${body}, null, 2);
const timestamp = Date.now().toString();
const signature = createHmac('sha256', process.env.${PUBL_OPEN_API_SECRET_ENV_VAR})
  .update(\`${'${timestamp}.${body}'}\`)
  .digest('hex');

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-publ-timestamp': timestamp,
    'x-publ-signature': signature,
  },
  body,
});

const result = await response.json();`;
}

function buildExternalEventId(eventKey) {
  const suffix = String(eventKey)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'publ_event';

  return `evt_${suffix}_001`;
}

function normalizeAlias(value) {
  const text = normalizeNonEmptyString(value);
  if (!text) return '';

  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text) ? text : '';
}

function normalizeNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
