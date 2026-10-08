'use client';

import { LandingHeader } from './LandingHeader.jsx';
import { LandingHero } from './LandingHero.jsx';
import { LandingConsolePreview } from './LandingConsolePreview.jsx';
import { LandingFeatures } from './LandingFeatures.jsx';
import { LandingClaudeSection } from './LandingClaudeSection.jsx';
import { LandingArchitecture } from './LandingArchitecture.jsx';
import { LandingBottomCta } from './LandingBottomCta.jsx';
import { Footer } from './Footer.jsx';
import styles from './landing.module.css';

export function LandingPage({ isSignedIn = false }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'noti',
    alternateName: '노티',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Cloud / Web',
    description:
      '비즈니스를 위한 차세대 올인원 메시징 & 알림 자동화 플랫폼. SMS, LMS, 카카오 알림톡, 브랜드 메시지 및 이벤트 자동화 API 제공. Built with Claude.',
    url: 'https://home.vizuo.work',
    author: {
      '@type': 'Organization',
      name: '비주오 (VIZUO)',
      url: 'https://home.vizuo.work',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'contact@vizuo.work',
        contactType: 'customer support',
      },
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KRW',
    },
    featureList: [
      '국내 이동통신 3사 SMS/LMS/MMS 직접 발송',
      '카카오 알림톡 및 친구톡, 브랜드 메시지 연동',
      '알림톡 실패 시 SMS 자동 폴백(Failover) 엔진',
      'Anthropic Claude AI 기반 템플릿 생성 및 정보통신망법 컴플라이언스 검증',
      '이벤트 기반 노코드/로우코드 자동화 트리거 파이프라인',
      '엔터프라이즈 감사 로그 및 고유 추적 ID(Provenance) 제공',
    ],
  };

  return (
    <div className={styles.landingRoot}>
      {/* AI 및 검색엔진용 구조화된 데이터 (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <LandingHeader isSignedIn={isSignedIn} />

      <main id="main-content">
        <LandingHero />
        <LandingConsolePreview />
        <LandingFeatures />
        <LandingClaudeSection />
        <LandingArchitecture />
        <LandingBottomCta />
      </main>

      <Footer />
    </div>
  );
}
