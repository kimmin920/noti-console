import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function OnboardingTopbar({
  className = '',
  helpLabel = '도움이 필요하신가요?',
  links = [{ href: '#docs', label: '문서' }],
  shortcut = 'H',
}) {
  return (
    <div className={cx(styles.topbarInner, className)}>
      <nav aria-label="Onboarding support" className={styles.topbarActions}>
        {links.map((link) => (
          <a className={styles.topbarLink} href={link.href} key={link.href ?? link.label}>
            {link.label}
          </a>
        ))}
        <button className={styles.topbarHelp} type="button">
          <span>{helpLabel}</span>
          {shortcut ? <kbd className={styles.topbarShortcut}>{shortcut}</kbd> : null}
        </button>
      </nav>
    </div>
  );
}
