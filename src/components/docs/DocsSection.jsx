export function DocsSection({ children, id, title }) {
  return (
    <section className="docs-section">
      <h2 id={id}>
        <a aria-hidden="true" href={`#${id}`} tabIndex="-1">#</a>
        <span>{title}</span>
      </h2>
      {children}
    </section>
  );
}
