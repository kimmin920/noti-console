import type { ExportEntity, ExportFieldConfig, ExportFieldId } from './types';

export const defaultExportConfirmationMessage =
  'Confirm the filters you want to apply before exporting.';

export const exportEntityTitles: Record<ExportEntity, string> = {
  apiKeys: 'Export API keys',
  broadcasts: 'Export broadcasts',
  contacts: 'Export contacts',
  domains: 'Export domains',
  inboundEmails: 'Export received emails',
  logs: 'Export logs',
  outboundEmails: 'Export sent emails',
};

export const exportDisabledLabels: Record<ExportEntity, string> = {
  apiKeys: 'Only admins can export API keys',
  broadcasts: 'Only admins can export broadcasts',
  contacts: 'Only admins can export contacts',
  domains: 'Only admins can export domains',
  inboundEmails: 'Only admins can export emails',
  logs: 'Only admins can export logs',
  outboundEmails: 'Only admins can export emails',
};

export const exportFieldPresets: Record<ExportEntity, readonly ExportFieldId[]> = {
  apiKeys: ['permission'],
  broadcasts: ['status', 'audience'],
  contacts: ['status'],
  domains: ['status'],
  inboundEmails: ['date', 'timezone'],
  logs: ['date', 'timezone'],
  outboundEmails: ['date', 'timezone', 'status', 'apiKey'],
};

export const exportFieldConfigs: Record<ExportFieldId, ExportFieldConfig> = {
  apiKey: {
    defaultValue: 'all',
    id: 'apiKey',
    label: 'API key',
    options: [
      { label: 'All API keys', value: 'all' },
      { label: 'Production', value: 'production' },
      { label: 'Staging', value: 'staging' },
    ],
  },
  audience: {
    defaultValue: 'all',
    id: 'audience',
    label: 'Audience',
    options: [
      { label: 'All audiences', value: 'all' },
      { label: 'Marketing', value: 'marketing' },
      { label: 'Product updates', value: 'product-updates' },
    ],
  },
  date: {
    defaultValue: 'last-15-days',
    id: 'date',
    label: 'Date',
    options: [
      { label: 'Last 24 hours', value: 'last-24-hours' },
      { label: 'Last 7 days', value: 'last-7-days' },
      { label: 'Last 15 days', value: 'last-15-days' },
      { label: 'Last 30 days', value: 'last-30-days' },
    ],
  },
  permission: {
    defaultValue: 'all',
    id: 'permission',
    label: 'Permission',
    options: [
      { label: 'All permissions', value: 'all' },
      { label: 'Full access', value: 'full' },
      { label: 'Sending access', value: 'sending' },
    ],
  },
  status: {
    defaultValue: 'all',
    id: 'status',
    label: 'Status',
    options: [
      { label: 'All Statuses', value: 'all' },
      { label: 'Delivered', value: 'delivered' },
      { label: 'Bounced', value: 'bounced' },
      { label: 'Complained', value: 'complained' },
      { label: 'Queued', value: 'queued' },
    ],
  },
  timezone: {
    defaultValue: 'utc',
    id: 'timezone',
    label: 'Timezone',
    options: [
      { label: 'UTC', value: 'utc' },
      { label: 'America/New_York', value: 'america-new-york' },
      { label: 'Europe/London', value: 'europe-london' },
      { label: 'Asia/Seoul', value: 'asia-seoul' },
    ],
  },
};
