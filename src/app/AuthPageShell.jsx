import Image from 'next/image';
import Link from 'next/link';

import styles from './auth.module.css';

const previewFrames = [
  '/static/auth/001_NOTI.png',
  '/static/auth/002_NOTI.png',
  '/static/auth/003_NOTI.png',
  '/static/auth/004_NOTI.png',
  '/static/auth/005_NOTI.png',
  '/static/auth/006_NOTI.png',
  '/static/auth/007_NOTI.png',
  '/static/auth/008_NOTI.png',
  '/static/auth/009_NOTI.png',
  '/static/auth/010_NOTI.png',
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
          <div className={styles.previewAnimation} aria-hidden="true">
            {previewFrames.map((src, index) => (
              <span
                className={styles.previewFrame}
                key={src}
                style={{
                  '--frame-index': index,
                  backgroundImage: `url('${src}')`,
                }}
              />
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
