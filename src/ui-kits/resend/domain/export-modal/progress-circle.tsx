type ProgressCircleProps = {
  readonly current: number;
  readonly total: number;
};

export function ProgressCircle({ current, total }: ProgressCircleProps) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const offset = circumference - progress * circumference;

  return (
    <svg
      aria-label={`${Math.round(progress * 100)}% exported`}
      className="resend-ui-export-modal__progress-circle"
      role="img"
      viewBox="0 0 36 36"
    >
      <circle
        className="resend-ui-export-modal__progress-track"
        cx="18"
        cy="18"
        r={radius}
      />
      <circle
        className="resend-ui-export-modal__progress-value"
        cx="18"
        cy="18"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}
