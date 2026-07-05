import { resolveRelayActor } from '../auth/actor.js';
import { parseRelayRequest, relayRoute } from '../http/relayRoute.js';
import { createDefaultAutomationService } from './service.js';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function handleAutomationRulesListRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { searchParams } = new URL(request.url);

    return {
      headers: NO_STORE_HEADERS,
      data: await resolveAutomationService({ automationService, createAutomationService }).listAutomationRules({
        actorUserId: actor.user.id,
        query: Object.fromEntries(searchParams.entries()),
      }),
    };
  });
}

export async function handleAutomationRuleCreateRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { payload } = await parseRelayRequest(request);

    return {
      headers: NO_STORE_HEADERS,
      status: 201,
      data: await resolveAutomationService({ automationService, createAutomationService }).createAutomationRule({
        actorUserId: actor.user.id,
        payload,
      }),
    };
  });
}

export async function handleAutomationRuleDetailRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  params,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { ruleId } = await params;

    return {
      headers: NO_STORE_HEADERS,
      data: await resolveAutomationService({ automationService, createAutomationService }).getAutomationRule({
        actorUserId: actor.user.id,
        ruleId,
      }),
    };
  });
}

export async function handleAutomationRuleUpdateRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  params,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { ruleId } = await params;
    const { payload } = await parseRelayRequest(request);

    return {
      headers: NO_STORE_HEADERS,
      data: await resolveAutomationService({ automationService, createAutomationService }).updateAutomationRule({
        actorUserId: actor.user.id,
        ruleId,
        payload,
      }),
    };
  });
}

export async function handleAutomationRuleEnableRequest(options = {}) {
  return handleAutomationRuleActionRequest({
    ...options,
    action: 'enableAutomationRule',
  });
}

export async function handleAutomationRuleDisableRequest(options = {}) {
  return handleAutomationRuleActionRequest({
    ...options,
    action: 'disableAutomationRule',
  });
}

export async function handleAutomationRuleArchiveRequest(options = {}) {
  return handleAutomationRuleActionRequest({
    ...options,
    action: 'archiveAutomationRule',
  });
}

export async function handleAutomationRuleDryRunRequest({
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  params,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { ruleId } = await params;
    const { payload } = await parseRelayRequest(request);
    const service = resolveAutomationService({ automationService, createAutomationService });

    return {
      headers: NO_STORE_HEADERS,
      data: await service.dryRunAutomationRule({
        actorUserId: actor.user.id,
        payload: payload.payload ?? {},
        ruleId,
        sampleEnvelope: payload.sampleEnvelope ?? {},
      }),
    };
  });
}

async function handleAutomationRuleActionRequest({
  action,
  automationService = null,
  createAutomationService = createDefaultAutomationService,
  params,
  request,
  resolveActor = resolveRelayActor,
} = {}) {
  return relayRoute(async () => {
    const actor = await resolveActor(request);
    const { ruleId } = await params;
    const service = resolveAutomationService({ automationService, createAutomationService });

    return {
      headers: NO_STORE_HEADERS,
      data: await service[action]({
        actorUserId: actor.user.id,
        ruleId,
      }),
    };
  });
}

function resolveAutomationService({ automationService, createAutomationService }) {
  return automationService ?? createAutomationService();
}
