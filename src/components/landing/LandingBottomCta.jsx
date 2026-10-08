'use client';

import Link from 'next/link';
import { ArrowRight, Mail, CodeXml } from 'lucide-react';
import styles from './landing.module.css';

export function LandingBottomCta() {
  return (
    <section className={styles.bottomCtaBanner} aria-labelledby="cta-heading">
      <div className={styles.container}>
        <h2 id="cta-heading" className={styles.bottomCtaH2}>
          지금 noti와 함께<br />
          비즈니스 알림 인프라를 혁신하세요
        </h2>
        <p className={styles.bottomCtaSub}>
          복잡한 통신사 심사와 카카오 연동을 단 하나의 API로 해결하세요. 
          Claude AI와 엔터프라이즈 자동화 엔진이 지원하는 고신뢰 메시징 플랫폼입니다.
        </p>

        <div className={styles.heroCtaRow}>
          <Link href="/sign-in" className={styles.heroPrimaryBtn}>
            <span>무료로 시작하기</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>

          <Link href="/docs" className={styles.heroSecondaryBtn}>
            <CodeXml size={16} aria-hidden="true" />
            <span>API 문서 살펴보기</span>
          </Link>

          <a href="mailto:contact@vizuo.work" className={styles.heroConsoleBtn}>
            <Mail size={15} aria-hidden="true" />
            <span>기업 도입 문의 (contact@vizuo.work)</span>
          </a>
        </div>
      </div>
    </section>
  );
}
