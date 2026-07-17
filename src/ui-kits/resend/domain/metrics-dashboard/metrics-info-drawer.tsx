import { CircleHelp, ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { Drawer } from '../../primitives/drawer';
import { Text } from '../../primitives/typography';

type MetricsInfoKind = 'bounce' | 'click' | 'complaint' | 'deliverability' | 'engagement' | 'open' | 'reputation';

type MetricsInfoDrawerProps = {
  readonly kind: MetricsInfoKind;
};

const titles: Record<MetricsInfoKind, string> = {
  bounce: '실패율 계산 방식',
  click: '클릭률 계산 방식',
  complaint: '신고율 계산 방식',
  deliverability: '발송 성공률 계산 방식',
  engagement: '수신자 반응률 계산 방식',
  open: '열림율 계산 방식',
  reputation: '발송 품질 계산 방식',
};

function MetricsInfoDrawer({ kind }: MetricsInfoDrawerProps) {
  const title = titles[kind];
  return (
    <Drawer.Root>
      <Drawer.Trigger>
        <button aria-label={title} className="resend-ui-metrics-dashboard__info" type="button">
          <CircleHelp aria-hidden="true" size={20} />
        </button>
      </Drawer.Trigger>
      <Drawer.Content className="resend-ui-metrics-info-drawer" closeLabel="닫기" title={title}>
        <div className="resend-ui-metrics-info-drawer__content">
          <MetricsInfoContent kind={kind} />
        </div>
      </Drawer.Content>
    </Drawer.Root>
  );
}

function MetricsInfoContent({ kind }: MetricsInfoDrawerProps) {
  if (kind === 'deliverability') return <DeliverabilityInfo />;
  if (kind === 'reputation') return <ReputationInfo />;
  if (kind === 'engagement') return <EngagementInfo />;
  if (kind === 'bounce') return <BounceInfo />;
  if (kind === 'complaint') return <ComplaintInfo />;
  if (kind === 'open') return <OpenInfo />;
  return <ClickInfo />;
}

function DeliverabilityInfo() {
  return <>
    <Paragraph>발송 성공률은 전체 발송 대상 중 제공사가 성공으로 처리한 비율입니다.</Paragraph>
    <InfoSection title="무엇이 발송 성공률에 영향을 주나요?"><InfoList items={['발신 신뢰도: 제공사가 판단하는 기존 발송 이력입니다.', '발신 수단 설정: 등록된 발신번호와 카카오 채널이 정상 상태여야 합니다.', '메시지 내용: 정책에 맞는 내용과 올바른 수신자 정보가 필요합니다.']} /></InfoSection>
    <InfoSection title="어떻게 계산하나요?"><Formula>발송 성공률 = 성공 건수 / 발송 대상 건수 x 100</Formula></InfoSection>
    <InfoSection title="평가 기준"><InfoList items={['주의: 95% 미만', '보통: 95~96.9%', '좋음: 97~98.9%', '매우 좋음: 99% 이상']} /></InfoSection>
    <Articles items={[['발송 성공률 안내', 'https://resend.com/docs/dashboard/emails/deliverability-insights'], ['발송 성공률 개선 팁', 'https://resend.com/blog/top-10-email-deliverability-tips']]} />
  </>;
}

function ReputationInfo() {
  return <>
    <Paragraph>발송 품질은 실패와 신고가 얼마나 낮게 유지되는지를 보여주는 지표입니다.</Paragraph>
    <InfoSection title="무엇이 발송 품질에 영향을 주나요?"><InfoList items={['실패율: 전체 발송 대상 중 발송에 실패한 비율입니다.', '신고율: 전체 발송 대상 중 신고된 비율입니다.']} /></InfoSection>
    <InfoSection title="어떻게 계산하나요?"><InfoList items={['실패율: 실패 건수 / 발송 대상 건수 x 100', '신고율: 신고 건수 / 발송 대상 건수 x 100']} /></InfoSection>
    <InfoSection title="평가 기준"><InfoList items={['매우 좋음: 실패율 1% 미만, 신고율 0.01% 미만', '좋음: 실패율 1~1.9%, 신고율 0.03% 미만', '보통: 실패율 2~3.9%, 신고율 0.08% 미만', '주의: 실패율 4% 이상 또는 신고율 0.08% 이상']} /></InfoSection>
    <Articles items={[['발송 실패 안내', 'https://resend.com/docs/dashboard/emails/email-bounces'], ['발송 성공률 안내', 'https://resend.com/docs/dashboard/emails/deliverability-insights']]} />
  </>;
}

function EngagementInfo() {
  return <>
    <Paragraph>수신자 반응은 열림, 클릭, 수신 거부 등 수신자가 메시지와 상호작용한 결과를 보여줍니다.</Paragraph>
    <InfoSection title="무엇이 수신자 반응에 영향을 주나요?"><InfoList items={['열림율: 수신자가 메시지를 열어 본 비율입니다.', '클릭률: 수신자가 메시지의 링크를 누른 비율입니다.', '수신 거부율: 메시지를 받은 뒤 수신 거부한 수신자의 비율입니다.']} /></InfoSection>
    <InfoSection title="어떻게 계산하나요?"><Formula>열림율 = 열림 건수 / 발송 성공 건수 x 100</Formula><Text as="p">채널이 열림과 클릭 데이터를 제공하지 않으면 미집계로 표시됩니다.</Text></InfoSection>
    <InfoSection title="평가 기준"><InfoList items={['주의: 25% 미만', '보통: 25~39.9%', '좋음: 40~59.9%', '매우 좋음: 60% 이상']} /></InfoSection>
    <Articles items={[['열림율 안내', 'https://resend.com/docs/knowledge-base/why-are-my-open-rates-not-accurate'], ['수신 거부 링크 안내', 'https://resend.com/docs/knowledge-base/should-i-add-an-unsubscribe-link']]} />
  </>;
}

function BounceInfo() {
  return <>
    <Paragraph>실패는 메시지가 수신자에게 정상적으로 전달되지 못한 경우입니다.</Paragraph>
    <InfoSection title="어떤 실패가 있나요?"><InfoList items={['영구 실패: 잘못된 수신자 정보나 수신 거부 등으로 다시 발송해도 성공하기 어려운 경우입니다.', '일시 실패: 제공사 장애나 수신자 상태 등 일시적인 이유로 실패한 경우입니다.', '원인 미상: 제공사가 명확한 실패 사유를 제공하지 않은 경우입니다.']} /></InfoSection>
    <InfoSection title="주의 기준은 무엇인가요?"><Paragraph>실패율이 4% 이상으로 유지되면 발송 대상과 실패 사유를 확인해야 합니다.</Paragraph></InfoSection>
    <InfoSection title="어떻게 계산하나요?"><Formula>실패율 = 실패 건수 / 발송 대상 건수 x 100</Formula></InfoSection>
    <Articles items={[['실패율을 낮추는 방법', 'https://resend.com/docs/knowledge-base/resend-sending-limits#bounce-rate'], ['발송 실패 안내', 'https://resend.com/docs/dashboard/emails/email-bounces']]} />
  </>;
}

function ComplaintInfo() {
  return <>
    <Paragraph>신고는 메시지가 성공적으로 전달된 후 수신자가 스팸으로 신고한 경우입니다.</Paragraph>
    <InfoSection title="신고가 중요한 이유는 무엇인가요?"><InfoList items={['발신 신뢰도: 신고율이 높으면 발신 신뢰도가 낮아집니다.', '전달 영향: 제공사가 향후 메시지를 차단하거나 필터링할 수 있습니다.', '피드백: 제공사가 신고 결과를 발신자에게 전달합니다.']} /></InfoSection>
    <InfoSection title="주의 기준은 무엇인가요?"><Paragraph>신고율이 0.08% 이상으로 유지되면 메시지 내용과 발송 대상을 확인해야 합니다.</Paragraph></InfoSection>
    <InfoSection title="어떻게 계산하나요?"><Formula>신고율 = 신고 건수 / 발송 대상 건수 x 100</Formula></InfoSection>
    <Articles items={[['발송 성공률 안내', 'https://resend.com/docs/dashboard/emails/deliverability-insights']]} />
  </>;
}

function OpenInfo() {
  return <>
    <Paragraph>열림은 수신자가 메시지를 열어 본 경우입니다. 열림율은 전체 성공 건수 중 수신자가 열어 본 비율입니다.</Paragraph>
    <InfoSection title="어떻게 계산하나요?"><Formula>열림율 = 고유 열림 건수 / 발송 성공 건수 x 100</Formula><Text as="p">열림과 전달은 각각 발생한 날짜를 기준으로 집계합니다.</Text></InfoSection>
    <Paragraph>채널이 열림 데이터를 제공하는 경우에만 집계됩니다.</Paragraph>
    <Articles items={[['열림 추적 방식', 'https://resend.com/blog/open-and-click-tracking#how-open-tracking-works'], ['열림율 안내', 'https://resend.com/docs/knowledge-base/why-are-my-open-rates-not-accurate']]} />
  </>;
}

function ClickInfo() {
  return <>
    <Paragraph>클릭은 수신자가 메시지의 링크를 누른 경우입니다. 클릭률은 전체 성공 건수 중 수신자가 링크를 누른 비율입니다.</Paragraph>
    <InfoSection title="어떻게 계산하나요?"><Formula>클릭률 = 고유 클릭 건수 / 발송 성공 건수 x 100</Formula></InfoSection>
    <Paragraph>채널이 클릭 데이터를 제공하는 경우에만 집계됩니다.</Paragraph>
    <Articles items={[['클릭 추적 방식', 'https://resend.com/blog/open-and-click-tracking#how-click-tracking-works']]} />
  </>;
}

function Paragraph({ children }: { readonly children: ReactNode }) { return <Text as="p" size="3">{children}</Text>; }
function InfoSection({ children, title }: { readonly children: ReactNode; readonly title: string }) { return <section className="resend-ui-metrics-info-drawer__section"><Text as="p" color="white" size="3" weight="bold">{title}</Text>{children}</section>; }
function InfoList({ items }: { readonly items: readonly string[] }) { return <ul>{items.map((item) => { const [lead, ...rest] = item.split(': '); return <li key={item}><Text size="3"><strong>{lead}{rest.length > 0 ? ':' : ''}</strong>{rest.length > 0 ? ` ${rest.join(': ')}` : ''}</Text></li>; })}</ul>; }
function Formula({ children }: { readonly children: ReactNode }) { return <pre className="resend-ui-metrics-info-drawer__formula">{children}</pre>; }
function Articles({ items }: { readonly items: readonly (readonly [string, string])[] }) { return <section className="resend-ui-metrics-info-drawer__articles"><Text as="p" color="white" size="3" weight="bold">참고 자료</Text>{items.map(([title, href]) => <a href={href} key={href} rel="noreferrer" target="_blank"><span>{title}</span><ExternalLink aria-hidden="true" size={14} /></a>)}</section>; }

export { MetricsInfoDrawer };
export type { MetricsInfoKind };
