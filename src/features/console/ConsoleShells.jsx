'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs';
import { BookOpen, CircleHelp } from 'lucide-react';
import lottie from 'lottie-web';
import { BuildVersionBadge } from '../../components/layout/BuildVersionBadge.jsx';
import { InspectorSidebar } from '../../components/layout/index.js';
import { Button, CommandPalette, Kbd, Popover, PopoverClose, PopoverContent, PopoverTrigger } from '../../components/ui/index.js';
import audienceAnimation from '../../nav-lotties/audience.json';
import automationsAnimation from '../../nav-lotties/automations.json';
import emailsAnimation from '../../nav-lotties/emails.json';
import logsAnimation from '../../nav-lotties/logs.json';
import metricsAnimation from '../../nav-lotties/metrics.json';
import reservationsAnimation from '../../nav-lotties/reservations.json';
import settingsAnimation from '../../nav-lotties/settings.json';
import templatesAnimation from '../../nav-lotties/templates.json';
import { navItems, sidebarPanelSize, sidebarPushSize } from './consoleConfig.js';
import { useCurrentActorQuery } from './messageSend/queries.js';
import { getConsoleNavigationPageId } from './routing.js';

const navAnimations = {
  emails: emailsAnimation,
  automations: automationsAnimation,
  templates: templatesAnimation,
  audience: audienceAnimation,
  metrics: metricsAnimation,
  reservations: reservationsAnimation,
  logs: logsAnimation,
  settings: settingsAnimation,
  admin: settingsAnimation,
};

export function AppShell({
  activePage,
  children,
  docsHref,
  getPageHref,
  hideAccountControl,
}) {
  const activeNavPage = getConsoleNavigationPageId(activePage);

  return (
    <div className="app-shell app-mode">
      <FixedSidebar
        activePage={activeNavPage}
        getPageHref={getPageHref}
        hideAccountControl={hideAccountControl}
      />
      <div className="workspace">
        <Topbar docsHref={docsHref} getPageHref={getPageHref} />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

export function EmbedShell({
  activePage,
  children,
  docsHref,
  getPageHref,
  hideAccountControl,
}) {
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const activeNavPage = getConsoleNavigationPageId(activePage);

  return (
    <div
      className={`app-shell embed-mode ${sideMenuOpen ? 'side-menu-open' : ''}`}
      style={{ '--side-menu-push': `${sidebarPushSize}px` }}
    >
      <EmbedSidebar
        activePage={activeNavPage}
        docsHref={docsHref}
        getPageHref={getPageHref}
        hideAccountControl={hideAccountControl}
        onOpenChange={setSideMenuOpen}
      />
      <div className="workspace">
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

function EmbedSidebar({ activePage, docsHref, getPageHref, hideAccountControl, onOpenChange }) {
  return (
    <InspectorSidebar
      handleColor="var(--text)"
      onOpenChange={onOpenChange}
      panelSize={sidebarPanelSize}
      side="left"
    >
      <SidebarContent
        activePage={activePage}
        docsHref={docsHref}
        getPageHref={getPageHref}
        hideAccountControl={hideAccountControl}
        showUtilityActions
      />
    </InspectorSidebar>
  );
}

function FixedSidebar({ activePage, getPageHref, hideAccountControl }) {
  return (
    <aside className="fixed-sidebar">
      <SidebarContent
        activePage={activePage}
        getPageHref={getPageHref}
        hideAccountControl={hideAccountControl}
      />
    </aside>
  );
}

function SidebarContent({
  activePage,
  docsHref,
  getPageHref,
  hideAccountControl = false,
  showUtilityActions = false,
}) {
  const visibleNavItems = useVisibleNavItems();

  return (
    <aside className={`sidebar-menu ${showUtilityActions ? 'has-utility-actions' : ''}`}>
      <SidebarProductHeader href={getPageHref('emails')} />

      <nav className="sidebar-nav" aria-label="주 메뉴">
        {visibleNavItems.map(({ id, label }) => (
          <NavButton
            active={activePage === id}
            href={getPageHref(id)}
            id={id}
            key={id}
            label={label}
          />
        ))}
      </nav>

      <div className="sidebar-bottom-stack">
        {showUtilityActions ? (
          <div className="sidebar-utility-actions">
            <Link className="sidebar-utility-button" href={docsHref}>
              <BookOpen size={15} />
              문서
            </Link>
            <button className="sidebar-utility-button" type="button">
              도움이 필요하신가요?
            </button>
          </div>
        ) : null}

        {hideAccountControl ? null : <SidebarAccountControl />}

        <BuildVersionBadge />
      </div>
    </aside>
  );
}

function SidebarProductHeader({ href }) {
  return (
    <Link aria-label="NOTI 홈" className="sidebar-product" href={href}>
      <span className="sidebar-product-mark" aria-hidden="true">
        <Image
          alt=""
          className="sidebar-product-logo"
          height={32}
          src="/static/icons/001_NOTI.png"
          unoptimized
          width={32}
        />
      </span>
      <span className="sidebar-product-copy">
        <span className="sidebar-product-title">NOTI</span>
        <span className="sidebar-product-subtitle">SMS · 알림톡 · 브랜드 메시지</span>
      </span>
    </Link>
  );
}

function SidebarAccountControl() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? '계정';

  return (
    <div className="account-button account-control">
      <Show when="signed-in">
        <UserButton userProfileMode="modal" />
        <div aria-label="계정 이메일" className="account-details">
          <span className="account-email">{email}</span>
          <span className="ellipsis">...</span>
        </div>
      </Show>
      <Show when="signed-out" treatPendingAsSignedOut>
        <div className="account-auth-actions">
          <SignInButton fallbackRedirectUrl="/message-send" mode="modal">
            <button className="account-auth-button" type="button">로그인</button>
          </SignInButton>
          <SignUpButton fallbackRedirectUrl="/message-send" mode="modal">
            <button className="account-auth-button primary" type="button">가입</button>
          </SignUpButton>
        </div>
      </Show>
    </div>
  );
}

function NavButton({ active, href, id, label }) {
  const iconRef = useRef(null);

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      className={`nav-item ${active ? 'active' : ''}`}
      data-nav-id={id}
      href={href}
      onMouseEnter={() => iconRef.current?.onMouseEnter()}
      onMouseLeave={() => iconRef.current?.onMouseLeave()}
    >
      <AnimatedNavIcon active={active} id={id} ref={iconRef} />
      <span className="nav-item-label">{label}</span>
    </Link>
  );
}

const AnimatedNavIcon = forwardRef(function AnimatedNavIcon({ active, id }, ref) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const animation = lottie.loadAnimation({
      animationData: navAnimations[id],
      autoplay: false,
      container: containerRef.current,
      loop: false,
      renderer: 'svg',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: true,
      },
    });

    animationRef.current = animation;
    animation.goToAndStop(0, true);

    return () => {
      if (pendingRef.current) clearTimeout(pendingRef.current);
      animation.destroy();
      animationRef.current = null;
    };
  }, [id]);

  useImperativeHandle(ref, () => ({
    onMouseEnter() {
      const animation = animationRef.current;
      if (!animation) return;

      if (id === 'settings') {
        if (pendingRef.current) clearTimeout(pendingRef.current);
        animation.setDirection(1);
        animation.setSpeed(1);
        animation.play();
        return;
      }

      const totalFrames = Math.round(animation.totalFrames || 0);
      const currentFrame = Math.round((animation.currentFrame || 0) + 1);
      if (currentFrame === 1 || currentFrame >= totalFrames * 0.9) {
        pendingRef.current = setTimeout(() => {
          animation.stop();
          animation.setDirection(1);
          animation.setSpeed(1);
          animation.play();
        }, 150);
      }
    },
    onMouseLeave() {
      const animation = animationRef.current;
      if (pendingRef.current) clearTimeout(pendingRef.current);

      if (id === 'settings' && animation) {
        animation.setDirection(-1);
        animation.setSpeed(1.8);
        animation.play();
      }
    },
  }), [id]);

  return <span aria-hidden="true" className={`nav-lottie ${active ? 'active' : ''}`} ref={containerRef} />;
});

function Topbar({ docsHref, getPageHref }) {
  const visibleNavItems = useVisibleNavItems();
  const commands = [
    ...visibleNavItems.map(({ id, label }) => ({
      description: `${label} 페이지로 이동`,
      href: getPageHref(id),
      id: `nav-${id}`,
      label,
      keywords: [id],
    })),
    {
      description: 'API와 브랜드 메시지 사용 가이드를 엽니다.',
      href: docsHref,
      icon: BookOpen,
      id: 'docs',
      label: '문서 열기',
      shortcut: 'D',
    },
  ];

  return (
    <header className="topbar">
      <CommandPalette commands={commands} title="빠른 이동" />
      <Link aria-label="문서" className="docs-link" href={docsHref}>
        <BookOpen aria-hidden="true" className="docs-link-icon" size={15} />
        <span className="docs-link-label">문서</span>
      </Link>
      <Popover>
        <PopoverTrigger asChild>
          <button aria-label="도움말 열기" className="help-button" type="button">
            <span className="help-button-label">도움이 필요하신가요?</span>
            <span className="help-key">H</span>
          </button>
        </PopoverTrigger>
        <PopoverContent aria-label="도움말" side="bottom">
          <div className="popover-heading">
            <strong>도움말</strong>
            <p>문서를 열거나 빠른 이동 메뉴에서 콘솔 페이지를 바로 찾을 수 있습니다.</p>
          </div>
          <p>
            <Kbd>K</Kbd>
            {' '}
            키로 명령 메뉴를 열고, 방향키와 Enter로 이동합니다.
          </p>
          <div className="popover-actions">
            <Link className="button secondary" href={docsHref}>
              <BookOpen size={15} />
              문서
            </Link>
            <PopoverClose asChild>
              <Button>
                <CircleHelp size={15} />
                확인
              </Button>
            </PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
}

function useVisibleNavItems() {
  const { isSignedIn } = useUser();
  const currentActorQuery = useCurrentActorQuery({ enabled: isSignedIn === true });
  const isOperator = isSignedIn === true && Boolean(currentActorQuery.data?.user?.isOperator);

  return navItems.filter((item) => !item.adminOnly || isOperator);
}
