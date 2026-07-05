import { OnboardingActionButton } from './OnboardingActionButton.jsx';
import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function OnboardingStepActions({
  className = '',
  primaryDisabled = false,
  primaryIcon,
  primaryLabel,
  primaryOnClick,
  secondaryDisabled = false,
  secondaryIcon,
  secondaryLabel,
  secondaryOnClick,
}) {
  if (!primaryLabel && !secondaryLabel) return null;

  return (
    <div className={cx(styles.stepActions, className)}>
      {primaryLabel ? (
        <OnboardingActionButton
          disabled={primaryDisabled}
          icon={primaryIcon}
          onClick={primaryOnClick}
          variant="primary"
        >
          {primaryLabel}
        </OnboardingActionButton>
      ) : null}
      {secondaryLabel ? (
        <OnboardingActionButton
          disabled={secondaryDisabled}
          icon={secondaryIcon}
          onClick={secondaryOnClick}
        >
          {secondaryLabel}
        </OnboardingActionButton>
      ) : null}
    </div>
  );
}
