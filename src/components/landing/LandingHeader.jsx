'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles, ExternalLink } from 'lucide-react';
import styles from './landing.module.css';

export function LandingHeader({ isSignedIn = false }) {
  return (
    <>
      {/* --- 최상단 공지 배너 (Built with Claude 3.7 & Claude Code) --- */}
      <div className={styles.announcementBar}>
        <span className={styles.announcementPill}>
          <Sparkles size={11} aria-hidden="true" />
          Built with Claude
        </span>
        <span className={styles.announcementText}>
          noti는 Claude 3.7 및 Claude Code 기반으로 구축된 차세대 엔터프라이즈 메시징 인프라입니다.
        </span>
        <a href="#ai-engine" className={styles.announcementLink}>
          자세히 보기 &rarr;
        </a>
      </div>

      {/* --- 네비게이션 헤더 --- */}
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          {/* 브랜드 로고 */}
          <Link href="/" className={styles.logoRow} aria-label="noti 홈">
            <Image
              src="/static/icons/001_NOTI.png"
              alt="noti"
              width={32}
              height={32}
              className={styles.logoImg}
              unoptimized
            />
            <span className={styles.logoText}>noti</span>
            <span className={styles.logoTag}>Platform</span>
          </Link>

          {/* 중앙 네비게이션 링크 */}
          <nav aria-label="주요 메뉴">
            <ul className={styles.navLinks}>
              <li>
                <a href="#features" className={styles.navLinkItem}>
                  주요 기능
                </a>
              </li>
              <li>
                <a href="#automations" className={styles.navLinkItem}>
                  자동화 엔진
                </a>
              </li>
              <li>
                <a href="#ai-engine" className={styles.navLinkItem}>
                  Claude AI
                </a>
              </li>
              <li>
                <a href="#architecture" className={styles.navLinkItem}>
                  엔지니어링 &amp; API
                </a>
              </li>
              <li>
                <Link href="/docs" className={styles.navLinkItem}>
                  개발자 문서
                </Link>
              </li>
            </ul>
          </nav>

          {/* 우측 액션 버튼 */}
          <div className={styles.headerActions}>
            <div className={styles.headerStatus}>
              <span className={styles.pulseDot} aria-hidden="true" />
              <span>99.99% 가동 중</span>
            </div>

            {isSignedIn ? (
              <Link href="/dashboard" className={styles.startBtn}>
                <span>콘솔로 이동</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className={styles.loginBtn}>
                  로그인
                </Link>
                <Link href="/sign-in" className={styles.startBtn}>
                  <span>시작하기</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
