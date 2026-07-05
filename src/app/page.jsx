import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Database,
  Gauge,
  MessageSquareText,
  Plug,
  ReceiptText,
  Send,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import styles from './landing.module.css';
import { LandingAuthControls } from './LandingAuthControls.jsx';

export const metadata = {
  title: 'Publ 메시징 자동화 앱',
  description: 'Publ 데이터를 내보내지 않고 SMS, 알림톡, 브랜드 메시지를 자동 발송하는 파트너 앱입니다.',
};

const proofRows = [
  {
    icon: Database,
    label: 'recipient',
    title: 'Publ 수신자 그대로',
    detail: '고객, 주문, 예약 조건으로 수신자를 고릅니다.',
    status: 'live',
    tone: 'success',
  },
  {
    icon: Workflow,
    label: 'trigger',
    title: '이벤트 기반 자동화',
    detail: '회원가입, 주문 완료, 결제, 배송 시작에 맞춰 보냅니다.',
    status: 'ready',
    tone: 'success',
  },
  {
    icon: ReceiptText,
    label: 'billing',
    title: '성공 건만 과금',
    detail: '실패 건은 로그에 남기고 정산 대상에서 제외합니다.',
    status: 'metered',
    tone: 'warning',
  },
];

const channelRows = [
  ['알림톡', '주문, 예약, 결제, 배송 안내', '템플릿 승인 후 운영'],
  ['SMS / LMS', '인증, 긴급 공지, 대체 발송', '실패 시 자동 전환'],
  ['브랜드 메시지', '쿠폰, 이벤트, 재구매 안내', '이미지와 버튼 포함'],
];

const installRows = [
  { icon: Plug, title: '앱 설치', detail: 'Publ 앱마켓에서 워크스페이스에 연결' },
  { icon: ShieldCheck, title: '발신 자원 확인', detail: '수신거부, 템플릿, 대체 발송 설정 점검' },
  { icon: Gauge, title: '운영 지표 확인', detail: '성공, 실패, 대체 발송, 정산 대상을 한 로그에서 추적' },
];

const recipeLines = [
  ['event', 'order.completed'],
  ['recipient', '배송 완료 고객 418명'],
  ['channel', '알림톡 -> SMS fallback'],
  ['billing', 'success_only'],
];

const faqs = [
  ['누가 설치하나요?', 'Publ 앱마켓에서 사업자가 워크스페이스에 설치합니다. 운영자는 콘솔에서 자동화와 발송 기록을 관리합니다.'],
  ['기존 외부 발송사와 무엇이 다른가요?', '수신자를 엑셀로 내보내지 않고 Publ 이벤트와 수신자를 그대로 사용합니다.'],
  ['어떤 채널을 지원하나요?', '1차 범위는 SMS/LMS, 알림톡, 브랜드 메시지입니다. RCS와 이메일은 이후 제공 예정입니다.'],
  ['실패한 메시지도 과금되나요?', '발송 결과 기준 실패 건은 과금하지 않습니다. 대체 발송 성공 시 실제 성공 채널 기준으로 정산될 수 있습니다.'],
];

export default async function HomePage({ searchParams }) {
  const params = await searchParams;

  if (params?.mode === 'embed') {
    redirect('/message-send?mode=embed');
  }

  return (
    <main className={styles.landingPage}>
      <section className={styles.instrument} aria-labelledby="landing-title">
        <nav className={styles.top} aria-label="메인">
          <Link className={styles.logo} href="/">
            <span className={styles.logoMark}>P</span>
            <span>Publ 메시징</span>
          </Link>
          <LandingAuthControls />
        </nav>

        <div className={styles.metaLine}>
          <span>partner app</span>
          <span>success-only billing</span>
          <span>SMS · 알림톡 · 브랜드 메시지</span>
        </div>

        <header className={styles.hero}>
          <p className={styles.partnerBadge}>
            <BadgeCheck size={13} />
            Publ 앱마켓 설치형
          </p>
          <h1 id="landing-title">Publ 메시징</h1>
          <p className={styles.tagline}>
            수신자 파일을 밖으로 내보내지 않고, Publ 이벤트와 수신자를 그대로 사용해 반복 발송 업무를
            자동화합니다.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href="/message-send">
              콘솔 데모 보기
              <ArrowRight size={15} />
            </Link>
            <a className={styles.secondaryButton} href="#install">
              설치 흐름
            </a>
          </div>
        </header>

        <section className={styles.demoRows} aria-label="핵심 흐름">
          {proofRows.map((row) => (
            <StatusRow key={row.label} row={row} />
          ))}
        </section>

        <section className={styles.commandBlock} id="install" aria-labelledby="install-heading">
          <div className={styles.sectionHead}>
            <h2 id="install-heading">install path</h2>
            <span>3 steps</span>
          </div>
          <Link className={styles.commandField} href="/message-send">
            <span className={styles.commandPrefix}>$</span>
            <span className={styles.commandText}>publ messaging open --workspace current</span>
            <Send size={15} />
          </Link>
          <div className={styles.installRows}>
            {installRows.map((item) => {
              const Icon = item.icon;

              return (
                <article className={styles.installRow} key={item.title}>
                  <Icon size={15} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.previewBlock} id="automation" aria-labelledby="automation-heading">
          <div className={styles.sectionHead}>
            <h2 id="automation-heading">automation recipe</h2>
            <span>fallback on</span>
          </div>
          <div className={styles.codeCard}>
            {recipeLines.map(([key, value]) => (
              <div className={styles.codeLine} key={key}>
                <span>{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.rowSection} id="channels" aria-labelledby="channels-heading">
          <div className={styles.sectionHead}>
            <h2 id="channels-heading">channels</h2>
            <span>single console</span>
          </div>
          <div className={styles.channelRows}>
            {channelRows.map(([name, use, state]) => (
              <article className={styles.channelRow} key={name}>
                <MessageSquareText size={15} />
                <div>
                  <strong>{name}</strong>
                  <p>{use}</p>
                </div>
                <span>{state}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.ledgerBlock} id="pricing" aria-labelledby="pricing-heading">
          <div className={styles.sectionHead}>
            <h2 id="pricing-heading">pricing ledger</h2>
            <span>no base fee</span>
          </div>
          <dl className={styles.ledger}>
            <div>
              <dt>월 기본료</dt>
              <dd>0원</dd>
            </div>
            <div>
              <dt>무료 포인트</dt>
              <dd>SMS 100건 상당</dd>
            </div>
            <div>
              <dt>정산 기준</dt>
              <dd>성공 발송 건</dd>
            </div>
          </dl>
        </section>

        <section className={styles.faqBlock} aria-labelledby="faq-heading">
          <div className={styles.sectionHead}>
            <h2 id="faq-heading">questions</h2>
            <span>compact proof</span>
          </div>
          <div className={styles.faqList}>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ArrowRight size={14} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>Publ 메시징</span>
          <a href="#install">설치 흐름</a>
          <Link href="/docs">문서</Link>
        </footer>
      </section>
    </main>
  );
}

function StatusRow({ row }) {
  const Icon = row.icon;

  return (
    <article className={styles.statusRow}>
      <div className={styles.rowIcon}>
        <Icon size={15} />
      </div>
      <div className={styles.rowCopy}>
        <span>{row.label}</span>
        <strong>{row.title}</strong>
        <p>{row.detail}</p>
      </div>
      <span className={`${styles.rowStatus} ${row.tone === 'warning' ? styles.rowStatusWarning : ''}`}>
        <span aria-hidden="true" />
        {row.status}
      </span>
    </article>
  );
}
