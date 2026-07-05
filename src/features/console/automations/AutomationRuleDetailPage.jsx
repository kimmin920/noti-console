'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { getRelayErrorMessage } from '../messageSend/api.js';
import { usePublEventDetailQuery } from '../publEvents/queries.js';
import {
  AutomationRuleDetailContent,
  AutomationRuleDetailHeader,
  AutomationRuleDetailSkeleton,
  AutomationRuleDetailStatus,
} from './AutomationRuleDetailSections.jsx';
import { PublOpenApiExampleDrawer } from './PublOpenApiExampleDrawer.jsx';
import { useAutomationRuleQuery } from './queries.js';

export function AutomationRuleDetailPage() {
  const params = useParams();
  const ruleId = typeof params?.ruleId === 'string' ? params.ruleId : '';
  const [openApiOpen, setOpenApiOpen] = useState(false);
  const ruleQuery = useAutomationRuleQuery(ruleId, { enabled: Boolean(ruleId) });
  const rule = ruleQuery.data?.rule ?? null;
  const eventKey = rule?.eventDefinition?.eventKey ?? '';
  const eventQuery = usePublEventDetailQuery(eventKey, { enabled: Boolean(eventKey) });
  const openApiEvent = useMemo(() => eventQuery.data ?? rule?.eventDefinition ?? null, [eventQuery.data, rule]);

  if (ruleQuery.isLoading) {
    return <AutomationRuleDetailSkeleton />;
  }

  if (ruleQuery.isError) {
    return (
      <AutomationRuleDetailStatus
        actionHref="/automations"
        actionLabel="자동화 목록"
        message={getRelayErrorMessage(ruleQuery.error, '자동화 상세를 불러오지 못했습니다.')}
        onRetry={() => ruleQuery.refetch()}
        title="자동화 상세 로드 실패"
      />
    );
  }

  if (!rule) {
    return (
      <AutomationRuleDetailStatus
        actionHref="/automations"
        actionLabel="자동화 목록"
        message="요청한 자동화 규칙을 찾을 수 없습니다."
        title="자동화가 없습니다"
      />
    );
  }

  return (
    <section className="page-frame automation-rule-detail-page">
      <AutomationRuleDetailHeader
        eventKey={eventKey}
        onOpenApi={() => setOpenApiOpen(true)}
        rule={rule}
      />
      <PublOpenApiExampleDrawer
        event={openApiEvent}
        eventKey={eventKey}
        onOpenChange={setOpenApiOpen}
        open={openApiOpen}
      />
      <AutomationRuleDetailContent
        eventKey={eventKey}
        rule={rule}
      />
    </section>
  );
}
