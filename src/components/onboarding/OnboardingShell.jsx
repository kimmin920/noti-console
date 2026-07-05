import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function OnboardingShell({
  children,
  className = '',
  contentClassName = '',
  mobileHeader,
  sidebar,
  topbar,
}) {
  return (
    <div className={cx(styles.shell, !sidebar && styles.shellNoSidebar, className)}>
      {sidebar ? <aside className={styles.sidebar}>{sidebar}</aside> : null}
      {topbar ? <header className={styles.topbar}>{topbar}</header> : null}
      <main className={cx(styles.main, topbar && styles.mainWithTopbar)}>
        {mobileHeader ? <div className={styles.mobileHeader}>{mobileHeader}</div> : null}
        <div className={cx(styles.content, contentClassName)}>{children}</div>
      </main>
    </div>
  );
}
