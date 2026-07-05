import { createDefaultMessageLogService } from './service.js';
import {
  getDevSmsBulkSimulationLogGroupDetail,
  listDevSmsBulkSimulationLogGroups,
} from '../messages/smsBulkSimulationLogViews.js';
import {
  getDevSmsBulkSimulationLogRecipientDetail,
  listDevSmsBulkSimulationLogFailures,
  listDevSmsBulkSimulationLogRecipients,
} from '../messages/smsBulkSimulationLogRecipientViews.js';

export function createMessageLogRouteService({
  env = process.env,
  now = () => new Date(),
  service = createDefaultMessageLogService(),
} = {}) {
  return {
    async listLogGroups({ actorUserId, query = {} }) {
      const base = await service.listLogGroups({ actorUserId, query });
      const simulationGroups = listDevSmsBulkSimulationLogGroups({
        actorUserId,
        env,
        now: now(),
        query,
      });

      if (!simulationGroups.length) return base;

      return mergeGroupListPage({ base, query, simulationGroups });
    },

    async getLogGroupDetail({ actorUserId, groupId, query = {} }) {
      const simulationDetail = getDevSmsBulkSimulationLogGroupDetail({
        actorUserId,
        env,
        groupId,
        now: now(),
      });

      return simulationDetail ?? service.getLogGroupDetail({ actorUserId, groupId, query });
    },

    async listLogGroupRequestRecipients({ actorUserId, groupId, requestLocalId, query = {} }) {
      const simulationRecipients = listDevSmsBulkSimulationLogRecipients({
        actorUserId,
        env,
        groupId,
        now: now(),
        query,
        requestLocalId,
      });

      return simulationRecipients
        ?? service.listLogGroupRequestRecipients({ actorUserId, groupId, requestLocalId, query });
    },

    async listLogGroupRequestFailures({ actorUserId, groupId, requestLocalId, query = {} }) {
      const simulationFailures = listDevSmsBulkSimulationLogFailures({
        actorUserId,
        env,
        groupId,
        now: now(),
        query,
        requestLocalId,
      });

      return simulationFailures
        ?? service.listLogGroupRequestFailures({ actorUserId, groupId, requestLocalId, query });
    },

    async getLogGroupRequestRecipientDetail({ actorUserId, groupId, requestLocalId, recipientSeq }) {
      const simulationDetail = getDevSmsBulkSimulationLogRecipientDetail({
        actorUserId,
        env,
        groupId,
        now: now(),
        recipientSeq,
        requestLocalId,
      });

      return simulationDetail
        ?? service.getLogGroupRequestRecipientDetail({ actorUserId, groupId, requestLocalId, recipientSeq });
    },
  };
}

function mergeGroupListPage({ base, query, simulationGroups }) {
  const page = normalizePositiveInteger(query.page, base.page ?? 1);
  const pageSize = normalizePositiveInteger(query.pageSize, base.pageSize ?? 20);
  const groups = [...simulationGroups, ...(base.groups ?? [])].sort(compareGroupsDesc);
  const startIndex = (page - 1) * pageSize;

  return {
    ...base,
    page,
    pageSize,
    hasNextPage: startIndex + pageSize < Number(base.total ?? 0) + simulationGroups.length,
    total: Number(base.total ?? 0) + simulationGroups.length,
    groups: groups.slice(startIndex, startIndex + pageSize),
  };
}

function compareGroupsDesc(left, right) {
  return Date.parse(right.requestDate ?? right.createdAt ?? '') - Date.parse(left.requestDate ?? left.createdAt ?? '');
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
