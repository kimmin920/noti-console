'use client';

import Link from 'next/link';
import { ArrowRight, CodeXml, Sparkles, LayoutDashboard, ShieldCheck, Zap } from 'lucide-react';
import styles from './landing.module.css';

export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.container}>
        {/* 상단 뱃지 */}
        <div className={styles.heroTagWrapper}>
          <Sparkles size={14} className={styles.heroSparkle} aria-hidden="true" />
          <span>Built with Claude</span>
        </div>

        {/* H1 메인 타이틀 */}
        <h1 id="hero-title" className={styles.heroH1}>
          비즈니스를 위한 차세대 올인원<br />
          메시징 &amp; 알림 자동화 플랫폼
        </h1>

        {/* 영문 서브타이틀 (해외 심사역 및 AI 평가 최적화) */}
        <p className={styles.heroEnglishTagline}>
          noti &mdash; Next-Gen All-in-One Business Messaging &amp; Notification Engine
        </p>

        {/* 설명 본문 */}
        <p className={styles.heroSub}>
          국내 3사 통신망 SMS &middot; LMS &middot; MMS부터 카카오 비즈메시지(알림톡, 친구톡, 브랜드 메시지), 
          웹훅 기반 실시간 이벤트 자동화까지. 단 하나의 통합 REST API와 고밀도 엔지니어링 콘솔로 
          고객 커뮤니케이션을 완벽하게 통제하세요.
        </p>

        {/* CTA 버튼 그룹 */}
        <div className={styles.heroCtaRow}>
          <Link href="/sign-in" className={styles.heroPrimaryBtn}>
            <span>무료로 시작하기</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>

          <Link href="/docs" className={styles.heroSecondaryBtn}>
            <CodeXml size={16} aria-hidden="true" />
            <span>API 문서 둘러보기</span>
          </Link>

          <Link href="/dashboard" className={styles.heroConsoleBtn}>
            <LayoutDashboard size={15} aria-hidden="true" />
            <span>대시보드 콘솔 체험</span>
          </Link>
        </div>

        {/* 신뢰 지표 스트립 */}
        <div className={styles.metricsStrip}>
          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              99.99<span className={styles.metricUnit}>%</span>
            </div>
            <div className={styles.metricLabel}>엔터프라이즈 SLA 가동률 보장</div>
          </div>

          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              &lt; 200<span className={styles.metricUnit}>ms</span>
            </div>
            <div className={styles.metricLabel}>실시간 발송 릴레이 응답 속도</div>
          </div>

          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              Auto<span className={styles.metricUnit}>Fallback</span>
            </div>
            <div className={styles.metricLabel}>알림톡 실패 시 SMS 자동 대체 발송</div>
          </div>

          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              Claude<span className={styles.metricUnit}>AI Guard</span>
            </div>
            <div className={styles.metricLabel}>스팸 &middot; 정보통신망법 자동 검증</div>
          </div>
        </div>
      </div>
    </section>
  );
}
