import { getDb } from '../../db/client.js';
import { RELAY_ERROR_CODES } from '../relay/constants.js';
import { RelayError } from '../relay/errors.js';
import { normalizeMetricsQuery } from './filters.js';
import { createMetricsRepository } from './repository.js';
import { buildMetricsSummary } from './summary.js';

const ACTIVE_USER_STATUS = 'active';
const SMS_SCOPED_CHANNELS = new Set(['sms', 'lms', 'mms']);

export function createDefaultMetricsService() {
  return createMetricsService({
    repository: createMetricsRepository(getDb()),
  });
}

export function createMetricsService({ repository, now = () => new Date() }) {
  return {
    async getSummary({ actorUserId, query = {} } = {}) {
      const user = await repository.getUserById(actorUserId);
      if (!user || user.status !== ACTIVE_USER_STATUS) {
        throw new RelayError({
          code: RELAY_ERROR_CODES.FORBIDDEN,
          message: '발송 현황을 조회할 권한이 없습니다.',
          retryable: false,
          status: 403,
        });
      }

      const filters = normalizeMetricsQuery(query, now());
      const repositoryFilters = {
        channel: filters.channels.length === 1 ? filters.channels[0] : null,
        channels: filters.channels,
        from: filters.period.from,
        sourceType: filters.source === 'all' ? null : filters.source,
        to: filters.period.to,
        userId: user.id,
      };
      const [
        messageSendGroups,
        automationDeliveries,
        bulkRuns,
        quotaBuckets,
      ] = await Promise.all([
        repository.listMessageSendGroupsForMetrics(repositoryFilters),
        filters.source === 'manual'
          ? []
          : repository.listAutomationDeliveriesForMetrics(repositoryFilters),
        shouldReadSmsBulkRuns(filters)
          ? repository.listSmsBulkRunsForMetrics(repositoryFilters)
          : [],
        shouldReadSmsQuotaBuckets(filters)
          ? repository.listSmsQuotaBucketsForMetrics({ now: filters.generatedAt, userId: user.id })
          : [],
      ]);

      return buildMetricsSummary({
        automationDeliveries,
        bulkRuns,
        filters,
        messageSendGroups,
        quotaBuckets,
      });
    },
  };
}

function shouldReadSmsBulkRuns(filters) {
  return filters.source !== 'automation' && isSmsScopedChannel(filters.channel);
}

function shouldReadSmsQuotaBuckets(filters) {
  return isSmsScopedChannel(filters.channel);
}

function isSmsScopedChannel(channel) {
  const channels = channel === 'all' ? [] : channel.split(',');
  return channels.length === 0 || channels.some((item) => SMS_SCOPED_CHANNELS.has(item));
}
