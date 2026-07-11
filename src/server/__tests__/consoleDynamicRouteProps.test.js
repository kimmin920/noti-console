import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { matchConsolePath, matchPublClientPath } from '../../features/console/routing.js';

const DYNAMIC_ROUTE_CASES = [
  {
    name: 'automation detail',
    pageId: 'automations-detail',
    pageProps: { automationDetail: { ruleId: 'rule-123' } },
    pathname: '/automations/rule-123',
    queryString: 'mode=embed',
    routeSource: '../../app/(console)/automations/[ruleId]/page.jsx',
    sourceNeedles: ['params', 'ruleId={ruleId}'],
  },
  {
    name: 'automation edit',
    pageId: 'automations-edit',
    pageProps: { automationDetail: { ruleId: 'rule-123' } },
    pathname: '/automations/rule-123/edit',
    queryString: 'mode=embed&tab=review',
    routeSource: '../../app/(console)/automations/[ruleId]/edit/page.jsx',
    sourceNeedles: ['params', 'ruleId={ruleId}'],
  },
  {
    name: 'PUBL event detail',
    pageId: 'publ-event-detail',
    pageProps: { publEventDetail: { eventKey: 'ORDER_READY' } },
    pathname: '/automations/publ-events/ORDER_READY',
    queryString: 'mode=embed',
    routeSource: '../../app/(console)/automations/publ-events/[eventKey]/page.jsx',
    sourceNeedles: ['params', 'eventKey={resolvedParams.eventKey}'],
  },
  {
    name: 'reservation detail',
    pageId: 'reservation-detail',
    pageProps: { reservationDetail: { groupId: 'reservation-group-1' } },
    pathname: '/reservations/reservation-group-1',
    queryString: 'channel=sms&from=2026-07-01&to=2026-07-10',
    routeSource: '../../app/(console)/reservations/[groupId]/page.jsx',
    sourceNeedles: ['params', 'groupId={groupId}'],
  },
  {
    name: 'log detail',
    pageId: 'log-detail',
    pageProps: { logDetail: { groupId: 'log-group-1' } },
    pathname: '/logs/log-group-1',
    queryString: 'channel=sms&requestLocalId=req-1',
    routeSource: '../../app/(console)/logs/[groupId]/page.jsx',
    sourceNeedles: ['params', 'groupId={groupId}'],
  },
  {
    name: 'template detail',
    pageId: 'templates-detail',
    pageProps: {
      templateDetail: {
        channel: 'alimtalk',
        query: {
          senderResourceId: 'sender-1',
          source: 'SENDER_PROFILE',
          sourceKey: 'sender-key-1',
        },
        templateCode: 'ORDER_READY',
      },
    },
    pathname: '/templates/alimtalk/ORDER_READY',
    queryString: 'senderResourceId=sender-1&source=SENDER_PROFILE&sourceKey=sender-key-1',
    routeSource: '../../app/(console)/templates/[channel]/[templateCode]/page.jsx',
    sourceNeedles: ['params', 'channel={resolvedParams.channel}', 'templateCode={resolvedParams.templateCode}', 'query'],
  },
];

const EMBED_SUPPORTED_DETAIL_COMPONENTS = [
  '../../features/console/automations/AutomationRuleDetailPage.jsx',
  '../../features/console/automations/AutomationRuleEditorPage.jsx',
  '../../features/console/messageReservations/MessageReservationDetailPage.jsx',
];

describe('console dynamic route props', () => {
  it.each(DYNAMIC_ROUTE_CASES)(
    'matches standalone and Publ catch-all route data for $name',
    ({ pageId, pageProps, pathname, queryString }) => {
      const expected = {
        canonicalPathname: pathname,
        ok: true,
        pageId,
        pageProps,
        queryString,
      };

      expect(matchConsolePath(`${pathname}?${queryString}`)).toEqual(expected);
      expect(matchPublClientPath(`/publ-client${pathname}?${queryString}`)).toEqual(expected);
    }
  );

  it.each(DYNAMIC_ROUTE_CASES)(
    'standalone $name route forwards explicit dynamic props',
    ({ routeSource, sourceNeedles }) => {
      const source = readSource(routeSource);

      for (const needle of sourceNeedles) {
        expect(source).toContain(needle);
      }
    }
  );

  it('passes explicit dynamic props from the embed outlet to supported leaf pages', () => {
    const source = readSource('../../features/console/ConsoleScreenOutlet.jsx');

    expect(source).toContain('const automationDetail = pageProps?.automationDetail');
    expect(source).toContain('const reservationDetail = pageProps?.reservationDetail');
    expect(source).toContain('<AutomationRuleDetailPage ruleId={automationDetail.ruleId}');
    expect(source).toContain('<AutomationRuleEditorPage mode="edit" ruleId={automationDetail.ruleId}');
    expect(source).toContain('<MessageReservationDetailPage groupId={reservationDetail.groupId}');
  });

  it('keeps embed-supported detail components off Next dynamic params', () => {
    for (const componentPath of EMBED_SUPPORTED_DETAIL_COMPONENTS) {
      const source = readSource(componentPath);

      expect(source).not.toContain('useParams(');
      expect(source).not.toContain("useParams }");
      expect(source).not.toContain("useParams,");
    }
  });

  it('does not enable affected detail queries with an empty route id', () => {
    const automationDetailSource = readSource('../../features/console/automations/AutomationRuleDetailPage.jsx');
    const automationEditorSource = readSource('../../features/console/automations/AutomationRuleEditorPage.jsx');
    const reservationSource = readSource('../../features/console/messageReservations/MessageReservationDetailPage.jsx');

    expect(automationDetailSource).toContain('if (!ruleId)');
    expect(automationDetailSource).toContain('useAutomationRuleQuery(ruleId, { enabled: Boolean(ruleId) })');
    expect(automationEditorSource).toContain('if (editing && !ruleId)');
    expect(automationEditorSource).toContain('useAutomationRuleQuery(ruleId, { enabled: editing && Boolean(ruleId) })');
    expect(reservationSource).toContain('if (!groupId)');
    expect(reservationSource).toContain('useMessageReservationGroupDetailQuery(detailSelection, {');
    expect(reservationSource).toContain('enabled: Boolean(groupId)');
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
