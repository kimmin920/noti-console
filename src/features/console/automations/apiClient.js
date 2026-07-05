'use client';

import { relayGet, relayPatch, relayPost, withQuery } from '../messageSend/api.js';

const AUTOMATION_UNSENT_PATH = '/api/automations/unsent';
const AUTOMATION_RULES_PATH = '/api/automations/rules';

function automationRulePath(ruleId, suffix = '') {
  return `${AUTOMATION_RULES_PATH}/${encodeURIComponent(ruleId)}${suffix}`;
}

export function listAutomationUnsentDeliveries({ limit } = {}) {
  return relayGet(withQuery(AUTOMATION_UNSENT_PATH, { limit }));
}

export function listAutomationRules({ limit, offset, status } = {}) {
  return relayGet(withQuery(AUTOMATION_RULES_PATH, {
    limit,
    offset,
    status: status === 'all' ? undefined : status,
  }));
}

export function getAutomationRule(ruleId) {
  return relayGet(automationRulePath(ruleId));
}

export function createAutomationRule(payload) {
  return relayPost(AUTOMATION_RULES_PATH, payload);
}

export function updateAutomationRule(ruleId, payload) {
  return relayPatch(automationRulePath(ruleId), payload);
}

export function enableAutomationRule(ruleId) {
  return relayPost(automationRulePath(ruleId, '/enable'), {});
}

export function disableAutomationRule(ruleId) {
  return relayPost(automationRulePath(ruleId, '/disable'), {});
}

export function archiveAutomationRule(ruleId) {
  return relayPost(automationRulePath(ruleId, '/archive'), {});
}

export function dryRunAutomationRule(ruleId, payload) {
  return relayPost(automationRulePath(ruleId, '/dry-run'), payload);
}

export function resendAutomationUnsentDelivery(deliveryId) {
  return relayPost(`${AUTOMATION_UNSENT_PATH}/${encodeURIComponent(deliveryId)}/send`, {});
}

export function dismissAutomationUnsentDelivery(deliveryId) {
  return relayPost(`${AUTOMATION_UNSENT_PATH}/${encodeURIComponent(deliveryId)}/dismiss`, {});
}
