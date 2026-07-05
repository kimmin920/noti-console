'use client';

import Link from 'next/link';
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { ArrowRight } from 'lucide-react';
import styles from './landing.module.css';

export function LandingAuthControls() {
  return (
    <div className={styles.navActions}>
      <Show when="signed-out" treatPendingAsSignedOut>
        <SignInButton fallbackRedirectUrl="/message-send" mode="modal">
          <button className={styles.navTextButton} type="button">
            로그인
          </button>
        </SignInButton>
        <SignUpButton fallbackRedirectUrl="/message-send" mode="modal">
          <button className={styles.navButton} type="button">
            회원가입
            <ArrowRight size={16} />
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link className={styles.navButton} href="/message-send">
          콘솔 열기
          <ArrowRight size={16} />
        </Link>
        <UserButton userProfileMode="modal" />
      </Show>
    </div>
  );
}
