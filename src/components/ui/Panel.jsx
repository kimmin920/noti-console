export function Panel({ children, className = '', padded = true, ...props }) {
  return (
    <section
      className={['panel', padded && 'panel-padded', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </section>
  );
}
