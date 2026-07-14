'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  Lightbulb,
  Mail,
  Plus,
} from 'lucide-react';
import {
  DataTableV2,
} from '../ui/index.js';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const domainAddRegions = [
  { id: 'us-east-1', name: 'North Virginia', flag: '/static/flags/us.svg' },
  { id: 'eu-west-1', name: 'Ireland', flag: '/static/flags/ie.svg' },
  { id: 'sa-east-1', name: 'São Paulo', flag: '/static/flags/br.svg' },
  { id: 'ap-northeast-1', name: 'Tokyo', flag: '/static/flags/jp.svg' },
];

export const domainAddStepContent = {
  domain: {
    description: 'Domain name and region for your sending and receiving.',
    title: 'Domain',
  },
  dns: {
    description: 'Sign in to your domain host to authorize DNS changes.',
    title: 'DNS Records',
  },
};

function getDomainAddRegion(regionId) {
  return domainAddRegions.find((region) => region.id === regionId) ?? domainAddRegions[0];
}

function normalizeCreatedDomain(domain, defaultRegion, suggestedDomain) {
  if (!domain) return null;

  const region = getDomainAddRegion(domain.regionId ?? domain.region?.id ?? defaultRegion);

  return {
    clickTracking: domain.clickTracking ?? true,
    customReturnPath: domain.customReturnPath ?? 'send',
    name: domain.name?.trim() || `updates.${suggestedDomain}`,
    openTracking: domain.openTracking ?? false,
    regionId: region.id,
    trackingSubdomain: domain.trackingSubdomain ?? '',
  };
}

export function DomainsAddPage({
  defaultAdvancedOpen = false,
  defaultRegion = 'ap-northeast-1',
  initialCreatedDomain = null,
  onDomainCreate,
  suggestedDomain = 'example.com',
}) {
  const [createdDomain, setCreatedDomain] = useState(() =>
    normalizeCreatedDomain(initialCreatedDomain, defaultRegion, suggestedDomain)
  );
  const createdRegion = createdDomain ? getDomainAddRegion(createdDomain.regionId) : null;

  function handleDomainCreate(domain) {
    const nextDomain = normalizeCreatedDomain(domain, defaultRegion, suggestedDomain);

    setCreatedDomain(nextDomain);
    onDomainCreate?.(nextDomain);
  }

  return (
    <section className="page-frame domain-add-page">
      <DomainAddHeader />
      <DomainAddSteps>
        {createdDomain ? (
          <>
            <DomainCompletedStep
              domainName={createdDomain.name}
              region={createdRegion}
            />
            <DomainDnsRecordsManualStep
              domainName={createdDomain.name}
              status="pending"
            />
          </>
        ) : (
          <>
            <DomainInformationStep
              defaultAdvancedOpen={defaultAdvancedOpen}
              defaultRegion={defaultRegion}
              onCreate={handleDomainCreate}
              suggestedDomain={suggestedDomain}
            />
            <DomainDnsRecordsStep />
          </>
        )}
      </DomainAddSteps>
    </section>
  );
}

export function DomainAddHeader({
  description = 'Use a domain you own to send and receive emails.',
  icon = Mail,
  title = 'Add domain',
}) {
  return (
    <header className="domain-add-header">
      <DomainAddStatusIcon icon={icon} />
      <div className="domain-add-header-copy">
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
    </header>
  );
}

export function DomainAddStatusIcon({ icon: Icon = Mail }) {
  return (
    <div aria-hidden="true" className="domain-add-status-icon">
      <svg fill="none" height="80" viewBox="0 0 80 80" width="80" xmlns="http://www.w3.org/2000/svg">
        <rect className="domain-add-status-icon-shell" height="79" rx="18" width="79" x="0.5" y="0.5" />
        <path className="domain-add-status-icon-grid" d="M20 28h40M20 40h40M20 52h40M28 20v40M40 20v40M52 20v40" />
      </svg>
      <Icon size={25} strokeWidth={1.7} />
    </div>
  );
}

export function DomainAddSteps({ children, className = '', ...props }) {
  return (
    <div className={cx('domain-add-steps', className)} {...props}>
      <div aria-hidden="true" className="steps-gradient absolute top-0 h-full w-px" />
      <div className="domain-add-step-stack">{children}</div>
    </div>
  );
}

export function DomainStep({
  children,
  className = '',
  description,
  status = 'not_started',
  title,
  ...props
}) {
  return (
    <DomainStepBody className={className} status={status} {...props}>
      {title ? <DomainStepHeading status={status}>{title}</DomainStepHeading> : null}
      {description ? <DomainStepDescription>{description}</DomainStepDescription> : null}
      {children ? <div className="domain-step-content">{children}</div> : null}
    </DomainStepBody>
  );
}

export function DomainStepBody({ children, className = '', status = 'not_started', ...props }) {
  const locked = status === 'not_started' || status === 'locked';

  return (
    <section
      className={cx('domain-step', `domain-step-${status}`, locked && 'is-locked', className)}
      data-status={status}
      {...props}
    >
      <div className="domain-step-dot-wrap">
        <div className="domain-step-dot" />
      </div>
      <div className="domain-step-card-gradient">
        <div className="domain-step-card-outer">
          <div className="domain-step-card-inner">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function DomainStepHeading({ children, status = 'not_started' }) {
  return (
    <div className="domain-step-heading-row">
      <h3>{children}</h3>
      {status === 'completed' ? <CircleCheck aria-hidden="true" size={16} /> : null}
      {status === 'failed' ? <AlertTriangle aria-hidden="true" size={16} /> : null}
    </div>
  );
}

export function DomainStepDescription({ children }) {
  if (!children) return null;

  return <p className="domain-step-description">{children}</p>;
}

export function DomainInformationStep({
  defaultAdvancedOpen = false,
  defaultRegion = 'ap-northeast-1',
  onCreate,
  suggestedDomain = 'example.com',
}) {
  const [domainName, setDomainName] = useState('');
  const [regionId, setRegionId] = useState(defaultRegion);
  const [advancedOpen, setAdvancedOpen] = useState(defaultAdvancedOpen);
  const [returnPath, setReturnPath] = useState('send');
  const [trackingSubdomain, setTrackingSubdomain] = useState('');
  const [clickTracking, setClickTracking] = useState(true);
  const [openTracking, setOpenTracking] = useState(false);

  const selectedRegion = useMemo(
    () => domainAddRegions.find((region) => region.id === regionId) ?? domainAddRegions[0],
    [regionId]
  );
  const trackingEnabled = trackingSubdomain.trim().length > 0;

  function handleSubmit(event) {
    event.preventDefault();

    onCreate?.({
      clickTracking,
      customReturnPath: returnPath,
      name: domainName.trim() || `updates.${suggestedDomain}`,
      openTracking,
      regionId,
      trackingSubdomain,
    });
  }

  return (
    <DomainStep
      className="domain-information-step"
      description={domainAddStepContent.domain.description}
      status="pending"
      title={domainAddStepContent.domain.title}
    >
      <div className="domain-information-layout">
        <form className="domain-add-form" onSubmit={handleSubmit}>
          <DomainAddField htmlFor="domain" label="Name">
            <div className="domain-add-input-with-action">
              <DomainTextInput
                autoComplete="off"
                id="domain"
                onChange={(event) => setDomainName(event.target.value)}
                placeholder={`updates.${suggestedDomain}`}
                required
                value={domainName}
              />
              <DomainIconButton label="Domain name recommendations">
                <Lightbulb aria-hidden="true" size={16} />
              </DomainIconButton>
            </div>
          </DomainAddField>

          <DomainAddField htmlFor="region" label="Region">
            <DomainRegionSelect
              id="region"
              onChange={setRegionId}
              regions={domainAddRegions}
              selectedRegion={selectedRegion}
            />
          </DomainAddField>

          <DomainAdvancedOptions
            clickTracking={clickTracking}
            disabled={!trackingEnabled}
            onClickTrackingChange={setClickTracking}
            onOpenChange={setAdvancedOpen}
            onOpenTrackingChange={setOpenTracking}
            onReturnPathChange={setReturnPath}
            onTrackingSubdomainChange={setTrackingSubdomain}
            open={advancedOpen}
            openTracking={openTracking}
            returnPath={returnPath}
            trackingSubdomain={trackingSubdomain}
          />

          <div className="domain-add-actions">
            <button className="domain-add-primary-button" type="submit">
              <Plus aria-hidden="true" size={16} />
              <span>Add domain</span>
            </button>
          </div>
        </form>
        <DomainEmailPreview domainName={domainName || suggestedDomain} />
      </div>
    </DomainStep>
  );
}

export function DomainCompletedStep({
  domainName = 'updates.example.com',
  region = domainAddRegions[0],
}) {
  return (
    <DomainStep
      className="domain-information-step"
      description={domainAddStepContent.domain.description}
      status="completed"
      title={domainAddStepContent.domain.title}
    >
      <div className="domain-completed-summary">
        <DomainAddField htmlFor="completed-domain" label="Name">
          <DomainReadonlyField
            domainName={domainName}
            id="completed-domain"
            region={region}
          />
        </DomainAddField>
      </div>
    </DomainStep>
  );
}

export function DomainReadonlyField({
  domainName = 'updates.example.com',
  id,
  region = domainAddRegions[0],
}) {
  return (
    <div className="domain-readonly-field">
      <Image alt={region.name} height={18} src={region.flag} width={24} />
      <input
        aria-label="Domain name"
        className="domain-add-input"
        id={id}
        readOnly
        title={`${region.name} (${region.id})`}
        value={domainName}
      />
    </div>
  );
}

export function DomainAddField({ children, htmlFor, label }) {
  return (
    <div className="domain-add-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

export function DomainTextInput({ className = '', ...props }) {
  return <input className={cx('domain-add-input', className)} type="text" {...props} />;
}

export function DomainIconButton({ children, className = '', label, type = 'button', ...props }) {
  return (
    <button aria-label={label} className={cx('domain-add-icon-button', className)} type={type} {...props}>
      {children}
    </button>
  );
}

export function DomainRegionSelect({ id, onChange, regions = domainAddRegions, selectedRegion }) {
  return (
    <div className="domain-region-select">
      <select
        aria-label="Region"
        id={id}
        onChange={(event) => onChange?.(event.target.value)}
        value={selectedRegion.id}
      >
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {region.name} ({region.id})
          </option>
        ))}
      </select>
      <div aria-hidden="true" className="domain-region-select-display">
        <Image alt={selectedRegion.name} height={18} src={selectedRegion.flag} width={24} />
        <span>
          {selectedRegion.name} <span>({selectedRegion.id})</span>
        </span>
        <ChevronDown size={16} />
      </div>
    </div>
  );
}

export function DomainAdvancedOptions({
  clickTracking,
  disabled,
  onClickTrackingChange,
  onOpenChange,
  onOpenTrackingChange,
  onReturnPathChange,
  onTrackingSubdomainChange,
  open,
  openTracking,
  returnPath,
  trackingSubdomain,
}) {
  return (
    <div className="domain-advanced-options">
      <button
        aria-expanded={open}
        className="domain-advanced-trigger"
        onClick={() => onOpenChange?.(!open)}
        type="button"
      >
        <span>Advanced options</span>
        <ChevronDown aria-hidden="true" className={open ? 'is-open' : ''} size={16} />
      </button>
      {open ? (
        <div className="domain-advanced-content">
          <DomainAddField htmlFor="customReturnPath" label="Custom Return-Path">
            <DomainTextInput
              autoComplete="off"
              id="customReturnPath"
              onChange={(event) => onReturnPathChange?.(event.target.value)}
              placeholder="Add a Custom Return-Path value..."
              value={returnPath}
            />
          </DomainAddField>
          <DomainAddField htmlFor="trackingSubdomain" label="Tracking Subdomain">
            <DomainTextInput
              autoComplete="off"
              id="trackingSubdomain"
              onChange={(event) => onTrackingSubdomainChange?.(event.target.value)}
              placeholder="links"
              value={trackingSubdomain}
            />
          </DomainAddField>
          <div className={cx('domain-tracking-options', disabled && 'is-disabled')}>
            <span className="domain-tracking-title">Tracking options</span>
            <DomainTrackingCheckbox
              checked={clickTracking}
              disabled={disabled}
              id="click-tracking"
              label="Enable click tracking"
              onCheckedChange={onClickTrackingChange}
            />
            <div className="domain-open-tracking">
              <DomainTrackingCheckbox
                checked={openTracking}
                disabled={disabled}
                id="open-tracking"
                label="Enable open tracking"
                onCheckedChange={onOpenTrackingChange}
              />
              <span>
                Open tracking can produce inaccurate results. Learn more and consider{' '}
                <a href="https://resend.com/docs/knowledge-base/why-are-my-open-rates-not-accurate">
                  if open tracking is right for you
                </a>
                .
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DomainTrackingCheckbox({
  checked = false,
  disabled = false,
  id,
  label,
  onCheckedChange,
}) {
  return (
    <div className="domain-tracking-checkbox-row">
      <button
        aria-checked={checked}
        className="domain-tracking-checkbox"
        disabled={disabled}
        id={id}
        onClick={() => onCheckedChange?.(!checked)}
        role="checkbox"
        type="button"
      >
        {checked ? <Check aria-hidden="true" size={14} /> : null}
      </button>
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function DomainEmailPreview({ domainName = 'example.com' }) {
  return (
    <aside aria-label="Email preview" className="domain-email-preview">
      <div className="domain-email-preview-header">
        <span className="domain-email-avatar">Y</span>
        <div className="domain-email-meta">
          <div>
            <span className="domain-email-name">Your Name</span>
            <span className="domain-email-address">&lt;youremail@{domainName}&gt;</span>
          </div>
          <span className="domain-email-recipient">to me</span>
        </div>
      </div>
      <div className="domain-email-lines">
        <span />
        <span />
        <span />
      </div>
    </aside>
  );
}

export function DomainDnsRecordsStep() {
  return (
    <DomainStepBody status="not_started">
      <DomainStepHeading status="not_started">{domainAddStepContent.dns.title}</DomainStepHeading>
    </DomainStepBody>
  );
}

export function DomainDnsRecordsManualStep({ domainName = 'example.com', status = 'pending' }) {
  return (
    <DomainStep
      description="Add the following DNS records in your domain provider."
      status={status}
      title="Fill in your DNS Records"
    >
      <div className="domain-dns-records-panel">
        <h4>Domain Verification</h4>
        <DomainDnsRecordsTable
          rows={[
            { type: 'TXT', name: '@', value: `resend-verify=${domainName}`, ttl: 'Auto', priority: '-' },
            { type: 'CNAME', name: `resend._domainkey.${domainName}`, value: 'resend.domainkey.resend.com', ttl: 'Auto', priority: '-' },
          ]}
        />
      </div>
      <button className="domain-add-primary-button" type="button">
        <CircleCheck aria-hidden="true" size={16} />
        <span>I&apos;ve added the records</span>
      </button>
    </DomainStep>
  );
}

export function DomainDnsRecordsTable({ rows = [] }) {
  return (
    <DataTableV2
      columns={[
        { accessor: 'type', header: 'Type' },
        { accessor: 'name', header: 'Name' },
        { accessor: 'value', header: 'Content' },
        { accessor: 'ttl', header: 'TTL' },
        { accessor: 'priority', header: 'Priority' },
      ]}
      data={rows}
      getRowId={(row) => `${row.type}-${row.name}`}
      scrollBaseClassName=""
      scrollClassName="domain-dns-table-shell"
      tableBaseClassName=""
      tableClassName="domain-dns-table-v2"
      withShell={false}
    />
  );
}

export function DomainClaimStep({
  claimId = 'claim_xxxxxxxxx',
  domainName = 'example.com',
  reason = 'recent_activity',
}) {
  const supportHref = `mailto:support@resend.com?subject=${encodeURIComponent(
    `Domain claim support for ${domainName}`
  )}&body=${encodeURIComponent(`Hi Resend team,\n\nI'd like to claim the ${domainName} domain.\n\nClaim reference: ${claimId}\n`)}`;

  return (
    <DomainStepBody className="domain-claim-step" status="failed">
      <DomainStepHeading status="failed">Claim domain</DomainStepHeading>
      <DomainStepDescription>
        {reason === 'grace_period'
          ? 'This domain was recently claimed on Resend. To claim it again, please contact support.'
          : 'This domain is active and cannot be transferred automatically. To claim it, please contact support so we can ensure a smooth transition.'}
      </DomainStepDescription>
      <div className="domain-add-actions">
        <a className="domain-add-primary-button" href={supportHref}>
          Contact support
        </a>
      </div>
    </DomainStepBody>
  );
}

export function DomainDnsNavigation({
  domainName = 'example.com',
  mode = 'domain-connect',
  onModeChange,
  status = 'not_started',
}) {
  if (mode === 'manual') {
    return (
      <DomainDnsRecordsManualStep
        domainName={domainName}
        status={status === 'not_started' ? 'pending' : status}
      />
    );
  }

  return (
    <DomainStep
      description="Sign in to your domain host to authorize DNS changes. This step will allow Resend to make the necessary DNS updates."
      status={status}
      title="DNS Records"
    >
      <div className="domain-add-actions">
        <button className="domain-add-primary-button" type="button">
          Auto configure
        </button>
        <button
          className="domain-add-secondary-button"
          onClick={() => onModeChange?.('manual')}
          type="button"
        >
          Manual setup
        </button>
      </div>
    </DomainStep>
  );
}

export function DomainExternalLink({ children, href }) {
  return (
    <a className="domain-external-link" href={href} rel="noopener noreferrer" target="_blank">
      {children}
      <ExternalLink aria-hidden="true" size={14} />
    </a>
  );
}

DomainStep.Body = DomainStepBody;
DomainStep.Heading = DomainStepHeading;
DomainStep.Description = DomainStepDescription;
