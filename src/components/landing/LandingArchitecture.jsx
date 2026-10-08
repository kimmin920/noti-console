'use client';

import { Terminal, CodeXml, ShieldCheck, Zap, Database, GitBranch } from 'lucide-react';
import styles from './landing.module.css';

export function LandingArchitecture() {
  const steps = [
    {
      num: '01. INGESTION',
      title: '통합 API & 웹훅 이벤트 수신',
      desc: 'REST API, Publ PApp, 토스페이먼츠, 스트라이프 등 모든 외부 비즈니스 이벤트를 단일 엔드포인트에서 256-bit TLS 보안으로 안전하게 수집합니다.',
    },
    {
      num: '02. INTELLIGENCE & FALLBACK',
      title: 'Claude AI 검증 및 자동 폴백',
      desc: '메시지 템플릿 변수 치환 후 컴플라이언스를 즉시 검증합니다. 카카오 알림톡 우선 전송 후, 미수신 시 5초 이내 통신사 SMS/LMS로 자동 전환됩니다.',
    },
    {
      num: '03. OBSERVABILITY',
      title: '고유 추적 ID & 전구간 감사 로그',
      desc: '모든 발송 요청에 Provenance Trace ID가 발급되어 통신사 교환기 전달 상태, 수신 결과 및 실패 원인 코드를 실시간 스트리밍으로 분석합니다.',
    },
  ];

  const codeSnippet = `curl -X POST https://home.vizuo.work/api/messages/send \\
  -H "Authorization: Bearer noti_live_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "KAKAO_ALIMTALK",
    "recipient": "010-1234-5678",
    "templateCode": "ORDER_CONFIRM_V1",
    "variables": {
      "고객명": "홍길동",
      "주문번호": "ORD-20261008-01"
    },
    "fallback": {
      "enabled": true,
      "channel": "SMS_LMS",
      "senderNumber": "02-1588-0000"
    }
  }'`;

  return (
    <section id="architecture" className={styles.sectionBlock} aria-labelledby="arch-heading">
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTag}>Engineering &amp; Architecture</div>
          <h2 id="arch-heading" className={styles.sectionH2}>
            단 1개의 API로 완성하는<br />
            무중단 &middot; 고신뢰 메시징 아키텍처
          </h2>
          <p className={styles.sectionDesc}>
            복잡한 통신사별 상이한 프로토콜과 카카오 알림톡 연동 규격을 단일 인터페이스로 통합하여
            엔지니어링 리소스를 90% 이상 절감합니다.
          </p>
        </div>

        {/* 3단계 아키텍처 파이프라인 */}
        <div className={styles.archFlowGrid}>
          {steps.map((step, idx) => (
            <div key={idx} className={styles.archStepCard}>
              <div className={styles.archStepNumber}>{step.num}</div>
              <h3 className={styles.archStepTitle}>{step.title}</h3>
              <p className={styles.archStepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* 코드 예시 박스 */}
        <div className={styles.claudeTerminal}>
          <div className={styles.terminalHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CodeXml size={15} color="#38bdf8" />
              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>통합 메시지 전송 API &middot; cURL Quickstart</span>
            </div>
            <span>POST /api/messages/send</span>
          </div>

          <pre style={{ margin: 0, overflowX: 'auto' }}>
            <code className={styles.terminalCode}>{codeSnippet}</code>
          </pre>

          <div style={{ fontSize: 11.5, color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: 10 }}>
            * 알림톡 전송 실패(카카오톡 미설치, 친구차단 등) 발생 시 지정된 발신번호로 SMS/LMS 자동 대체 발송이 즉각 실행됩니다.
          </div>
        </div>
      </div>
    </section>
  );
}
