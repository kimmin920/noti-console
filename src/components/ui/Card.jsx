export function Card({ children, className = '', ...props }) {
  return (
    <section className={['profile-card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ children, className = '' }) {
  return <div className={['profile-card-heading', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function CardTitle({ children, className = '', id }) {
  return (
    <h2 className={['profile-section-title', className].filter(Boolean).join(' ')} id={id}>
      {children}
    </h2>
  );
}

export function CardCopy({ children, className = '' }) {
  return <div className={['profile-card-copy', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function CardActions({ children, className = '' }) {
  return <div className={['profile-card-actions', className].filter(Boolean).join(' ')}>{children}</div>;
}
