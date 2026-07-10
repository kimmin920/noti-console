import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DEFAULT_ROOTS = ['src/features/console', 'src/components'];

const CONSOLE_HREF_PATTERN = String.raw`\/(?:message-send|templates|automations|settings|admin|logs|reservations|audience|metrics|docs)(?:[/?#][^'"` + '`' + String.raw`]*|)`;
const ROUTER_LITERAL_PATTERN = new RegExp(String.raw`\brouter\.(?:push|replace)\(\s*([` + '`' + String.raw`'"])(` + CONSOLE_HREF_PATTERN + String.raw`)\1`, 'g');
const HREF_LITERAL_PATTERN = new RegExp(String.raw`\bhref\s*=\s*(?:\{\s*)?([` + '`' + String.raw`'"])(` + CONSOLE_HREF_PATTERN + String.raw`)\1`, 'g');
const WINDOW_LOCATION_PATTERN = new RegExp(String.raw`\bwindow\.location\.(?:assign|href)\s*(?:=|\()\s*([` + '`' + String.raw`'"])(` + CONSOLE_HREF_PATTERN + String.raw`)\1`, 'g');

const ALLOWED_FILES = new Set([
  'src/features/console/ConsoleNavigationContext.jsx',
  'src/features/console/routing.js',
]);

export function auditConsoleNavigationLiterals({ roots = DEFAULT_ROOTS } = {}) {
  const violations = [];

  for (const root of roots) {
    for (const filePath of listSourceFiles(root)) {
      const normalizedPath = filePath.replaceAll('\\', '/');
      if (ALLOWED_FILES.has(normalizedPath)) continue;

      const source = readFileSync(filePath, 'utf8');
      collectPatternViolations({ filePath, pattern: ROUTER_LITERAL_PATTERN, source, type: 'router-literal' }, violations);
      collectPatternViolations({ filePath, pattern: HREF_LITERAL_PATTERN, source, type: 'href-literal' }, violations);
      collectPatternViolations({ filePath, pattern: WINDOW_LOCATION_PATTERN, source, type: 'window-location-literal' }, violations);
    }
  }

  return violations;
}

function collectPatternViolations({ filePath, pattern, source, type }, violations) {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    const href = match[2];
    if (
      isAllowedHref(href) ||
      isAllowedGenericComponent(filePath, source, match.index ?? 0) ||
      isConsoleLinkUsage(source, match.index ?? 0)
    ) continue;
    violations.push({
      file: filePath,
      href,
      line: getLineNumber(source, match.index ?? 0),
      type,
    });
  }
}

function isAllowedHref(href) {
  return (
    href.startsWith('/api/') ||
    href.startsWith('#') ||
    href.includes('/download')
  );
}

function isAllowedGenericComponent(filePath, source, index) {
  const relativePath = filePath.replaceAll('\\', '/');
  if (!relativePath.endsWith('src/components/ui/CommandPalette.jsx')) return false;

  const before = source.slice(Math.max(0, index - 80), index);
  const after = source.slice(index, index + 120);
  return before.includes('command') || after.includes('command.href');
}

function isConsoleLinkUsage(source, index) {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const lineEnd = source.indexOf('\n', index);
  const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
  return line.includes('<ConsoleLink');
}

function listSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (/\.(js|jsx)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = auditConsoleNavigationLiterals();
  if (violations.length > 0) {
    for (const violation of violations) {
      const path = relative(process.cwd(), violation.file);
      console.error(`${path}:${violation.line} ${violation.type} ${violation.href}`);
    }
    process.exit(1);
  }
}
