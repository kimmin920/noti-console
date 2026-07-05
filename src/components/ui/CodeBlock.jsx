import { CopyButton } from './CopyButton.jsx';

export function CodeBlock({
  children,
  className = '',
  code,
  language = 'text',
  showCopy = true,
  title,
  ...props
}) {
  const value = String(code ?? children ?? '');

  return (
    <figure className={['code-block', className].filter(Boolean).join(' ')} {...props}>
      {title || showCopy ? (
        <figcaption className="code-block-header">
          {title ? <span>{title}</span> : <span>{language}</span>}
          {showCopy ? <CopyButton label="코드 복사" value={value} /> : null}
        </figcaption>
      ) : null}
      <pre>
        <code data-language={language}>{value}</code>
      </pre>
    </figure>
  );
}
