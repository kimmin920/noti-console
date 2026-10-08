'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Clock, Lock, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';
import { POLICIES } from './policiesData.js';
import { PolicyModal } from './PolicyModal.jsx';
import styles from './footer.module.css';

export function Footer() {
  const [activePolicy, setActivePolicy] = useState(null);

  const openPolicy = (key) => {
    if (POLICIES[key]) {
      setActivePolicy(POLICIES[key]);
    }
  };

  const closePolicy = () => {
    setActivePolicy(null);
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        {/* --- 1. 상단 영역 (브랜드 & 링크 & 지원 안내) --- */}
        <div className={styles.topSection}>
          <div className={styles.brandCol}>
            <Link href="/" className={styles.brandRow}>
              <Image
                src="/static/icons/001_NOTI.png"
                alt="noti"
                width={30}
                height={30}
                className={styles.brandLogo}
                unoptimized
              />
              <span className={styles.brandName}>noti</span>
            </Link>
            <p className={styles.slogan}>
              비즈니스를 위한 차세대 올인원 메시징 &amp; 알림 자동화 플랫폼
            </p>
            <div className={styles.statusBadge}>
              <span className={styles.pulseDot} aria-hidden="true" />
              <span>발송 엔진 및 API 정상 가동 중 (99.99%)</span>
            </div>
          </div>

          <div>
            <h4 className={styles.sectionTitle}>주요 서비스</h4>
            <ul className={styles.linkList}>
              <li>
                <Link href="/message-send" className={styles.footerLink}>
                  <span>SMS · LMS · MMS 발송</span>
                </Link>
              </li>
              <li>
                <Link href="/message-send" className={styles.footerLink}>
                  <span>카카오 알림톡 &amp; 브랜드 메시지</span>
                </Link>
              </li>
              <li>
                <Link href="/automations" className={styles.footerLink}>
                  <span>이벤트 기반 자동화 엔진</span>
                </Link>
              </li>
              <li>
                <Link href="/templates" className={styles.footerLink}>
                  <span>템플릿 빌더 &amp; AI 검증</span>
                </Link>
              </li>
              <li>
                <Link href="/docs" className={styles.footerLink}>
                  <span>개발자 REST API &amp; Webhook</span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className={styles.sectionTitle}>고객지원 &amp; 문의</h4>
            <div className={styles.supportCard}>
              <div className={styles.supportItem}>
                <Mail size={15} className={styles.supportIcon} aria-hidden="true" />
                <div>
                  <div>고객센터 / 비즈니스 제휴</div>
                  <a href="mailto:contact@vizuo.work" className={styles.supportEmail}>
                    contact@vizuo.work
                  </a>
                </div>
              </div>
              <div className={styles.supportItem}>
                <Clock size={15} className={styles.supportIcon} aria-hidden="true" />
                <div>
                  <div>운영시간 안내</div>
                  <div style={{ color: '#94a3b8' }}>평일 10:00 ~ 18:00 (주말·공휴일 휴무)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- 2. 중간 정책 링크 --- */}
        <div className={styles.middleSection}>
          <button
            type="button"
            className={styles.policyBtn}
            onClick={() => openPolicy('terms')}
          >
            서비스 이용약관
          </button>
          <span className={styles.policyDivider} aria-hidden="true">|</span>

          <button
            type="button"
            className={styles.policyBtn}
            onClick={() => openPolicy('privacy')}
          >
            개인정보처리방침
          </button>
          <span className={styles.policyDivider} aria-hidden="true">|</span>

          <button
            type="button"
            className={styles.policyBtn}
            onClick={() => openPolicy('antiSpam')}
          >
            스팸방지 및 발송정책
          </button>
          <span className={styles.policyDivider} aria-hidden="true">|</span>

          <button
            type="button"
            className={styles.policyBtn}
            onClick={() => openPolicy('emailRefusal')}
          >
            이메일무단수집거부
          </button>
          <span className={styles.policyDivider} aria-hidden="true">|</span>

          <button
            type="button"
            className={styles.policyBtn}
            onClick={() => openPolicy('sla')}
          >
            서비스 수준 협약 (SLA)
          </button>
        </div>

        {/* --- 3. 사업자등록증 정보 섹션 --- */}
        <div className={styles.bizInfoSection}>
          <div className={styles.bizInfoGrid}>
            <span><span className={styles.bizLabel}>상호명:</span> 비주오 (VIZUO)</span>
            <span className={styles.bizDivider} aria-hidden="true">|</span>
            <span><span className={styles.bizLabel}>대표자:</span> 김민우</span>
            <span className={styles.bizDivider} aria-hidden="true">|</span>
            <span><span className={styles.bizLabel}>개업연월일:</span> 2025년 12월 17일</span>
            <span className={styles.bizDivider} aria-hidden="true">|</span>
            <span><span className={styles.bizLabel}>사업자등록번호:</span> 519-24-02167</span>
          </div>

          <div className={styles.bizInfoGrid}>
            <span><span className={styles.bizLabel}>사업장 소재지:</span> 강원특별자치도 춘천시 신동면 설미길 111-1</span>
            <span className={styles.bizDivider} aria-hidden="true">|</span>
            <span><span className={styles.bizLabel}>고객문의 및 제휴:</span> <a href="mailto:contact@vizuo.work" style={{ color: '#94a3b8', textDecoration: 'underline' }}>contact@vizuo.work</a></span>
          </div>

          <div className={styles.securityNotice}>
            <Lock size={13} className={styles.securityIcon} aria-hidden="true" />
            <span>보안 안내: 전송 구간 256-bit SSL 보안 암호화 및 정보통신망법 발송 규정 완벽 준수</span>
          </div>
        </div>

        {/* --- 4. 하단 카피라이트 --- */}
        <div className={styles.bottomSection}>
          <div>
            &copy; 2026 VIZUO. All rights reserved. Powered by noti Platform.
          </div>
          <div className={styles.claudeBadge}>
            <Sparkles size={13} className={styles.claudeSparkle} aria-hidden="true" />
            <span>Built with Claude</span>
          </div>
        </div>
      </div>

      {/* --- 정책 모달 열람 창 --- */}
      <PolicyModal policy={activePolicy} onClose={closePolicy} />
    </footer>
  );
}
