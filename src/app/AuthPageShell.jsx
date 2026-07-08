import Image from 'next/image';
import Link from 'next/link';
import { MessageSquareText, Workflow } from 'lucide-react';

import styles from './auth.module.css';

const previewRows = [
  {
    icon: MessageSquareText,
    label: 'SMS / 알림톡',
    detail: '주문 완료, 예약 확정, 배송 시작에 맞춰 자동 발송',
    status: 'ready',
  },
  {
    icon: Workflow,
    label: 'NOTI 이벤트',
    detail: '수신자 파일을 내보내지 않고 이벤트 조건 그대로 사용',
    status: 'live',
  },
];

export const clerkAuthAppearance = {
  variables: {
    borderRadius: '6px',
    colorBackground: 'var(--card)',
    colorInputBackground: 'var(--card)',
    colorInputText: 'var(--text)',
    colorPrimary: 'var(--bg-accent)',
    colorText: 'var(--text)',
    colorTextSecondary: 'var(--muted)',
    fontFamily: 'var(--font-sans)',
  },
  elements: {
    card: styles.clerkCard,
    cardBox: styles.clerkCardBox,
    dividerLine: styles.clerkDividerLine,
    dividerText: styles.clerkDividerText,
    footer: styles.clerkFooter,
    formButtonPrimary: styles.clerkPrimaryButton,
    formFieldInput: styles.clerkInput,
    header: styles.clerkHidden,
    headerSubtitle: styles.clerkHidden,
    headerTitle: styles.clerkHidden,
    rootBox: styles.clerkRoot,
    socialButtonsBlockButton: styles.clerkSocialButton,
  },
};

export function AuthPageShell({ children }) {
  return (
    <main className={styles.authPage}>
      <section className={styles.authGrid} aria-label="NOTI 로그인">
        <div className={styles.formColumn}>
          <Link className={styles.brand} href="/" aria-label="NOTI 홈">
            <span className={styles.brandMark}>
              <Image src="/static/icons/001_NOTI.png" alt="" width={24} height={24} priority />
            </span>
          </Link>

          <div className={styles.formCenter}>
            <div className={styles.formStack}>
              <div className={styles.formHeader}>
                <h1>Welcome to NOTI</h1>
              </div>
              {children}
            </div>
          </div>
        </div>

        <aside className={styles.previewColumn} aria-label="메시징 자동화 미리보기">
          <div className={styles.previewSurface}>
            <div className={styles.previewHeader}>
              <div>
                <span>workspace</span>
                <strong>current</strong>
              </div>
              <span className={styles.liveBadge}>live</span>
            </div>

            <div className={styles.previewMetric}>
              <span>today</span>
              <strong>1,284</strong>
              <p>sent messages</p>
            </div>

            <div className={styles.previewRows}>
              {previewRows.map((row) => {
                const Icon = row.icon;

                return (
                  <article className={styles.previewRow} key={row.label}>
                    <Icon size={16} />
                    <div>
                      <strong>{row.label}</strong>
                      <p>{row.detail}</p>
                    </div>
                    <span>{row.status}</span>
                  </article>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
