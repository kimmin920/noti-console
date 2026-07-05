import { ArrowUpRight } from 'lucide-react';

export function DocsCardGrid({
  children,
  className = '',
  ...props
}) {
  return (
    <div className={['docs-card-grid', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </div>
  );
}

export function DocsCard({
  children,
  className = '',
  href,
  meta,
  title,
  ...props
}) {
  const Element = href ? 'a' : 'article';

  return (
    <Element className={['docs-card', className].filter(Boolean).join(' ')} href={href} {...props}>
      <span className="docs-card-title">
        {title}
        {href ? <ArrowUpRight aria-hidden="true" size={14} /> : null}
      </span>
      {children ? <span className="docs-card-copy">{children}</span> : null}
      {meta ? <span className="docs-card-meta">{meta}</span> : null}
    </Element>
  );
}
