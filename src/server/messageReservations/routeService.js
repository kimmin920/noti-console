import {
  createDefaultMessageReservationRepository,
  createDefaultMessageReservationService,
  createMessageReservationService,
} from './service.js';
import {
  createDevMessageReservationMockDependencies,
  isDevMessageReservationsMockQuery,
} from './devMock.js';
import {
  getDevSmsBulkSimulationReservationBatchRecipients,
  getDevSmsBulkSimulationReservationDetail,
  listDevSmsBulkSimulationReservationGroups,
} from '../messages/smsBulkSimulationReservationViews.js';

export function createMessageReservationRouteService(query = {}, {
  env = process.env,
  now = () => new Date(),
  service: providedService,
} = {}) {
  const service = providedService ?? (isDevMessageReservationsMockQuery(query)
    ? createMessageReservationService(
      createDevMessageReservationMockDependencies({
        repository: createDefaultMessageReservationRepository(),
      })
    )
    : createDefaultMessageReservationService());

  return createSimulationAwareReservationService({ env, now, service });
}

function createSimulationAwareReservationService({ env, now, service }) {
  return {
    async listReservationGroups({ actorUserId, query = {} }) {
      const base = await service.listReservationGroups({ actorUserId, query });
      const simulationGroups = listDevSmsBulkSimulationReservationGroups({
        actorUserId,
        env,
        now: now(),
        query,
      });

      if (!simulationGroups.length) return base;

      return mergeGroupListPage({ base, query, simulationGroups });
    },

    async getReservationGroupDetailById({ actorUserId, groupId, query = {} }) {
      const simulationDetail = getDevSmsBulkSimulationReservationDetail({
        actorUserId,
        env,
        groupId,
        now: now(),
      });

      return simulationDetail ?? service.getReservationGroupDetailById({ actorUserId, groupId, query });
    },

    async getReservationBatchRecipients({ actorUserId, groupId, providerRequestId, query = {} }) {
      const simulationRecipients = getDevSmsBulkSimulationReservationBatchRecipients({
        actorUserId,
        env,
        groupId,
        now: now(),
        providerRequestId,
        query,
      });

      return simulationRecipients
        ?? service.getReservationBatchRecipients({ actorUserId, groupId, providerRequestId, query });
    },

    async cancelReservationGroupById({ actorUserId, groupId, query = {} }) {
      const simulationDetail = getDevSmsBulkSimulationReservationDetail({
        actorUserId,
        env,
        groupId,
        now: now(),
      });

      if (simulationDetail) {
        return createSimulationCancelResult(groupId, simulationDetail.group);
      }

      return service.cancelReservationGroupById({ actorUserId, groupId, query });
    },

    getReservationGroupDetail: service.getReservationGroupDetail?.bind(service),
    cancelReservationGroup: service.cancelReservationGroup?.bind(service),
  };
}

function createSimulationCancelResult(groupId, group) {
  const cancelableCount = Number(group.reservedCount ?? 0) + Number(group.sendingCount ?? 0);
  const totalCount = Number(group.recipientCount ?? 0);

  return {
    canceledCount: cancelableCount,
    channel: group.channel,
    groupId,
    provider: {
      canceledCount: cancelableCount,
      requestedCount: cancelableCount,
    },
    requestedCount: cancelableCount,
    skippedCount: totalCount - cancelableCount,
    state: cancelableCount > 0 ? 'canceled' : 'noop',
    targetCount: cancelableCount,
    totalCount,
  };
}

function mergeGroupListPage({ base, query, simulationGroups }) {
  const page = normalizePositiveInteger(query.page, base.page ?? 1);
  const pageSize = normalizePositiveInteger(query.pageSize, base.pageSize ?? 20);
  const groups = [...simulationGroups, ...(base.groups ?? [])].sort(compareGroupsAsc);
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

function compareGroupsAsc(left, right) {
  return Date.parse(left.requestDate ?? left.createDate ?? '') - Date.parse(right.requestDate ?? right.createDate ?? '');
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
