import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  AUTOMATION_PROCESSING_STATUSES,
} from '../automations/service.js';
import {
  createPublOpenApiSignature,
} from '../automations/openApiAuth.js';
import {
  handlePublOpenApiEventRequest,
} from '../automations/openApiRoute.js';

const OPEN_API_URL = 'http://localhost/api/open/v1/publ/events';
const FIXED_NOW = new Date('2026-06-21T12:00:00.000Z');
const WEBHOOK_SECRET = 'publ-open-api-secret';

describe('PUBL Open API route', () => {
  it('passes a valid signed request to the automation service', async () => {
    const envelope = createEnvelope();
    const service = createAutomationService({
      ok: true,
      status: AUTOMATION_PROCESSING_STATUSES.SENT,
      reasonCode: null,
      eventKey: envelope.eventKey,
      externalEventId: envelope.externalEventId,
      channelCode: envelope.channelCode,
      acceptedAt: '2026-06-21T12:00:01.000Z',
      deliveryCount: 1,
      deliveries: [{ targetPhoneMasked: '010****5678' }],
    });

    const response = await callOpenApiRoute({ envelope, service });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(service.processPublAutomationEvent).toHaveBeenCalledWith(envelope);
    expect(body).toEqual({
      ok: true,
      status: AUTOMATION_PROCESSING_STATUSES.SENT,
      reasonCode: null,
      eventKey: 'order.created',
      externalEventId: 'evt_1',
      channelCode: 'store_1',
      acceptedAt: '2026-06-21T12:00:01.000Z',
      deliveryCount: 1,
      maskedRecipient: '010****5678',
    });
  });

  it('rejects an invalid signature before JSON processing', async () => {
    const service = createAutomationService();
    const response = await callOpenApiRoute({
      rawBody: '{"eventKey":',
      service,
      signature: 'a'.repeat(64),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      status: 'rejected',
      reasonCode: 'invalid_signature',
    });
    expect(service.processPublAutomationEvent).not.toHaveBeenCalled();
  });

  it('rejects stale signed timestamps', async () => {
    const staleTimestamp = String(Math.floor((FIXED_NOW.getTime() - 301_000) / 1000));
    const service = createAutomationService();
    const response = await callOpenApiRoute({
      service,
      timestamp: staleTimestamp,
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.reasonCode).toBe('invalid_signature');
    expect(service.processPublAutomationEvent).not.toHaveBeenCalled();
  });

  it('maps missing channel code to invalid payload', async () => {
    const envelope = createEnvelope({ channelCode: undefined });
    const service = createAutomationService({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      reasonMessage: 'eventKey, externalEventId, and channelCode are required.',
      acceptedAt: '2026-06-21T12:00:01.000Z',
      deliveryCount: 0,
      deliveries: [],
    });

    const response = await callOpenApiRoute({ envelope, service });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.INVALID_PAYLOAD,
    });
    expect(service.processPublAutomationEvent).toHaveBeenCalledWith(envelope);
  });

  it('maps unknown channel code to 422', async () => {
    const envelope = createEnvelope({ channelCode: 'unknown_store' });
    const service = createAutomationService({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
      reasonMessage: 'No active channel mapping exists for the channel code.',
      eventKey: envelope.eventKey,
      externalEventId: envelope.externalEventId,
      channelCode: envelope.channelCode,
      acceptedAt: '2026-06-21T12:00:01.000Z',
      deliveryCount: 0,
      deliveries: [],
    });

    const response = await callOpenApiRoute({ envelope, service });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      ok: false,
      status: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
      reasonCode: AUTOMATION_PROCESSING_STATUSES.UNKNOWN_CHANNEL_CODE,
      channelCode: 'unknown_store',
    });
  });

  it('keeps the public route free of browser actor authentication and body-consuming relay parsing', async () => {
    const routeSource = await readFile(
      new URL('../../app/api/open/v1/publ/events/route.js', import.meta.url),
      'utf8'
    );

    expect(routeSource).toContain("export const runtime = 'nodejs'");
    expect(routeSource.match(/await request\.text\(\)/g)).toHaveLength(1);
    expect(routeSource).not.toContain('resolveRelayActor');
    expect(routeSource).not.toContain('parseRelayRequest');
  });

  it('does not include raw request payloads in error responses', async () => {
    const rawBody = '{"eventKey":"order.created","payload":{"targetPhoneNumber":"010-1234-5678","secret":"private-order-123"}';
    const response = await callOpenApiRoute({ rawBody });
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(400);
    expect(bodyText).not.toContain('010-1234-5678');
    expect(bodyText).not.toContain('private-order-123');
    expect(bodyText).not.toContain(rawBody);
  });

  it('returns safe server errors without raw payloads', async () => {
    const service = {
      processPublAutomationEvent: vi.fn(async () => {
        throw new Error('private-order-123 010-1234-5678');
      }),
    };
    const response = await callOpenApiRoute({ service });
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(500);
    expect(bodyText).toContain('server_error');
    expect(bodyText).not.toContain('private-order-123');
    expect(bodyText).not.toContain('010-1234-5678');
  });
});

async function callOpenApiRoute({
  envelope = createEnvelope(),
  rawBody = JSON.stringify(envelope),
  secret = WEBHOOK_SECRET,
  service = createAutomationService(),
  signature,
  timestamp = String(Math.floor(FIXED_NOW.getTime() / 1000)),
} = {}) {
  const request = createOpenApiRequest({
    rawBody,
    secret,
    signature,
    timestamp,
  });

  return handlePublOpenApiEventRequest({
    automationService: service,
    env: { PUBL_OPEN_API_WEBHOOK_SECRET: secret },
    now: () => FIXED_NOW,
    rawBody,
    request,
  });
}

function createOpenApiRequest({
  rawBody,
  secret,
  signature,
  timestamp,
}) {
  const requestSignature = signature ?? createPublOpenApiSignature({
    rawBody,
    secret,
    timestamp,
  });

  return new Request(OPEN_API_URL, {
    body: rawBody,
    headers: {
      'content-type': 'application/json',
      'x-publ-signature': requestSignature,
      'x-publ-timestamp': timestamp,
    },
    method: 'POST',
  });
}

function createAutomationService(result = {
  ok: true,
  status: AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
  reasonCode: AUTOMATION_PROCESSING_STATUSES.IGNORED_NO_RULE,
  eventKey: 'order.created',
  externalEventId: 'evt_1',
  channelCode: 'store_1',
  acceptedAt: '2026-06-21T12:00:01.000Z',
  deliveryCount: 0,
  deliveries: [],
}) {
  return {
    processPublAutomationEvent: vi.fn(async () => result),
  };
}

function createEnvelope(overrides = {}) {
  const envelope = {
    eventKey: 'order.created',
    externalEventId: 'evt_1',
    channelCode: 'store_1',
    occurredAt: '2026-06-21T11:59:00.000Z',
    payload: {
      orderId: 'order_123',
      targetPhoneNumber: '010-1234-5678',
    },
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(envelope).filter(([, value]) => value !== undefined)
  );
}
