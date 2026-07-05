export const automationQueryKeys = {
  rule: (ruleId) => ['automations', 'rules', 'detail', ruleId],
  rules: (filters = {}) => ['automations', 'rules', filters],
  rulesRoot: ['automations', 'rules'],
  unsent: (filters = {}) => ['automations', 'unsent', filters],
  unsentRoot: ['automations', 'unsent'],
};
