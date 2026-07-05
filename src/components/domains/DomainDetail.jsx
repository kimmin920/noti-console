import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  ChevronsUpDown,
  Ellipsis,
  Menu,
} from 'lucide-react';
import {
  DnsRecords,
  DomainInstructions,
  DomainSummary,
  DomainTabs,
  EnableReceiving,
} from './DomainDetailRecords.jsx';
import { domainDetailNavItems } from './domainDetailData.js';

const avatarSrc = '/static/resend/team-avatar.jpeg';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function DomainDetailPage() {
  return (
    <div className="resend-domain-detail-page">
      <div className="resend-detail-app">
        <MobileTopbar />
        <Sidebar />
        <div className="resend-detail-workspace">
          <DesktopTopbar />
          <main className="resend-detail-scroll">
            <section className="resend-detail-content" aria-labelledby="domain-detail-title">
              <DomainHeader />
              <DomainSummary />
              <DomainInstructions />
              <DomainTabs />
              <DnsRecords />
              <EnableReceiving />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function MobileTopbar() {
  return (
    <header className="resend-mobile-topbar">
      <div className="resend-mobile-topbar-row">
        <button aria-label="menu" className="resend-mobile-menu-button" type="button">
          <span className="visually-hidden">Open main menu</span>
          <Menu aria-hidden="true" size={32} strokeWidth={1.5} />
        </button>
        <span className="resend-mobile-brand">vvee1253</span>
        <span className="resend-mobile-spacer" />
      </div>
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="resend-sidebar">
      <div>
        <button className="resend-workspace-switcher" type="button">
          <Image alt="" className="resend-avatar" height={24} src={avatarSrc} width={24} />
          <span>vvee1253</span>
          <ChevronsUpDown aria-hidden="true" size={14} />
        </button>
        <nav className="resend-sidebar-nav" aria-label="Resend navigation">
          {domainDetailNavItems.map((item) => (
            <Link
              aria-current={item.label === 'Domains' ? 'page' : undefined}
              className={cx('resend-sidebar-link', item.label === 'Domains' && 'is-active')}
              href={item.href}
              key={item.label}
            >
              <span className="resend-nav-icon" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <button className="resend-account-button" type="button">
        <Image alt="" className="resend-avatar" height={24} src={avatarSrc} width={24} />
        <span>vvee1253@gmail.com</span>
        <Ellipsis aria-hidden="true" size={14} />
      </button>
    </aside>
  );
}

function DesktopTopbar() {
  return (
    <header className="resend-desktop-topbar">
      <a className="resend-docs-link" href="https://resend.com/docs">
        <BookOpen aria-hidden="true" size={15} />
        Docs
      </a>
      <button className="resend-help-button" type="button">
        <span>Need help?</span>
        <kbd>H</kbd>
      </button>
    </header>
  );
}

function DomainHeader() {
  return (
    <header className="resend-domain-header">
      <DomainStatusIcon />
      <div className="resend-domain-title">
        <span>Domain</span>
        <h1 id="domain-detail-title">new.vizuo.work</h1>
      </div>
      <div className="resend-domain-actions">
        <button className="resend-primary-button" type="button">Verify DNS Records</button>
        <button aria-label="Open API drawer" className="resend-icon-button is-desktop-only" type="button">
          <span className="resend-api-icon" />
        </button>
        <button aria-label="More actions" className="resend-icon-button" type="button">
          <Ellipsis aria-hidden="true" size={14} />
        </button>
      </div>
    </header>
  );
}

function DomainStatusIcon() {
  return (
    <div className="resend-domain-status-icon" aria-hidden="true">
      <div className="resend-domain-status-glow" />
      <svg fill="currentColor" viewBox="0 0 32 32">
        <path d="M16 1C7.729 1 1 7.729 1 16s6.729 15 15 15 15-6.729 15-15S24.271 1 16 1Zm12.696 13.873H21.988c-.1-4.33-.777-8.222-1.867-10.936 4.671 1.6 8.127 5.843 8.575 10.936ZM17.312 3.32c1.364 2.188 2.296 6.648 2.421 11.553h-7.467c.136-5.519 1.252-9.636 2.426-11.553A12.8 12.8 0 0 1 16 3.253c.443 0 .881.023 1.312.067ZM11.884 3.935c-1.093 2.721-1.771 6.615-1.872 10.938H3.304c.448-5.095 3.906-9.339 8.58-10.938ZM3.304 17.127h6.708c.101 4.323.779 8.217 1.872 10.938-4.674-1.599-8.132-5.843-8.58-10.938Zm11.388 11.553c-1.174-1.917-2.29-6.034-2.426-11.553h7.467c-.125 4.905-1.057 9.365-2.421 11.553A12.855 12.855 0 0 1 16 28.747c-.442 0-.878-.023-1.308-.067Zm5.429-.617c1.09-2.714 1.767-6.606 1.867-10.936h6.708c-.448 5.093-3.904 9.335-8.575 10.936Z" />
      </svg>
    </div>
  );
}
