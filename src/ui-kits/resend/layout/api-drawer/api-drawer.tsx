import { Copy, ExternalLink, X } from 'lucide-react';
import { Dialog as RadixDialog, Tabs as RadixTabs } from 'radix-ui';
import { useCallback, useId, useState } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { PageHeaderApiAction } from '../page-header-actions';
import { apiDrawerDefaultSdks, apiDrawerLogsSections } from './api-drawer-data';
import type { ApiDrawerSectionData, ApiDrawerSdk } from './api-drawer-types';

type ApiDrawerProps = Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'title'> & {
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly sections?: readonly ApiDrawerSectionData[];
  readonly sdks?: readonly ApiDrawerSdk[];
  readonly title?: string;
  readonly trigger?: ReactElement;
};

type ApiDrawerNavigationProps = {
  readonly activeSdk: ApiDrawerSdk;
  readonly onChange: (sdk: ApiDrawerSdk) => void;
  readonly sdks: readonly ApiDrawerSdk[];
};

type ApiDrawerSectionProps = {
  readonly activeSdk: ApiDrawerSdk;
  readonly section: ApiDrawerSectionData;
};

function cx(...classes: readonly (false | null | string | undefined)[]) {
  return classes.filter((className): className is string => Boolean(className)).join(' ');
}

function getSectionCode(section: ApiDrawerSectionData, activeSdk: ApiDrawerSdk) {
  return section.code[activeSdk] ?? section.code.cURL ?? '';
}

function CopyButton({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    setCopied(true);
    void navigator.clipboard?.writeText(value);
  }

  return (
    <button
      aria-label="Copy code"
      className="resend-ui-api-drawer__copy"
      data-copied={copied ? '' : undefined}
      onClick={handleCopy}
      type="button"
    >
      <Copy aria-hidden="true" size={14} />
    </button>
  );
}

function ApiDrawerNavigation({
  activeSdk,
  onChange,
  sdks,
}: ApiDrawerNavigationProps) {
  return (
    <div className="resend-ui-api-drawer__nav-wrap">
      <div className="resend-ui-api-drawer__nav-scroll">
        <RadixTabs.Root onValueChange={(value) => onChange(value as ApiDrawerSdk)} value={activeSdk}>
          <RadixTabs.List asChild>
            <div className="resend-ui-api-drawer__tabs">
              {sdks.map((sdk) => (
                <RadixTabs.Trigger asChild key={sdk} value={sdk}>
                  <button
                    className="resend-ui-api-drawer__tab"
                    data-active={sdk === activeSdk ? '' : undefined}
                    type="button"
                  >
                    {sdk}
                  </button>
                </RadixTabs.Trigger>
              ))}
            </div>
          </RadixTabs.List>
        </RadixTabs.Root>
      </div>
      <div className="resend-ui-api-drawer__nav-border" />
    </div>
  );
}

function ApiDrawerSection({ activeSdk, section }: ApiDrawerSectionProps) {
  const code = getSectionCode(section, activeSdk);

  return (
    <section className="resend-ui-api-drawer__section">
      <div className="resend-ui-api-drawer__section-header">
        <h3 className="resend-ui-api-drawer__section-title">
          {section.href === undefined ? (
            section.title
          ) : (
            <a
              className="resend-ui-api-drawer__section-link"
              href={section.href}
              rel="noreferrer"
              target="_blank"
            >
              {section.title}
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          )}
        </h3>
        {section.description === undefined ? null : (
          <p className="resend-ui-api-drawer__section-description">{section.description}</p>
        )}
      </div>
      <div className="resend-ui-api-drawer__code-card" data-api-drawer-code-card>
        <CopyButton value={code} />
        <pre className="resend-ui-api-drawer__code" data-language={activeSdk}>
          <code>{code}</code>
        </pre>
      </div>
    </section>
  );
}

export function ApiDrawer({
  className,
  defaultOpen = false,
  onOpenChange,
  open,
  sections = apiDrawerLogsSections,
  sdks = apiDrawerDefaultSdks,
  title = 'Logs API',
  trigger,
  ...props
}: ApiDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [activeSdk, setActiveSdk] = useState<ApiDrawerSdk>(sdks[0] ?? 'Node.js');
  const drawerOpen = open ?? internalOpen;
  const titleId = useId();
  const setDrawerOpen = useCallback((nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }, [onOpenChange, open]);

  return (
    <div
      className={cx('resend-ui-api-drawer', className)}
      data-resend-api-drawer
      data-state={drawerOpen ? 'open' : 'closed'}
      {...props}
    >
      <RadixDialog.Root onOpenChange={setDrawerOpen} open={drawerOpen}>
        <RadixDialog.Trigger asChild>
          {trigger ?? <PageHeaderApiAction />}
        </RadixDialog.Trigger>
        <RadixDialog.Portal>
          <div className="resend-ui-api-drawer__portal" data-resend-api-drawer-portal>
            <RadixDialog.Overlay asChild>
              <button
                aria-label="Close API drawer"
                className="resend-ui-api-drawer__overlay"
                type="button"
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content aria-describedby={undefined} asChild>
              <aside
                aria-labelledby={titleId}
                aria-modal="true"
                className="resend-ui-api-drawer__panel"
              >
            <div className="resend-ui-api-drawer__panel-inner">
              <header className="resend-ui-api-drawer__header">
                <RadixDialog.Title asChild>
                  <h2 className="resend-ui-api-drawer__title" id={titleId}>{title}</h2>
                </RadixDialog.Title>
                <RadixDialog.Close asChild>
                  <button
                    aria-label="Close"
                    className="resend-ui-api-drawer__close"
                    type="button"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                </RadixDialog.Close>
              </header>
              <div className="resend-ui-api-drawer__body">
                <ApiDrawerNavigation activeSdk={activeSdk} onChange={setActiveSdk} sdks={sdks} />
                {sections.map((section) => (
                  <ApiDrawerSection activeSdk={activeSdk} key={section.title} section={section} />
                ))}
              </div>
            </div>
              </aside>
            </RadixDialog.Content>
          </div>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  );
}

export type { ApiDrawerProps };
