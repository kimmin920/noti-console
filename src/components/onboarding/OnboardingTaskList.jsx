'use client';

import { OnboardingActionButton } from './OnboardingActionButton.jsx';
import { OnboardingStepCard } from './OnboardingStepCard.jsx';
import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function OnboardingTaskList({
  className = '',
  description,
  tasks = [],
  title,
}) {
  return (
    <section className={cx(styles.taskListSection, className)} aria-labelledby={title ? 'onboarding-task-list-title' : undefined}>
      {title || description ? (
        <div className={styles.taskListHeader}>
          {title ? <h1 className={styles.taskListTitle} id="onboarding-task-list-title">{title}</h1> : null}
          {description ? <p className={styles.taskListDescription}>{description}</p> : null}
        </div>
      ) : null}

      <ol className={styles.taskList}>
        {tasks.map((task, index) => {
          const action = task.action ?? (task.actionLabel ? (
            <OnboardingActionButton
              disabled={task.actionDisabled}
              href={task.actionHref}
              icon={task.actionIcon}
              onClick={task.onAction}
              trailingIcon={task.trailingIcon}
              variant={task.actionVariant ?? (task.status === 'current' ? 'primary' : 'secondary')}
            >
              {task.actionLabel}
            </OnboardingActionButton>
          ) : null);

          return (
            <li className={styles.taskListItem} key={task.id ?? task.title}>
              <OnboardingStepCard
                action={action}
                description={task.description}
                eyebrow={task.eyebrow}
                index={index + 1}
                status={task.status}
                statusLabel={task.statusLabel}
                title={task.title}
              >
                {task.children}
              </OnboardingStepCard>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
