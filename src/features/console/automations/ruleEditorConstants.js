export const AUTOMATION_TARGET_PHONE_ALIAS = 'targetPhoneNumber';

export const AUTOMATION_RULE_EDITOR_CHANNELS = ['sms', 'lms', 'mms', 'alimtalk', 'brand-message'];

export const AUTOMATION_RULE_EDITOR_ACTIONS = {
  ADD_CONDITION_CLAUSE: 'add_condition_clause',
  CHANGE_CONDITION_CLAUSE: 'change_condition_clause',
  CHANGE_COOLDOWN_ENABLED: 'change_cooldown_enabled',
  CHANGE_COOLDOWN_WINDOW: 'change_cooldown_window',
  CHANGE_EVENT_DEFINITION: 'change_event_definition',
  CHANGE_FIELD: 'change_field',
  CHANGE_SEND_FAMILY: 'change_send_family',
  CHANGE_SENDER_RESOURCE: 'change_sender_resource',
  CHANGE_SMS_CHANNEL: 'change_sms_channel',
  CHANGE_TEMPLATE_VARIABLE_MAPPING: 'change_template_variable_mapping',
  REMOVE_CONDITION_CLAUSE: 'remove_condition_clause',
  RESET: 'reset',
  RESET_SEND_ACTION: 'reset_send_action',
  SELECT_TEMPLATE: 'select_template',
  SUBMIT_FAILED: 'submit_failed',
  SUBMIT_STARTED: 'submit_started',
  SUBMIT_SUCCEEDED: 'submit_succeeded',
};

export const DEFAULT_AUTOMATION_RULE_DRAFT = {
  conditionJsonText: '{\n  "all": []\n}',
  cooldownPolicyJsonText: '{\n  "enabled": false\n}',
  eventDefinitionId: '',
  name: '',
  recipientMappingJsonText: `{\n  "type": "event_alias",\n  "alias": "${AUTOMATION_TARGET_PHONE_ALIAS}"\n}`,
  sendChannel: '',
  senderResourceId: '',
  templateCode: '',
  templateSource: '',
  templateSourceKey: '',
  variableMappingJsonText: '{}',
};
