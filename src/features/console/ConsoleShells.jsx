'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Show, SignInButton, SignOutButton, SignUpButton, useUser } from '@clerk/nextjs';
import { Home, LogOut, MoreHorizontal, UserRound } from 'lucide-react';
import lottie from 'lottie-web';
import { BuildVersionBadge } from '../../components/layout/BuildVersionBadge.jsx';
import { InspectorSidebar } from '../../components/layout/index.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/index.js';
import audienceAnimation from '../../nav-lotties/audience.json';
import automationsAnimation from '../../nav-lotties/automations.json';
import emailsAnimation from '../../nav-lotties/emails.json';
import logsAnimation from '../../nav-lotties/logs.json';
import metricsAnimation from '../../nav-lotties/metrics.json';
import reservationsAnimation from '../../nav-lotties/reservations.json';
import settingsAnimation from '../../nav-lotties/settings.json';
import templatesAnimation from '../../nav-lotties/templates.json';
import { navItems, sidebarPanelSize, sidebarPushSize } from './consoleConfig.js';
import { useConsoleNavigation } from './ConsoleNavigationContext.jsx';
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

function EmbedSidebar({ activePage, getPageHref, hideAccountControl, onOpenChange }) {
  return (
    <InspectorSidebar
      handleColor="var(--text)"
      onOpenChange={onOpenChange}
      panelSize={sidebarPanelSize}
      side="left"
    >
      <SidebarContent
        activePage={activePage}
        embedMode
        getPageHref={getPageHref}
        hideAccountControl={hideAccountControl}
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
  embedMode = false,
  getPageHref,
  hideAccountControl = false,
}) {
  const visibleNavItems = useVisibleNavItems();

  return (
    <aside className="sidebar-menu">
      <SidebarProductHeader href={getPageHref('emails')} showVersion={embedMode} />

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
        {hideAccountControl ? null : <SidebarAccountControl />}

        {embedMode ? null : <BuildVersionBadge />}
      </div>
    </aside>
  );
}

function SidebarProductHeader({ href, showVersion = false }) {
  const productLink = (
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

  if (!showVersion) return productLink;

  return (
    <div className="sidebar-product-header">
      {productLink}
      <div className="sidebar-product-version">
        <BuildVersionBadge />
      </div>
    </div>
  );
}

function SidebarAccountControl() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? '계정';
  const accountInitial = (user?.firstName ?? email).trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      <Show when="signed-in">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`${email} 계정 메뉴`}
              className="account-button account-control account-menu-trigger"
              type="button"
            >
              <span aria-hidden="true" className="account-menu-avatar">
                {user?.imageUrl ? (
                  <span
                    className="account-menu-avatar-image"
                    style={{ backgroundImage: `url(${user.imageUrl})` }}
                  />
                ) : accountInitial}
              </span>
              <span className="account-details">
                <span className="account-email">{email}</span>
                <MoreHorizontal aria-hidden="true" className="ellipsis" size={16} strokeWidth={1.8} />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="sidebar-account-menu-content"
            matchTriggerWidth={false}
            side="top"
            sideOffset={8}
          >
            <DropdownMenuItem asChild className="sidebar-account-menu-item">
              <Link href="/settings?tab=profile">
                <span className="sidebar-account-menu-item-main">
                  <UserRound aria-hidden="true" size={18} strokeWidth={1.7} />
                  <span>내 프로필</span>
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="sidebar-account-menu-item">
              <Link href="/message-send">
                <span className="sidebar-account-menu-item-main">
                  <Home aria-hidden="true" size={18} strokeWidth={1.7} />
                  <span>홈페이지</span>
                </span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <SignOutButton redirectUrl="/">
              <DropdownMenuItem className="sidebar-account-menu-item">
                <span className="sidebar-account-menu-item-main">
                  <LogOut aria-hidden="true" size={18} strokeWidth={1.7} />
                  <span>로그아웃</span>
                </span>
              </DropdownMenuItem>
            </SignOutButton>
          </DropdownMenuContent>
        </DropdownMenu>
      </Show>
      <Show when="signed-out" treatPendingAsSignedOut>
        <div className="account-button account-control">
          <div className="account-auth-actions">
            <SignInButton fallbackRedirectUrl="/message-send" mode="modal">
              <button className="account-auth-button" type="button">로그인</button>
            </SignInButton>
            <SignUpButton fallbackRedirectUrl="/message-send" mode="modal">
              <button className="account-auth-button primary" type="button">가입</button>
            </SignUpButton>
          </div>
        </div>
      </Show>
    </>
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

function useVisibleNavItems() {
  const navigation = useConsoleNavigation();
  const { isSignedIn } = useUser();
  const currentActorQuery = useCurrentActorQuery({ enabled: navigation.mode === 'embed' || isSignedIn === true });
  const isOperator = Boolean(currentActorQuery.data?.user?.isOperator);

  return navItems.filter((item) => !item.adminOnly || isOperator);
}
