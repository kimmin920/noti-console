export function Badge({ children, className = '', tone = 'neutral' }) {
  return <span className={['badge', tone, className].filter(Boolean).join(' ')}>{children}</span>;
}
