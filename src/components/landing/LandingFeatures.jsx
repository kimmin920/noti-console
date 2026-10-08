'use client';

import { Layers, Zap, Sparkles, Activity, Check } from 'lucide-react';
import styles from './landing.module.css';

export function LandingFeatures() {
  const features = [
    {
      id: 'multi-channel',
      icon: <Layers size={22} />,
      title: '1. 멀티채널 단일 파이프라인 (Unified Multi-Channel Delivery)',
      description:
        '국내 통신 3사(SKT·KT·LGU+) SMS·LMS·MMS와 카카오 비즈메시지(알림톡·친구톡·브랜드 메시지)를 단 하나의 REST API 및 콘솔에서 발송하고 제어합니다.',
      highlights: [
        '통일된 JSON 스키마로 모든 채널 발송 요청 단일화',
        '카카오 비즈니스 공식 인증 채널 키 연동 및 사전등록 발신번호 관리',
        '초당 수천 건의 대량 트래픽을 처리하는 고성능 비동기 발송 큐',
      ],
    },
    {
      id: 'automations',
      icon: <Zap size={22} />,
      title: '2. 이벤트 기반 노코드 자동화 파이프라인 (Event-Driven Engine)',
      description:
        'Publ, Toss Payments, Stripe, 커스텀 웹훅 등 비즈니스 서비스에서 발생하는 이벤트를 실시간으로 수신하여 조건에 맞는 알림을 즉시 트리거합니다.',
      highlights: [
        '알림톡 미수신·차단 시 통신사 SMS/LMS로 자동 전환되는 스마트 폴백(Failover)',
        '조건부 템플릿 분기 및 발송 스케줄링(즉시, N분 후, 특정 시간대) 제어',
        '시각적 노드 트리 기반의 직관적인 이벤트 자동화 빌더',
      ],
    },
    {
      id: 'ai-guard',
      icon: <Sparkles size={22} />,
      title: '3. Claude AI 지능형 템플릿 생성 & 검증 (Built with Claude)',
      description:
        'Anthropic Claude를 발송 엔진 코어에 결합하여 비즈니스 목적에 최적화된 템플릿 문구를 생성하고, 법적 규제 위반 및 스팸 요소를 사전에 차단합니다.',
      highlights: [
        '목적과 브랜드 톤앤매너에 맞춘 고전환율 메시지 초안 자동 작성',
        '정보통신망법 광고 표기 의무((광고), 080 무료 수신거부) 누락 자동 감지',
        '카카오 사전 검수 규정 및 통신사 스팸 필터링 사전 시뮬레이션',
      ],
    },
    {
      id: 'observability',
      icon: <Activity size={22} />,
      title: '4. 엔터프라이즈 감사 로그 & 정밀 추적 (Observability & Audit Trail)',
      description:
        '모든 발송 요청에 고유 발송 트레이스 ID(Provenance)를 부여하여 API 요청 수신부터 통신사 교환기 전송, 수신자 단말기 도달까지 전 과정을 실시간 모니터링합니다.',
      highlights: [
        '실시간 발송 성공률, 실패율, 채널별 전환 메트릭 대시보드',
        '통신사/카카오 에러 코드(번호 미등록, 전원 꺼짐, 스팸 차단 등) 정밀 분석 리포트',
        'ISMS 및 엔터프라이즈 컴플라이언스를 충족하는 암호화 감사 로그 보관',
      ],
    },
  ];

  return (
    <section id="features" className={styles.sectionBlock} aria-labelledby="features-heading">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTag}>Core Capabilities</div>
          <h2 id="features-heading" className={styles.sectionH2}>
            엔지니어링 팀과 마케터를 위한<br />
            가장 진보된 B2B 메시징 인프라
          </h2>
          <p className={styles.sectionDesc}>
            복잡한 통신사 규격과 번거로운 카카오 심사 절차를 완전히 추상화했습니다.
            noti를 통해 단 10분 만에 완전한 알림 인프라를 제품에 도입하세요.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {features.map((feature) => (
            <article key={feature.id} className={styles.featureCard}>
              <div className={styles.featureIconWrapper}>
                {feature.icon}
              </div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureText}>{feature.description}</p>
              <ul className={styles.featureHighlights}>
                {feature.highlights.map((highlight, idx) => (
                  <li key={idx} className={styles.featureHighlightItem}>
                    <Check size={14} className={styles.checkIcon} aria-hidden="true" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
