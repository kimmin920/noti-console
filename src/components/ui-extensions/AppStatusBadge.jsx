import { StatusLabel } from '../../ui-kits/resend/data-display/status-label';

export function AppStatusBadge({ children, className = '', tone = 'neutral', ...props }) {
  return (
    <StatusLabel
      className={className}
      data-tone={tone}
      tooltipTrigger={false}
      {...props}
    >
      {children}
    </StatusLabel>
  );
}
