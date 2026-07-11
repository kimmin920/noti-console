import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { encryptAutomationEventPayload } from '../automations/payloadVault.js';
import { createAutomationService } from '../automations/service.js';
import {
  AUTOMATION_RULE_EDITOR_ACTIONS,
  automationRuleEditorReducer,
  createAutomationRuleEditorState,
} from '../../features/console/automations/ruleEditorReducer.js';
import { ALLOWED_AUTOMATION_CONDITION_OPERATORS } from '../../features/console/automations/automationRulePolicyModel.js';
import {
  handleAutomationRuleArchiveRequest,
  handleAutomationRuleCreateRequest,
  handleAutomationRuleDetailRequest,
  handleAutomationRuleDisableRequest,
  handleAutomationRuleDryRunRequest,
  handleAutomationRuleEnableRequest,
  handleAutomationRuleUpdateRequest,
  handleAutomationRulesListRequest,
} from '../automations/rulesRoute.js';
import {
  handleAutomationUnsentDismissRequest,
  handleAutomationUnsentListRequest,
  handleAutomationUnsentSendRequest,
} from '../automations/unsentRoute.js';
import { createMessageSendService } from '../messages/service.js';
import { CHANNELS, RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';

const FIXED_NOW = new Date('2026-06-21T01:00:00.000Z');
const TEST_KEY = Buffer.from('0123456789abcdef0123456789abcdef');
const UNSENT_URL = 'http://localhost/api/automations/unsent';
const RULES_URL = 'http://localhost/api/automations/rules';

describe('automation unsent console API', () => {
  it('requires actor authentication', async () => {
    const harness = createUnsentHarness();
    const response = await handleAutomationUnsentListRequest({
      automationService: harness.service,
      request: new Request(UNSENT_URL),
      resolveActor: async () => {
        throw new RelayError({
          code: RELAY_ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication is required.',
          status: 401,
        });
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: RELAY_ERROR_CODES.UNAUTHORIZED,
      },
    });
  });

  it('does not list, send, or dismiss another user delivery', async () => {
    const harness = createUnsentHarness();
    const listResponse = await callList({ actorUserId: 'user_2', harness });
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.data.deliveries).toEqual([]);

    const sendResponse = await callSend({ actorUserId: 'user_2', harness });
    const dismissResponse = await callDismiss({ actorUserId: 'user_2', harness });

    expect(sendResponse.status).toBe(403);
    expect(dismissResponse.status).toBe(403);
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(harness.repository.deliveries[0].status).toBe('unsent');
  });

  it('lists safe delivery fields with masked recipients and no payload data', async () => {
    const harness = createUnsentHarness();
    const response = await callList({ harness });
    const body = await response.json();
    const responseText = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.data.deliveries).toEqual([
      {
        id: 'delivery_1',
        status: 'unsent',
        eventKey: 'order.created',
        eventDisplayName: 'Order created',
        channelCode: 'store_1',
        sendChannel: CHANNELS.ALIMTALK,
        ruleName: 'Order ready',
        maskedRecipient: '010****5678',
        reasonCode: 'missing_sender_resource',
        reasonMessage: 'The automation rule requires an active sender resource.',
        receivedAt: '2026-06-21T01:00:00.000Z',
        payloadExpiresAt: '2026-06-28T01:00:00.000Z',
        createdAt: '2026-06-21T01:00:00.000Z',
      },
    ]);
    expect(responseText).not.toContain('eventPayloadCiphertext');
    expect(responseText).not.toContain('eventPayloadIv');
    expect(responseText).not.toContain('eventPayloadTag');
    expect(responseText).not.toContain('010-1234-5678');
    expect(responseText).not.toContain('ORDER-123');
  });

  it('retries dispatch and marks the delivery sent when the provider accepts it', async () => {
    const harness = createUnsentHarness();
    const response = await callSend({ harness });
    const body = await response.json();
    const responseText = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      delivery: {
        id: 'delivery_1',
        status: 'sent',
        maskedRecipient: '010****5678',
        reasonCode: null,
      },
      sendResult: {
        status: 'sent',
        deliveryStatus: 'sent',
        reasonCode: null,
      },
    });
    expect(harness.kakaoClient.sendAlimtalkMessage).toHaveBeenCalledTimes(1);
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'sent',
      messageSendGroupId: 'ledger_group_1',
      eventPayloadCiphertext: null,
      payloadPurgedAt: FIXED_NOW,
    });
    expect(responseText).not.toContain('010-1234-5678');
    expect(responseText).not.toContain('ORDER-123');
  });

  it('keeps the delivery unsent when retry prerequisites are still missing', async () => {
    const harness = createUnsentHarness({
      links: [],
    });
    const response = await callSend({ harness });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      delivery: {
        id: 'delivery_1',
        status: 'unsent',
        reasonCode: 'missing_sender_resource',
      },
      sendResult: {
        status: 'unsent',
        deliveryStatus: 'unsent',
        reasonCode: 'missing_sender_resource',
      },
    });
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'unsent',
      lastAttemptAt: FIXED_NOW,
      reasonCode: 'missing_sender_resource',
    });
  });

  it('dismisses an unsent delivery and removes it from the list', async () => {
    const harness = createUnsentHarness();
    const dismissResponse = await callDismiss({ harness });
    const dismissBody = await dismissResponse.json();
    const listResponse = await callList({ harness });
    const listBody = await listResponse.json();

    expect(dismissResponse.status).toBe(200);
    expect(dismissBody.data.delivery).toMatchObject({
      id: 'delivery_1',
      status: 'dismissed',
    });
    expect(harness.repository.deliveries[0]).toMatchObject({
      status: 'dismissed',
      dismissedAt: FIXED_NOW,
    });
    expect(listBody.data.deliveries).toEqual([]);
  });

  it('does not resend a purged payload', async () => {
    const harness = createUnsentHarness({
      deliveries: [
        createDeliveryRow({
          eventPayloadCiphertext: null,
          eventPayloadIv: null,
          eventPayloadTag: null,
          payloadPurgedAt: FIXED_NOW,
        }),
      ],
    });
    const response = await callSend({ harness });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
        state: 'local_validation_failed',
      },
    });
    expect(body.error.message).toContain('Event data has expired');
    expect(harness.kakaoClient.sendAlimtalkMessage).not.toHaveBeenCalled();
  });
});

describe('automation rule management console API', () => {
  it('requires actor authentication for rule lists', async () => {
    const harness = createUnsentHarness();
    const response = await handleAutomationRulesListRequest({
      automationService: harness.service,
      request: new Request(RULES_URL),
      resolveActor: async () => {
        throw new RelayError({
          code: RELAY_ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication is required.',
          status: 401,
        });
      },
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: RELAY_ERROR_CODES.UNAUTHORIZED,
      },
    });
  });

  it('lists and reads only actor-owned safe rule DTOs', async () => {
    const harness = createUnsentHarness({
      rules: [
        createRule(),
        createRule({ id: 'rule_2', userId: 'user_2' }),
      ],
    });
    const listResponse = await callRulesList({ harness });
    const listBody = await listResponse.json();
    const detailResponse = await callRuleDetail({ actorUserId: 'user_2', harness, ruleId: 'rule_1' });
    const serialized = JSON.stringify(listBody);

    expect(listResponse.status).toBe(200);
    expect(listBody.data.rules).toHaveLength(1);
    expect(listBody.data.rules[0]).toMatchObject({
      id: 'rule_1',
      templateCode: 'ORDER_READY',
    });
    expect(listBody.data.rules[0]).not.toHaveProperty('readiness');
    expect(detailResponse.status).toBe(403);
    expect(serialized).not.toContain('eventPayloadCiphertext');
    expect(serialized).not.toContain('recipientNo');
    expect(serialized).not.toContain('templateParameter');
  });

  it('validates create and update payloads through route helpers', async () => {
    const harness = createUnsentHarness({ rules: [] });
    const createResponse = await callRuleCreate({
      harness,
      payload: createRulePayload(),
    });
    const createBody = await createResponse.json();
    const updateResponse = await callRuleUpdate({
      harness,
      payload: {
        condition: {
          all: [{ alias: 'orderNo', operator: 'regex', value: '^ORDER' }],
        },
      },
      ruleId: createBody.data.rule.id,
    });
    const updateBody = await updateResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.data.rule).toMatchObject({
      status: 'disabled',
    });
    expect(createBody.data.rule).not.toHaveProperty('readiness');
    expect(updateResponse.status).toBe(400);
    expect(updateBody.error.code).toBe(RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED);
  });

  it('returns dry-run safe summaries without writing audit or delivery rows', async () => {
    const harness = createUnsentHarness({ deliveries: [] });
    const response = await callRuleDryRun({
      harness,
      sampleEnvelope: {
        eventKey: 'order.created',
        externalEventId: 'evt_1',
        channelCode: 'store_1',
        payload: {
          order: { no: 'ORDER-PRIVATE-123' },
          orderStatus: 'READY',
          targetPhoneNumber: '010-1234-5678',
        },
      },
    });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      ok: true,
      wouldSend: true,
      maskedRecipient: '010****5678',
    });
    expect(harness.repository.deliveries).toHaveLength(0);
    expect(harness.repository.revisions).toHaveLength(0);
    expect(serialized).not.toContain('ORDER-PRIVATE-123');
    expect(serialized).not.toContain('010-1234-5678');
    expect(serialized).not.toContain('01012345678');
  });

  it('surfaces enable conflicts without a browser validation step', async () => {
    const harness = createUnsentHarness({
      rules: [
        createRule({ id: 'rule_1', status: 'enabled' }),
        createRule({ id: 'rule_2', status: 'disabled', templateCode: 'ORDER_READY_BACKUP' }),
      ],
    });
    const conflictResponse = await callRuleAction({
      handler: handleAutomationRuleEnableRequest,
      harness,
      ruleId: 'rule_2',
    });
    const conflictBody = await conflictResponse.json();

    expect(conflictResponse.status).toBe(400);
    expect(conflictBody.error.code).toBe(RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED);
    expect(harness.repository.rules.filter((rule) => rule.status === 'enabled')).toHaveLength(1);
  });

  it('disables and archives rules', async () => {
    const harness = createUnsentHarness();
    const disableResponse = await callRuleAction({
      handler: handleAutomationRuleDisableRequest,
      harness,
    });
    const archiveResponse = await callRuleAction({
      handler: handleAutomationRuleArchiveRequest,
      harness,
    });
    const disableBody = await disableResponse.json();
    const archiveBody = await archiveResponse.json();

    expect(disableResponse.status).toBe(200);
    expect(disableBody.data.rule.status).toBe('disabled');
    expect(archiveResponse.status).toBe(200);
    expect(archiveBody.data.rule).toMatchObject({
      status: 'archived',
    });
    expect(archiveBody.data.rule).not.toHaveProperty('readiness');
  });
});

describe('automation unsent tab UI contract', () => {
  it('renders the automation rules tab from the rules API instead of fixture rows', () => {
    const configSource = readSource('../../features/console/consoleConfig.js');
    const apiSource = readSource('../../features/console/automations/apiClient.js');
    const querySource = readSource('../../features/console/automations/queries.js');
    const automationRulesUiSource = readSource('../../features/console/automations/AutomationRulesTable.jsx');

    expect(configSource).toContain("variant: 'automations'");
    expect(configSource).not.toContain('welcome-sequence');
    expect(configSource).not.toContain('cart-reminder');
    expect(apiSource).toContain("'/api/automations/rules'");
    expect(querySource).toContain('useAutomationRulesQuery');
    expect(automationRulesUiSource).toContain('useAutomationRulesQuery(queryFilters)');
    expect(automationRulesUiSource).toContain('SearchField');
    expect(automationRulesUiSource).toContain('FilterSelect');
    expect(automationRulesUiSource).toContain('AutomationRuleRowActions');
  });

  it('keeps only the working automation rule table search input', () => {
    const consoleSource = readSource('../../features/console/ConfiguredConsolePage.jsx');
    const consolePageSource = extractSourceBetween(
      consoleSource,
      'function ConfiguredConsolePage',
      'function getConsolePageTabValue'
    );
    const automationRulesUiSource = readSource('../../features/console/automations/AutomationRulesTable.jsx');

    expect(consolePageSource).toContain('const shouldShowToolbar = !isAutomationsPage;');
    expect(consolePageSource).toContain('{shouldShowToolbar ? (');
    expect(automationRulesUiSource.match(/<SearchField/g)?.length ?? 0).toBe(1);
    expect(automationRulesUiSource).toContain('filterAutomationRules(rows, searchValue)');
  });

  it('wires automation rule lifecycle actions to mutations and invalidates rule queries', () => {
    const querySource = readSource('../../features/console/automations/queries.js');
    const automationRulesUiSource = readSource('../../features/console/automations/AutomationRulesTable.jsx');

    expect(querySource).toContain('useAutomationRuleEnableMutation');
    expect(querySource).toContain('useAutomationRuleDisableMutation');
    expect(querySource).toContain('useAutomationRuleArchiveMutation');
    expect(querySource).toContain('automationQueryKeys.rulesRoot');
    expect(automationRulesUiSource).toContain('enableMutation.mutateAsync');
    expect(automationRulesUiSource).toContain('disableMutation.mutateAsync');
    expect(automationRulesUiSource).toContain('archiveMutation.mutateAsync');
    expect(automationRulesUiSource).toContain('disabled={actionsDisabled || archived}');
  });

  it('declares automation rule detail/create/edit routes and shell routing', () => {
    const newRouteSource = readSource('../../app/(console)/automations/new/page.jsx');
    const detailRouteSource = readSource('../../app/(console)/automations/[ruleId]/page.jsx');
    const editRouteSource = readSource('../../app/(console)/automations/[ruleId]/edit/page.jsx');
    const routingSource = readSource('../../features/console/routing.js');
    const configSource = readSource('../../features/console/consoleConfig.js');
    const consoleSource = readSource('../../features/console/ConfiguredConsolePage.jsx');
    const automationRulesSource = readSource('../../features/console/automations/AutomationRulesTable.jsx');
    const embedOutletSource = readSource('../../features/console/ConsoleScreenOutlet.jsx');

    expect(newRouteSource).toContain('pageId="automations-new"');
    expect(detailRouteSource).toContain('pageId="automations-detail"');
    expect(editRouteSource).toContain('pageId="automations-edit"');
    expect(routingSource).toContain("'automations-new': '/automations/new'");
    expect(routingSource).toContain("'automations-detail': '/automations'");
    expect(routingSource).toContain("'automations-edit': '/automations'");
    expect(routingSource).toContain("normalizedPageId.startsWith('automations-')");
    expect(configSource).toContain("'automations-new': { title: '자동화 생성' }");
    expect(configSource).toContain("'automations-detail': { title: '자동화 상세' }");
    expect(configSource).toContain("'automations-edit': { title: '자동화 편집' }");
    expect(detailRouteSource).toContain('<AutomationRuleDetailScreen />');
    expect(newRouteSource).toContain('<AutomationRuleEditorPage mode="create" />');
    expect(editRouteSource).toContain('<AutomationRuleEditorPage mode="edit" />');
    expect(embedOutletSource).toContain('<AutomationRuleDetailPage />');
    expect(embedOutletSource).toContain('<AutomationRuleEditorPage mode="create" />');
    expect(embedOutletSource).toContain('<AutomationRuleEditorPage mode="edit" />');
    expect(consoleSource).toContain("router.push('/automations/new')");
    expect(automationRulesSource).toContain('router.push(`/automations/${encodeURIComponent(row.id)}`)');
    expect(automationRulesSource).toContain('router.push(`/automations/${encodeURIComponent(row.id)}/edit`)');
  });

  it('keeps the automation editor shell reducer-backed and wired to create/update APIs', () => {
    const apiSource = readSource('../../features/console/automations/apiClient.js');
    const querySource = readSource('../../features/console/automations/queries.js');
    const reducerSource = readSource('../../features/console/automations/ruleEditorReducer.js');
    const formSource = readSource('../../features/console/automations/AutomationRuleEditorForm.jsx');
    const editorSource = [
      readSource('../../features/console/automations/AutomationRuleEditorPage.jsx'),
      formSource,
      readSource('../../features/console/automations/AutomationRuleSendConfiguration.jsx'),
      readSource('../../features/console/automations/AutomationRuleMappingPolicy.jsx'),
      readSource('../../features/console/automations/useAutomationRuleEditorController.js'),
    ].join('\n');

    expect(apiSource).toContain('createAutomationRule');
    expect(apiSource).toContain('updateAutomationRule');
    expect(apiSource).toContain('relayPatch');
    expect(querySource).toContain('useAutomationRuleCreateMutation');
    expect(querySource).toContain('useAutomationRuleUpdateMutation');
    expect(reducerSource).toContain('automationRuleEditorReducer');
    expect(reducerSource).toContain('buildAutomationRulePayload');
    expect(editorSource).toContain('useReducer(');
    expect(editorSource).toContain('SegmentedControl');
    expect(editorSource).toContain('useSmsTemplatesQueries');
    expect(editorSource).toContain('useAlimtalkTemplatesQueries');
    expect(editorSource).toContain('useBrandTemplatesQueries');
    expect(editorSource).toContain('getSmsSenderOptions');
    expect(editorSource).toContain('getAutomationKakaoSenderProfiles');
    expect(editorSource).toContain('Basic info');
    expect(editorSource).not.toContain('Linked channel');
    expect(formSource).toContain('AutomationBuilderFlow');
    expect(formSource).toContain('AutomationTriggerNode');
    expect(formSource).toContain('AutomationActionList');
    expect(formSource).toContain('AutomationSendMessageNode');
    expect(formSource).not.toContain('Trigger event');
    expect(formSource).not.toContain('Send configuration');
    expect(formSource).not.toContain('Automation builder');
    expect(editorSource).not.toContain('Recipient mapping');
    expect(formSource).not.toContain('Variable mapping');
    expect(formSource).not.toContain('Conditions');
    expect(formSource).not.toContain('Cooldown');
    expect(formSource).not.toContain('Validation, dry-run, and activation');
  });

  it('preserves selected templates when changing the actual sender resource', () => {
    const state = createAutomationRuleEditorState({
      eventDefinitionId: 'event_1',
      name: 'Order ready',
      sendChannel: 'alimtalk',
      senderResourceId: 'kakao_1',
      templateCode: 'ORDER_READY',
      templateSource: 'SENDER_PROFILE',
    });
    const smsState = automationRuleEditorReducer(state, {
      family: 'sms',
      type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SEND_FAMILY,
    });
    const senderChangedState = automationRuleEditorReducer({
      ...state,
      draft: {
        ...state.draft,
        sendChannel: 'sms',
        senderResourceId: 'sms_1',
      },
    }, {
      senderResourceId: 'sms_2',
      type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_SENDER_RESOURCE,
    });
    const selectedTemplateState = automationRuleEditorReducer(senderChangedState, {
      sendChannel: 'lms',
      templateCode: 'SMS_NOTICE',
      templateSource: 'SENDER_PROFILE',
      type: AUTOMATION_RULE_EDITOR_ACTIONS.SELECT_TEMPLATE,
    });

    expect(smsState.draft).toMatchObject({
      sendChannel: 'sms',
      senderResourceId: '',
      templateCode: '',
      templateSource: '',
    });
    expect(senderChangedState.draft).toMatchObject({
      senderResourceId: 'sms_2',
      templateCode: 'ORDER_READY',
      templateSource: 'SENDER_PROFILE',
    });
    expect(selectedTemplateState.draft).toMatchObject({
      sendChannel: 'lms',
      templateCode: 'SMS_NOTICE',
      templateSource: 'SENDER_PROFILE',
    });
  });

  it('renders guided automation mapping policy controls without freeform policy input', () => {
    const mappingSource = readSource('../../features/console/automations/AutomationRuleMappingPolicy.jsx');
    const reducerSource = readSource('../../features/console/automations/ruleEditorReducer.js');
    const draftReducerSource = readSource('../../features/console/automations/ruleEditorDraftReducer.js');
    const policyModelSource = readSource('../../features/console/automations/automationRulePolicyModel.js');
    const selectorSource = readSource('../../features/console/automations/automationRuleMappingSelectors.js');
    const constantsSource = readSource('../../features/console/automations/ruleEditorConstants.js');
    const combinedSource = [mappingSource, reducerSource, draftReducerSource, policyModelSource, selectorSource, constantsSource].join('\n');

    expect(ALLOWED_AUTOMATION_CONDITION_OPERATORS).toEqual([
      'equals',
      'not_equals',
      'exists',
      'contains',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
    ]);
    expect(combinedSource).toContain('usePublEventsQuery');
    expect(combinedSource).toContain('targetPhoneNumber');
    expect(combinedSource).toContain('Required variables');
    expect(combinedSource).toContain('Optional variables');
    expect(combinedSource).toContain('CHANGE_EVENT_DEFINITION');
    expect(combinedSource).toContain('CHANGE_TEMPLATE_VARIABLE_MAPPING');
    expect(combinedSource).toContain('ADD_CONDITION_CLAUSE');
    expect(combinedSource).toContain('CHANGE_COOLDOWN_ENABLED');
    expect(combinedSource).toContain("all: (clauses ?? [])");
    expect(mappingSource).not.toContain('Recipient mapping');
    expect(mappingSource).not.toContain('RecipientMappingSection');
    expect(mappingSource).not.toContain('ConditionSection');
    expect(mappingSource).not.toContain('CooldownSection');
    expect(combinedSource).not.toContain('CHANGE_RECIPIENT_ALIAS');
    expect(mappingSource).not.toMatch(/quiet|delayed queue/i);
    expect(mappingSource).not.toContain('<textarea');
  });

  it('removes validation, dry-run, and activation editor surfaces from production UI', () => {
    const apiSource = readSource('../../features/console/automations/apiClient.js');
    const querySource = readSource('../../features/console/automations/queries.js');
    const formSource = readSource('../../features/console/automations/AutomationRuleEditorForm.jsx');
    const sectionIdsSource = readSource('../../features/console/automations/automationRuleEditorSectionIds.js');

    expect(existsAutomationSource('AutomationRuleExecutionPanel.jsx')).toBe(false);
    expect(existsAutomationSource('AutomationRuleDryRunPanel.jsx')).toBe(false);
    expect(existsAutomationSource('AutomationRuleValidationChecklist.jsx')).toBe(false);
    expect(existsAutomationSource('automationRuleExecutionModel.js')).toBe(false);
    expect(apiSource).not.toContain('validateAutomationRule');
    expect(apiSource).toContain('dryRunAutomationRule');
    expect(apiSource).not.toContain("'/validate'");
    expect(apiSource).toContain("'/dry-run'");
    expect(querySource).not.toContain('useAutomationRuleValidateMutation');
    expect(querySource).toContain('useAutomationRuleDryRunMutation');
    expect(querySource).toContain('invalidateAutomationRuleAndUnsentQueries');
    expect(querySource).toContain('automationQueryKeys.unsentRoot');
    expect(formSource).not.toContain('AutomationRuleExecutionPanel');
    expect(formSource).not.toContain('Validation, dry-run, and activation');
    expect(formSource).not.toContain('useAutomationRuleEnableMutation');
    expect(formSource).not.toContain('useAutomationRuleDisableMutation');
    expect(formSource).not.toContain('useAutomationRuleArchiveMutation');
    expect(sectionIdsSource).not.toContain('automation-rule-section-recipient');
    expect(sectionIdsSource).toContain('automation-rule-section-variables');
    expect(formSource).not.toContain('localStorage');
    expect(formSource).not.toContain('URLSearchParams');
    expect(formSource).not.toMatch(/\brecipientNo\b/);
    expect(formSource).not.toMatch(/\btemplateParameter\b/);
  });

  it('updates recipient, variable, condition, and cooldown policy through reducer actions', () => {
    const baseState = createAutomationRuleEditorState({
      eventDefinitionId: '',
      name: 'Order ready',
      recipientMappingJsonText: '{}',
      sendChannel: 'alimtalk',
      senderResourceId: 'kakao_1',
      templateCode: 'ORDER_READY',
      variableMappingJsonText: '{ "orderNo": "orderNo", "stale": "oldAlias" }',
    });
    const eventState = automationRuleEditorReducer(baseState, {
      defaultRecipientAlias: 'targetPhoneNumber',
      eventDefinitionId: 'event_1',
      type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_EVENT_DEFINITION,
    });
    const templateState = automationRuleEditorReducer({
      ...eventState,
      draft: {
        ...eventState.draft,
        variableMappingJsonText: '{ "orderNo": "orderNo", "stale": "oldAlias" }',
      },
    }, {
      sendChannel: 'alimtalk',
      templateCode: 'ORDER_READY_V2',
      templateVariableKeys: ['orderNo'],
      type: AUTOMATION_RULE_EDITOR_ACTIONS.SELECT_TEMPLATE,
    });
    const mappedState = automationRuleEditorReducer(templateState, {
      alias: 'orderStatus',
      templateKey: 'orderNo',
      type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_TEMPLATE_VARIABLE_MAPPING,
    });
    const conditionState = automationRuleEditorReducer(mappedState, {
      alias: 'orderStatus',
      type: AUTOMATION_RULE_EDITOR_ACTIONS.ADD_CONDITION_CLAUSE,
    });
    const cooldownState = automationRuleEditorReducer(conditionState, {
      enabled: true,
      type: AUTOMATION_RULE_EDITOR_ACTIONS.CHANGE_COOLDOWN_ENABLED,
      windowSeconds: 600,
    });

    expect(JSON.parse(eventState.draft.recipientMappingJsonText)).toEqual({ type: 'event_alias', alias: 'targetPhoneNumber' });
    expect(JSON.parse(templateState.draft.variableMappingJsonText)).toEqual({ orderNo: 'orderNo' });
    expect(JSON.parse(mappedState.draft.variableMappingJsonText)).toEqual({ orderNo: 'orderStatus' });
    expect(JSON.parse(conditionState.draft.conditionJsonText)).toEqual({
      all: [{ alias: 'orderStatus', operator: 'equals', value: '' }],
    });
    expect(JSON.parse(cooldownState.draft.cooldownPolicyJsonText)).toEqual({ enabled: true, windowSeconds: 600 });
  });

  it('declares the 미발송 automation tab with the unsent table variant', () => {
    const configSource = readSource('../../features/console/consoleConfig.js');

    expect(configSource).toContain("tabs: ['자동화', '미발송', 'publ이벤트']");
    expect(configSource).toContain("variant: 'automation-unsent'");
  });

  it('uses the console unsent API and invalidates the unsent query after actions', () => {
    const apiSource = readSource('../../features/console/automations/apiClient.js');
    const querySource = readSource('../../features/console/automations/queries.js');

    expect(apiSource).toContain("'/api/automations/unsent'");
    expect(querySource).toContain('useAutomationUnsentDeliveriesQuery');
    expect(querySource).toContain('useAutomationUnsentResendMutation');
    expect(querySource).toContain('useAutomationUnsentDismissMutation');
    expect(querySource.match(/invalidateQueries\(\{ queryKey: automationQueryKeys\.unsentRoot \}\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('does not render raw payload, encrypted payload, or raw recipient fields in the unsent tab', () => {
    const automationUiSource = readSource('../../features/console/automations/AutomationUnsentTable.jsx');
    const automationFeatureSource = [
      automationUiSource,
      readSource('../../features/console/automations/apiClient.js'),
      readSource('../../features/console/automations/queryKeys.js'),
      readSource('../../features/console/automations/queries.js'),
    ].join('\n');

    expect(automationFeatureSource).not.toMatch(
      /\b(eventPayloadCiphertext|eventPayloadIv|eventPayloadTag|encryptedPayload|rawPayload|targetPhoneNumber|recipientNo|templateParameter)\b/
    );
  });

  it('renders the unsent table as a selectable table with bulk retry and dismiss actions', () => {
    const automationUiSource = readSource('../../features/console/automations/AutomationUnsentTable.jsx');

    expect(automationUiSource).toContain('selectable');
    expect(automationUiSource).toContain('selectionVisibility="hover"');
    expect(automationUiSource).toContain('selectAllLabel="모든 미발송 항목 선택"');
    expect(automationUiSource).toContain('selectedRowLabel={({ row }) => `${row.eventDisplayName || row.eventKey || row.id} 선택`}');
    expect(automationUiSource).toContain('resendSelectedDeliveries(selectedRows, clearSelection)');
    expect(automationUiSource).toContain('dismissSelectedDeliveries(selectedRows, clearSelection)');
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function existsAutomationSource(fileName) {
  return existsSync(new URL(`../../features/console/automations/${fileName}`, import.meta.url));
}

function extractSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}

async function callList({ actorUserId = 'user_1', harness, url = UNSENT_URL } = {}) {
  return handleAutomationUnsentListRequest({
    automationService: harness.service,
    request: new Request(url),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callSend({ actorUserId = 'user_1', harness, deliveryId = 'delivery_1' } = {}) {
  return handleAutomationUnsentSendRequest({
    automationService: harness.service,
    params: Promise.resolve({ deliveryId }),
    request: new Request(`${UNSENT_URL}/${deliveryId}/send`, { method: 'POST' }),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callDismiss({ actorUserId = 'user_1', harness, deliveryId = 'delivery_1' } = {}) {
  return handleAutomationUnsentDismissRequest({
    automationService: harness.service,
    params: Promise.resolve({ deliveryId }),
    request: new Request(`${UNSENT_URL}/${deliveryId}/dismiss`, { method: 'POST' }),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callRulesList({ actorUserId = 'user_1', harness, url = RULES_URL } = {}) {
  return handleAutomationRulesListRequest({
    automationService: harness.service,
    request: new Request(url),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callRuleCreate({ actorUserId = 'user_1', harness, payload } = {}) {
  return handleAutomationRuleCreateRequest({
    automationService: harness.service,
    request: jsonRequest(RULES_URL, { method: 'POST', payload }),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callRuleDetail({ actorUserId = 'user_1', harness, ruleId = 'rule_1' } = {}) {
  return handleAutomationRuleDetailRequest({
    automationService: harness.service,
    params: Promise.resolve({ ruleId }),
    request: new Request(`${RULES_URL}/${ruleId}`),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callRuleUpdate({ actorUserId = 'user_1', harness, payload, ruleId = 'rule_1' } = {}) {
  return handleAutomationRuleUpdateRequest({
    automationService: harness.service,
    params: Promise.resolve({ ruleId }),
    request: jsonRequest(`${RULES_URL}/${ruleId}`, { method: 'PATCH', payload }),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callRuleDryRun({
  actorUserId = 'user_1',
  harness,
  payload = {},
  ruleId = 'rule_1',
  sampleEnvelope,
} = {}) {
  return handleAutomationRuleDryRunRequest({
    automationService: harness.service,
    params: Promise.resolve({ ruleId }),
    request: jsonRequest(`${RULES_URL}/${ruleId}/dry-run`, {
      method: 'POST',
      payload: { payload, sampleEnvelope },
    }),
    resolveActor: createActorResolver(actorUserId),
  });
}

async function callRuleAction({ actorUserId = 'user_1', handler, harness, ruleId = 'rule_1' } = {}) {
  return handler({
    automationService: harness.service,
    params: Promise.resolve({ ruleId }),
    request: new Request(`${RULES_URL}/${ruleId}`, { method: 'POST' }),
    resolveActor: createActorResolver(actorUserId),
  });
}

function jsonRequest(url, { method, payload }) {
  return new Request(url, {
    method,
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
    },
  });
}

function createActorResolver(userId) {
  return async () => ({
    user: { id: userId },
    userId,
  });
}

function createUnsentHarness(overrides = {}) {
  const repository = createMemoryAutomationRepository(overrides);
  const eventRepository = createMemoryPublEventRepository();
  const ledgerRepository = createMemoryLedgerRepository();
  const smsClient = createSmsClient();
  const kakaoClient = createKakaoClient();
  const messageSendService = createMessageSendService({
    kakaoClient,
    ledgerRepository,
    now: () => FIXED_NOW,
    repository,
    smsClient,
  });
  const service = createAutomationService({
    automationRepository: repository,
    messageSendService,
    now: () => FIXED_NOW,
    payloadVaultOptions: { key: TEST_KEY },
    publEventRepository: eventRepository,
    templateService: createTemplateService(),
  });

  return {
    kakaoClient,
    ledgerRepository,
    repository,
    service,
    smsClient,
  };
}

function createMemoryAutomationRepository(overrides = {}) {
  const events = overrides.events ?? [createEvent({
    props: [
      createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber' }),
      createProp({ alias: 'orderNo', rawPath: 'order.no' }),
      createProp({ alias: 'orderStatus', rawPath: 'orderStatus' }),
    ],
  })];
  const rules = overrides.rules ?? [createRule()];

  return {
    users: overrides.users ?? [createUser()],
    billingAccounts: overrides.billingAccounts ?? [createBillingAccount()],
    channelMappings: overrides.channelMappings ?? [createChannelMapping()],
    deliveries: overrides.deliveries ?? [createDeliveryRow()],
    events,
    links: overrides.links ?? [createSenderResourceLink()],
    resources: overrides.resources ?? [createSenderResource()],
    revisions: overrides.revisions ?? [],
    rules,

    async findActiveChannelMappingByCode(channelCode) {
      return this.channelMappings.find((mapping) => (
        mapping.channelCode === channelCode &&
        mapping.status === 'active'
      )) ?? null;
    },

    async listActiveRulesForUserEvent({ userId, eventDefinitionId }) {
      return this.rules.filter((rule) => (
        rule.userId === userId &&
        rule.eventDefinitionId === eventDefinitionId &&
        rule.status === 'enabled'
      ));
    },

    async listAutomationRulesForUser({ userId }) {
      return this.rules.filter((rule) => rule.userId === userId).map((rule) => toRuleDetail(this, rule));
    },

    async findAutomationRuleForUser({ ruleId, userId }) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      return toRuleDetail(this, rule);
    },

    async findEventDefinitionById(eventDefinitionId) {
      return this.events.find((event) => event.id === eventDefinitionId) ?? null;
    },

    async createAutomationRule({ values, now = FIXED_NOW } = {}) {
      const rule = {
        id: `rule_${this.rules.length + 1}`,
        createdAt: now,
        updatedAt: now,
        ...values,
      };

      this.rules.push(rule);
      return rule;
    },

    async updateAutomationRule({ ruleId, userId, values, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return null;
      Object.assign(rule, values, { updatedAt: now });
      return rule;
    },

    async enableAutomationRule({ ruleId, userId, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return { conflict: false, rule: null };

      const competing = this.rules.find((candidate) => (
        candidate.id !== rule.id &&
        candidate.userId === rule.userId &&
        candidate.eventDefinitionId === rule.eventDefinitionId &&
        candidate.status === 'enabled'
      ));

      if (competing) return { conflict: true, competingRuleId: competing.id, rule };

      Object.assign(rule, { enabledAt: now, status: 'enabled', updatedAt: now });
      return { conflict: false, rule };
    },

    async disableAutomationRule({ ruleId, userId, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return null;
      Object.assign(rule, { enabledAt: null, status: 'disabled', updatedAt: now });
      return rule;
    },

    async archiveAutomationRule({ ruleId, userId, now = FIXED_NOW } = {}) {
      const rule = this.rules.find((candidate) => candidate.id === ruleId && candidate.userId === userId);
      if (!rule) return null;
      Object.assign(rule, { archivedAt: now, enabledAt: null, status: 'archived', updatedAt: now });
      return rule;
    },

    async createAutomationRuleRevision({ values, now = FIXED_NOW } = {}) {
      const revision = {
        id: `revision_${this.revisions.length + 1}`,
        revisionNumber: this.revisions.filter((item) => item.automationRuleId === values.automationRuleId).length + 1,
        createdAt: now,
        ...values,
      };

      this.revisions.push(revision);
      return revision;
    },

    async listAutomationRuleRevisions({ automationRuleId, userId }) {
      const rule = this.rules.find((candidate) => (
        candidate.id === automationRuleId &&
        candidate.userId === userId
      ));

      if (!rule) return [];
      return this.revisions.filter((revision) => revision.automationRuleId === automationRuleId);
    },

    async listUnsentDeliverySummariesForUser({ userId, limit = 50 }) {
      return this.deliveries
        .filter((delivery) => delivery.userId === userId && delivery.status === 'unsent')
        .slice(0, limit)
        .map((delivery) => ({
          delivery: toSafeDelivery(delivery),
          eventDisplayName: this.events.find((event) => event.id === delivery.eventDefinitionId)?.displayName ?? null,
          ruleName: this.rules.find((rule) => rule.id === delivery.automationRuleId)?.name ?? null,
        }));
    },

    async findUnsentDeliveryForUser({ deliveryId, userId }) {
      const delivery = this.deliveries.find((item) => (
        item.id === deliveryId &&
        item.userId === userId &&
        item.status === 'unsent'
      ));

      return toSafeDelivery(delivery);
    },

    async findUnsentDeliveryWithEncryptedPayloadForUser({ deliveryId, userId }) {
      const delivery = this.deliveries.find((item) => (
        item.id === deliveryId &&
        item.userId === userId &&
        item.status === 'unsent'
      ));

      if (!delivery) return null;

      return {
        delivery: toSafeDelivery(delivery),
        encryptedPayload: delivery.eventPayloadCiphertext
          ? {
              eventPayloadCiphertext: delivery.eventPayloadCiphertext,
              eventPayloadIv: delivery.eventPayloadIv,
              eventPayloadTag: delivery.eventPayloadTag,
              eventPayloadVersion: delivery.eventPayloadVersion,
            }
          : null,
      };
    },

    async getUserById(userId) {
      return this.users.find((user) => user.id === userId) ?? null;
    },

    async getUserSenderResource({ userId, senderResourceId }) {
      const link = this.links.find((item) => (
        item.userId === userId &&
        item.senderResourceId === senderResourceId
      ));

      if (!link) return null;

      return {
        link,
        resource: this.resources.find((resource) => resource.id === senderResourceId) ?? null,
      };
    },

    async getBillingAccountById(billingAccountId) {
      return this.billingAccounts.find((billingAccount) => billingAccount.id === billingAccountId) ?? null;
    },

    async findBillingAccountForUser(userId) {
      return this.billingAccounts.find((billingAccount) => (
        billingAccount.ownerType === 'user' &&
        billingAccount.ownerId === userId
      )) ?? null;
    },

    async updateDelivery({ deliveryId, values, now = FIXED_NOW }) {
      const delivery = this.deliveries.find((item) => item.id === deliveryId);
      if (!delivery) return null;

      Object.assign(delivery, values, { updatedAt: now });
      return toSafeDelivery(delivery);
    },

    async markDeliverySent({ deliveryId, messageSendGroupId, now = FIXED_NOW }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          messageSendGroupId,
          reasonCode: null,
          reasonMessage: null,
          sentAt: now,
          status: 'sent',
        },
      });
    },

    async markDeliveryUnsent({ deliveryId, reasonCode, reasonMessage, now = FIXED_NOW }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          lastAttemptAt: now,
          reasonCode,
          reasonMessage,
          status: 'unsent',
        },
      });
    },

    async markDeliveryDismissed({ deliveryId, now = FIXED_NOW }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          dismissedAt: now,
          status: 'dismissed',
        },
      });
    },

    async markDeliveryFailed({ deliveryId, reasonCode, reasonMessage, now = FIXED_NOW }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          lastAttemptAt: now,
          reasonCode,
          reasonMessage,
          status: 'failed',
        },
      });
    },

    async markDeliveryPayloadPurged({ deliveryId, now = FIXED_NOW }) {
      return this.updateDelivery({
        deliveryId,
        now,
        values: {
          eventPayloadCiphertext: null,
          eventPayloadIv: null,
          eventPayloadTag: null,
          payloadPurgedAt: now,
        },
      });
    },
  };
}

function toRuleDetail(repository, rule) {
  if (!rule) return null;

  const eventDefinition = repository.events.find((event) => event.id === rule.eventDefinitionId);
  const senderResource = repository.resources.find((resource) => resource.id === rule.senderResourceId);

  return {
    ...rule,
    eventDefinition: eventDefinition
      ? {
          displayName: eventDefinition.displayName,
          eventKey: eventDefinition.eventKey,
        }
      : null,
    senderResource: senderResource
      ? {
          displayName: senderResource.displayName,
          type: senderResource.type,
        }
      : null,
  };
}

function createMemoryPublEventRepository() {
  const events = [createEvent({
    props: [
      createProp({ alias: 'targetPhoneNumber', rawPath: 'targetPhoneNumber' }),
      createProp({ alias: 'orderNo', rawPath: 'order.no' }),
      createProp({ alias: 'orderStatus', rawPath: 'orderStatus' }),
    ],
  })];

  return {
    async findEventByKey(eventKey) {
      return events.find((event) => event.eventKey === eventKey) ?? null;
    },

    async listPropsByEventId(eventId) {
      return events.find((event) => event.id === eventId)?.props ?? [];
    },
  };
}

function createTemplateService() {
  return {
    getTemplate: vi.fn(async ({ channel, templateCode }) => ({
      channel: CHANNELS.ALIMTALK,
      template: {
        channel,
        requiredVariables: ['orderNo'],
        templateCode,
        variables: [{ key: 'orderNo' }],
        buttons: [],
        quickReplies: [],
      },
    })),
  };
}

function createSmsClient() {
  return {
    sendSms: vi.fn(),
    sendMms: vi.fn(),
  };
}

function createKakaoClient() {
  return {
    sendAlimtalkMessage: vi.fn(async () => ({
      header: { isSuccessful: true, resultCode: 0, resultMessage: 'SUCCESS' },
      message: {
        requestId: 'alimtalk-request-1',
        sendResults: [{ recipientSeq: 1, resultCode: 'MRC01', resultMessage: 'SUCCESS' }],
      },
    })),
    sendBrandBasicMessage: vi.fn(),
    sendBrandFreestyleMessage: vi.fn(),
    uploadBrandImage: vi.fn(),
  };
}

function createMemoryLedgerRepository() {
  return {
    groups: [],
    providerRequests: [],
    async createGroupWithProviderRequests({ group, providerRequests = [], now }) {
      const createdGroup = {
        id: `ledger_group_${this.groups.length + 1}`,
        ...group,
        createdAt: group.createdAt ?? now,
      };
      const createdRequests = providerRequests.map((request) => ({
        id: `ledger_request_${this.providerRequests.length + 1}`,
        groupId: createdGroup.id,
        ...request,
        createdAt: now,
      }));

      this.groups.push(createdGroup);
      this.providerRequests.push(...createdRequests);

      return {
        group: createdGroup,
        providerRequests: createdRequests,
      };
    },
  };
}

function createUser(overrides = {}) {
  return {
    id: 'user_1',
    userRef: 'u1ref',
    email: 'user@example.com',
    status: 'active',
    isOperator: false,
    ...overrides,
  };
}

function createBillingAccount(overrides = {}) {
  return {
    id: 'billing_1',
    billingRef: 'b1ref',
    ownerType: 'user',
    ownerId: 'user_1',
    status: 'active',
    ...overrides,
  };
}

function createChannelMapping(overrides = {}) {
  return {
    id: 'mapping_1',
    userId: 'user_1',
    channelCode: 'store_1',
    displayName: 'Store',
    status: 'active',
    ...overrides,
  };
}

function createRule(overrides = {}) {
  return {
    id: 'rule_1',
    userId: 'user_1',
    eventDefinitionId: 'event_definition_1',
    name: 'Order ready',
    status: 'enabled',
    sendChannel: CHANNELS.ALIMTALK,
    senderResourceId: 'kakao_resource_1',
    templateCode: 'ORDER_READY',
    templateSource: 'SENDER_PROFILE',
    variableMappingJson: { orderNo: 'orderNo' },
    recipientMappingJson: { type: 'event_alias', alias: 'targetPhoneNumber' },
    conditionJson: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
    cooldownPolicyJson: { enabled: false },
    validationSnapshotJson: null,
    validatedConfigHash: null,
    lastValidatedAt: null,
    enabledAt: null,
    archivedAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function createRulePayload(overrides = {}) {
  return {
    condition: { all: [{ alias: 'orderStatus', operator: 'equals', value: 'READY' }] },
    cooldownPolicy: { enabled: false },
    eventDefinitionId: 'event_definition_1',
    name: 'Order ready',
    recipientMapping: { type: 'event_alias', alias: 'targetPhoneNumber' },
    sendChannel: CHANNELS.ALIMTALK,
    senderResourceId: 'kakao_resource_1',
    templateCode: 'ORDER_READY',
    templateSource: 'SENDER_PROFILE',
    variableMapping: { orderNo: 'orderNo' },
    ...overrides,
  };
}

function createEvent(overrides = {}) {
  return {
    id: 'event_definition_1',
    eventKey: 'order.created',
    eventType: 'publ-event',
    displayName: 'Order created',
    props: [],
    ...overrides,
  };
}

function createProp(overrides = {}) {
  return {
    sortOrder: 0,
    rawPath: 'targetPhoneNumber',
    alias: 'targetPhoneNumber',
    label: null,
    type: 'text',
    required: false,
    enabled: true,
    fallback: null,
    parserPipeline: null,
    ...overrides,
  };
}

function createSenderResource(overrides = {}) {
  return {
    id: 'kakao_resource_1',
    resourceRef: 'kakaoref1',
    provider: 'nhn',
    type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
    value: 'sender-key-1',
    displayName: '@store',
    status: 'active',
    providerStatus: 'active',
    ...overrides,
  };
}

function createSenderResourceLink(overrides = {}) {
  return {
    id: 'link_1',
    userId: 'user_1',
    senderResourceId: 'kakao_resource_1',
    billingAccountId: 'billing_1',
    role: 'sender',
    status: 'active',
    isDefault: false,
    ...overrides,
  };
}

function createDeliveryRow(overrides = {}) {
  const payload = {
    eventKey: 'order.created',
    externalEventId: 'evt_1',
    channelCode: 'store_1',
    occurredAt: '2026-06-21T00:59:00.000Z',
    order: { no: 'ORDER-123' },
    orderStatus: 'READY',
    targetPhoneNumber: '010-1234-5678',
  };

  return {
    id: 'delivery_1',
    userId: 'user_1',
    channelMappingId: 'mapping_1',
    automationRuleId: 'rule_1',
    eventDefinitionId: 'event_definition_1',
    externalEventId: 'evt_1',
    eventKey: 'order.created',
    channelCode: 'store_1',
    sendChannel: CHANNELS.ALIMTALK,
    status: 'unsent',
    reasonCode: 'missing_sender_resource',
    reasonMessage: 'The automation rule requires an active sender resource.',
    targetPhoneMasked: '010****5678',
    targetRefHash: 'hashed-target-ref',
    ...encryptAutomationEventPayload(payload, { key: TEST_KEY }),
    payloadExpiresAt: new Date('2026-06-28T01:00:00.000Z'),
    payloadPurgedAt: null,
    messageSendGroupId: null,
    receivedAt: FIXED_NOW,
    sentAt: null,
    dismissedAt: null,
    lastAttemptAt: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

function toSafeDelivery(row) {
  if (!row) return null;

  const {
    eventPayloadCiphertext,
    eventPayloadIv,
    eventPayloadTag,
    targetRefHash,
    ...safe
  } = row;

  return {
    ...safe,
    eventPayloadVersion: row.eventPayloadVersion,
  };
}
