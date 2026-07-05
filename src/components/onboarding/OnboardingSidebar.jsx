'use client';

import { ChevronDown, CircleHelp, UserCircle } from 'lucide-react';

import styles from './onboarding.module.css';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function SidebarRow({ item }) {
  const Icon = item.icon;
  const classNames = cx(styles.sidebarItem, item.active && styles.sidebarItemActive, item.disabled && styles.sidebarItemDisabled);
  const state = item.disabled ? 'disabled' : item.active ? 'active' : 'idle';
  const content = (
    <>
      <span className={styles.sidebarItemIcon} aria-hidden="true">
        {Icon ? <Icon size={17} strokeWidth={1.8} /> : null}
      </span>
      <span className={styles.sidebarItemLabel}>{item.label}</span>
    </>
  );

  if (item.href && !item.disabled) {
    return (
      <a aria-current={item.active ? 'page' : undefined} className={classNames} data-state={state} href={item.href}>
        {content}
      </a>
    );
  }

  if (item.onClick && !item.disabled) {
    return (
      <button aria-current={item.active ? 'page' : undefined} className={classNames} data-state={state} onClick={item.onClick} type="button">
        {content}
      </button>
    );
  }

  return (
    <span aria-disabled={item.disabled || undefined} aria-current={item.active ? 'page' : undefined} className={classNames} data-state={state}>
      {content}
    </span>
  );
}

export function OnboardingSidebar({
  account,
  className = '',
  navGroups = [],
  onAccountClick,
  onWorkspaceClick,
  utilityItems = [],
  workspace,
}) {
  const workspaceInitials = workspace?.initials ?? workspace?.name?.slice(0, 1) ?? 'M';
  const accountInitials = account?.initials ?? account?.name?.slice(0, 1) ?? 'U';

  return (
    <div className={cx(styles.sidebarPanel, className)}>
      <div className={styles.sidebarTop}>
        <button
          aria-label={workspace?.label ?? 'Select workspace'}
          className={styles.workspaceSwitcher}
          data-state={onWorkspaceClick ? 'idle' : 'inert'}
          onClick={onWorkspaceClick}
          type="button"
        >
          <span className={styles.avatar}>{workspaceInitials}</span>
          <span className={styles.workspaceText}>
            <span className={styles.workspaceName}>{workspace?.name ?? 'Messaging'}</span>
            {workspace?.detail ? <span className={styles.workspaceDetail}>{workspace.detail}</span> : null}
          </span>
          <ChevronDown className={styles.workspaceChevron} aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>

        <nav className={styles.sidebarNav} aria-label="Onboarding navigation">
          {navGroups.map((group) => (
            <div className={styles.sidebarGroup} key={group.id ?? group.label}>
              {group.label ? <p className={styles.sidebarGroupLabel}>{group.label}</p> : null}
              <div className={styles.sidebarGroupItems}>
                {(group.items ?? []).map((item) => (
                  <SidebarRow item={item} key={item.id ?? item.label} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className={styles.sidebarBottom}>
        {utilityItems.length ? (
          <div className={styles.utilityList} aria-label="Onboarding utilities">
            {utilityItems.map((item) => (
              <SidebarRow item={{ icon: CircleHelp, ...item }} key={item.id ?? item.label} />
            ))}
          </div>
        ) : null}

        <button className={styles.accountControl} data-state={onAccountClick ? 'idle' : 'inert'} onClick={onAccountClick} type="button">
          <span className={styles.avatar}>{accountInitials}</span>
          <span className={styles.accountText}>
            <span className={styles.accountName}>{account?.name ?? 'Account'}</span>
            <span className={styles.accountDetail}>{account?.detail ?? 'Console access'}</span>
          </span>
          <UserCircle className={styles.accountIcon} aria-hidden="true" size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
