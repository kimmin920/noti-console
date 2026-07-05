import { Check, Circle, Lock, Radio } from 'lucide-react';

import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

const statusIcons = {
  completed: Check,
  current: Radio,
  locked: Lock,
  pending: Circle,
};

const statusLabels = {
  completed: 'Completed',
  current: 'Current',
  locked: 'Locked',
  pending: 'Pending',
};

export function OnboardingStepCard({
  action,
  children,
  className = '',
  description,
  eyebrow,
  status = 'pending',
  statusLabel,
  title,
}) {
  const StatusIcon = statusIcons[status] ?? Circle;

  return (
    <article className={cx(styles.stepFrame, styles[`stepFrame_${status}`], styles[`stepCard_${status}`], className)} data-status={status}>
      <div className={styles.stepRail} aria-hidden="true" />
      <div className={cx(styles.stepMarker, styles.stepCardStatus)} aria-label={statusLabel ?? statusLabels[status] ?? status}>
        <StatusIcon aria-hidden="true" size={14} strokeWidth={2.1} />
      </div>
      <div className={styles.stepCard}>
        <div className={styles.stepCardHeader}>
          <div className={styles.stepCardTitleGroup}>
            {eyebrow ? <p className={styles.stepCardEyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.stepCardTitle}>{title}</h2>
          </div>
        </div>
        {description ? <p className={styles.stepCardDescription}>{description}</p> : null}
        {action ? <div className={styles.stepCardAction}>{action}</div> : null}
        {children ? <div className={styles.stepCardContent}>{children}</div> : null}
      </div>
    </article>
  );
}
