import {
  CHANNELS,
  formatZonedDate,
  getZonedDayStart,
  METRICS_TIME_ZONE,
  SOURCE_TYPES,
} from './filters.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STATUS_ATTENTION_RESULT_STATES = new Set(['stale', 'error']);
const RUNNING_BULK_STATUSES = new Set(['queued', 'running']);
const ZERO_TOTALS = Object.freeze({
  canceledCount: 0,
  failedCount: 0,
  pendingCount: 0,
  recipientCount: 0,
  sendGroupCount: 0,
  successCount: 0,
});

export function buildMetricsSummary({ automationDeliveries, bulkRuns, filters, messageSendGroups, quotaBuckets }) {
  const timeSeries = createTimeSeries(filters.period.from, filters.period.to);
  const totals = createTotals();
  const channelMap = createSeededMap(CHANNELS, createTotals);
  const sourceMap = createSeededMap(SOURCE_TYPES, createTotals);
  const senderMap = new Map();
  const resultAttention = { staleOrErrorCount: 0 };

  for (const group of messageSendGroups) {
    const counts = getGroupCounts(group);
    addCounts(totals, counts);
    totals.sendGroupCount += 1;
    incrementBreakdown(channelMap, group.channel, counts);
    incrementBreakdown(sourceMap, group.sourceType, counts);
    incrementSender(senderMap, group, counts);

    const bucket = timeSeries.find((item) => item.bucket === formatZonedDate(group.scheduledAt ?? group.createdAt));
    if (bucket) addCounts(bucket, counts);
    if (STATUS_ATTENTION_RESULT_STATES.has(group.resultState)) resultAttention.staleOrErrorCount += 1;
  }

  const automation = summarizeAutomationDeliveries(automationDeliveries);
  const bulk = summarizeBulkRuns(bulkRuns);
  const quota = summarizeQuotaBuckets(quotaBuckets);

  return {
    alerts: buildAlerts({ automation, bulk, quota, resultAttention }),
    automation,
    bulk,
    channelBreakdown: finalizeBreakdown(channelMap, filters.channels),
    generatedAt: filters.generatedAt.toISOString(),
    period: {
      from: filters.period.from.toISOString(),
      granularity: filters.granularity,
      range: filters.period.range,
      timeZone: METRICS_TIME_ZONE,
      to: filters.period.to.toISOString(),
    },
    quota,
    senderBreakdown: finalizeSenderBreakdown(senderMap),
    sourceBreakdown: finalizeBreakdown(sourceMap, filters.source),
    timeSeries: timeSeries.map(withRates),
    totals: withRates(totals),
  };
}

function createTimeSeries(from, to) {
  const buckets = [];
  for (let cursor = getZonedDayStart(from); cursor <= to; cursor = new Date(cursor.getTime() + MS_PER_DAY)) {
    buckets.push({
      bucket: formatZonedDate(cursor),
      ...createTotals(),
    });
  }
  return buckets;
}

function createTotals() {
  return { ...ZERO_TOTALS };
}

function getGroupCounts(group) {
  return {
    canceledCount: toCount(group.canceledCount),
    failedCount: toCount(group.failedCount),
    pendingCount: toCount(group.pendingCount),
    recipientCount: toCount(group.totalRecipientCount),
    sendGroupCount: 0,
    successCount: toCount(group.successCount),
  };
}

function addCounts(target, counts) {
  target.canceledCount += counts.canceledCount;
  target.failedCount += counts.failedCount;
  target.pendingCount += counts.pendingCount;
  target.recipientCount += counts.recipientCount;
  target.successCount += counts.successCount;
}

function incrementBreakdown(map, key, counts) {
  const item = map.get(key) ?? createTotals();
  addCounts(item, counts);
  item.sendGroupCount += 1;
  map.set(key, item);
}

function incrementSender(map, group, counts) {
  const key = group.senderResourceId ?? 'unknown';
  const item = map.get(key) ?? {
    ...createTotals(),
    senderResourceId: key,
    senderResourceLabel: group.senderResourceLabel ?? '이름 없는 발신 리소스',
  };
  addCounts(item, counts);
  item.sendGroupCount += 1;
  map.set(key, item);
}

function summarizeAutomationDeliveries(deliveries) {
  const summary = {
    dismissedCount: 0,
    failedCount: 0,
    processingCount: 0,
    receivedCount: deliveries.length,
    sentCount: 0,
    topUnsentReasons: [],
    unsentCount: 0,
  };
  const unsentReasons = new Map();

  for (const delivery of deliveries) {
    if (delivery.status === 'sent') summary.sentCount += 1;
    else if (delivery.status === 'unsent') {
      summary.unsentCount += 1;
      const reasonCode = delivery.reasonCode || 'unknown';
      unsentReasons.set(reasonCode, (unsentReasons.get(reasonCode) ?? 0) + 1);
    } else if (delivery.status === 'failed') summary.failedCount += 1;
    else if (delivery.status === 'dismissed') summary.dismissedCount += 1;
    else summary.processingCount += 1;
  }

  summary.topUnsentReasons = [...unsentReasons.entries()]
    .map(([reasonCode, count]) => ({ count, reasonCode }))
    .sort((a, b) => b.count - a.count || a.reasonCode.localeCompare(b.reasonCode))
    .slice(0, 5);

  return summary;
}

function summarizeBulkRuns(runs) {
  return runs.reduce((summary, run) => {
    summary.acceptedCount += toCount(run.acceptedCount);
    summary.failedCount += toCount(run.failedCount);
    summary.rejectedCount += toCount(run.rejectedCount);
    summary.totalRecipients += toCount(run.totalRecipients);
    summary.unknownCount += toCount(run.unknownCount);
    if (RUNNING_BULK_STATUSES.has(run.status)) summary.runningRuns += 1;
    if (run.status === 'blocked') summary.blockedRuns += 1;
    if (run.status === 'unknown') summary.unknownRuns += 1;
    return summary;
  }, {
    acceptedCount: 0,
    blockedRuns: 0,
    failedCount: 0,
    rejectedCount: 0,
    runningRuns: 0,
    totalRecipients: 0,
    unknownCount: 0,
    unknownRuns: 0,
  });
}

function summarizeQuotaBuckets(buckets) {
  const smsBuckets = buckets.filter((bucket) => bucket.channel === 'sms');
  if (!smsBuckets.length) return { sms: null };
  const limit = smsBuckets.reduce((total, bucket) => total + toCount(bucket.quotaLimit), 0);
  const consumed = smsBuckets.reduce((total, bucket) => total + toCount(bucket.consumedCount), 0);
  const reserved = smsBuckets.reduce((total, bucket) => total + toCount(bucket.reservedCount), 0);
  const used = consumed + reserved;
  const remaining = Math.max(limit - used, 0);

  return {
    sms: {
      limit,
      remaining,
      used,
      usedRate: rate(used, limit),
    },
  };
}

function buildAlerts({ automation, bulk, quota, resultAttention }) {
  const alerts = [];
  if (resultAttention.staleOrErrorCount > 0) {
    alerts.push({ code: 'result_sync_attention', href: '/logs', level: 'warning', message: '결과 동기화 확인이 필요한 발송이 있습니다.' });
  }
  if (automation.unsentCount + automation.failedCount > 0) {
    alerts.push({ code: 'automation_attention', href: '/automations?tab=unsent', level: 'warning', message: '확인해야 할 자동화 미발송 또는 실패가 있습니다.' });
  }
  if (bulk.blockedRuns + bulk.unknownRuns > 0) {
    alerts.push({ code: 'sms_bulk_attention', href: '/reservations?channel=sms', level: 'warning', message: '대량 발송 처리 상태를 확인해 주세요.' });
  }
  if (quota.sms && quota.sms.remaining <= Math.max(100, quota.sms.limit * 0.1)) {
    alerts.push({ code: 'sms_quota_low', href: '/message-send', level: 'warning', message: 'SMS 대량 발송 쿼터 잔여량이 낮습니다.' });
  }
  return alerts;
}

function finalizeBreakdown(map, activeFilter) {
  const activeKeys = Array.isArray(activeFilter) ? new Set(activeFilter) : null;
  return [...map.entries()]
    .filter(([key, item]) => activeKeys
      ? (activeKeys.size === 0 ? item.recipientCount > 0 : activeKeys.has(key))
      : (activeFilter === 'all' ? item.recipientCount > 0 : key === activeFilter))
    .map(([key, item]) => ({
      ...withRates(item),
      channel: CHANNELS.includes(key) ? key : undefined,
      sourceType: SOURCE_TYPES.includes(key) ? key : undefined,
    }))
    .sort((a, b) => b.recipientCount - a.recipientCount);
}

function finalizeSenderBreakdown(map) {
  return [...map.values()]
    .map(withRates)
    .sort((a, b) => b.failedCount - a.failedCount || b.recipientCount - a.recipientCount)
    .slice(0, 8);
}

function withRates(item) {
  const resolvedCount = item.successCount + item.failedCount + item.canceledCount;
  return {
    ...item,
    confirmedSuccessRate: rate(item.successCount, resolvedCount),
    failureRate: rate(item.failedCount, item.recipientCount),
    successRate: rate(item.successCount, item.recipientCount),
  };
}

function createSeededMap(keys, createValue) {
  return new Map(keys.map((key) => [key, createValue()]));
}

function toCount(value) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function rate(part, total) {
  return total > 0 ? part / total : 0;
}
