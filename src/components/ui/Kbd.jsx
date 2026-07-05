export function Kbd({ children, className = '', ...props }) {
  return (
    <kbd className={['kbd', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </kbd>
  );
}
