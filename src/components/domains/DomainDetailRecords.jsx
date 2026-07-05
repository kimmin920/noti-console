'use client';

import {
  CircleHelp,
  ExternalLink,
  Forward,
  Info,
} from 'lucide-react';
import {
  dnsRecordSections,
  domainDetailSummary,
  receivingRecordSection,
} from './domainDetailData.js';
import { DataTableV2 } from '../ui/index.js';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function DomainSummary() {
  return (
    <dl className="resend-domain-summary">
      {domainDetailSummary.map((item) => (
        <div className="resend-domain-summary-item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.icon === 'cloudflare' ? <CloudflareIcon size={20} /> : null}
            {item.tone === 'badge' ? <StatusBadge>{item.value}</StatusBadge> : <span>{item.value}</span>}
            {item.detail ? <span className="resend-summary-detail">{item.detail}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DomainDnsNotice() {
  return (
    <div className="resend-domain-dns-notice-wrap">
      <div className="resend-domain-dns-notice" role="alert">
        <span className="resend-domain-dns-notice-icon" aria-hidden="true">
          <Info size={16} />
        </span>
        <p>
          Access the DNS settings page of{' '}
          <a href="https://dash.cloudflare.com" rel="noopener noreferrer" target="_blank">
            Cloudflare
          </a>{' '}
          and add all the following DNS records to the records section. Once all are added, click the &quot;Verify DNS Records&quot; button above.
        </p>
      </div>
    </div>
  );
}

export function DomainInstructions() {
  return <DomainDnsNotice />;
}

export function DomainTabs() {
  return (
    <div className="resend-domain-tabs-root" data-activation-direction="none" data-orientation="horizontal">
      <div
        className="resend-domain-tabs"
        data-activation-direction="none"
        data-orientation="horizontal"
        role="tablist"
        aria-label="Domain sections"
      >
        <button
          aria-selected="true"
          data-active=""
          data-composite-item-active=""
          data-orientation="horizontal"
          id="domain-records-tab"
          role="tab"
          tabIndex={-1}
          type="button"
        >
          Records
        </button>
        <button
          aria-selected="false"
          data-orientation="horizontal"
          id="domain-configuration-tab"
          role="tab"
          tabIndex={-1}
          type="button"
        >
          Configuration
        </button>
      </div>
    </div>
  );
}

export function DnsRecords() {
  return (
    <section
      aria-labelledby="dns-records-heading"
      className="resend-records-section"
      data-activation-direction="none"
      data-orientation="horizontal"
      id="domain-records-panel"
      role="tabpanel"
      tabIndex={0}
    >
      <div className="resend-records-accent" aria-hidden="true" />
      <div className="resend-records-header">
        <h3 id="dns-records-heading">DNS Records</h3>
        <div className="resend-records-actions">
          <button aria-label="Tutorial" className="resend-records-icon-button" type="button">
            <CircleHelp aria-hidden="true" size={18} />
          </button>
          <button aria-label="Forward instructions" className="resend-records-icon-button" type="button">
            <Forward aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
      {dnsRecordSections.map((section) => (
        <RecordSection key={section.subsections[0].title} section={section} />
      ))}
    </section>
  );
}

function RecordSection({ section }) {
  const isSendingSection = section.title === 'Enable Sending';

  return (
    <div className="resend-record-group">
      {isSendingSection ? <div className="resend-record-section-divider" aria-hidden="true" /> : null}
      {isSendingSection ? (
        <div className="resend-record-switch-header">
          <h2>{section.title}</h2>
          <button aria-checked="true" className="resend-switch is-checked" id="sending-toggle" role="switch" type="button">
            <span />
          </button>
        </div>
      ) : null}
      {section.title && !isSendingSection ? <h2>{section.title}</h2> : null}
      {section.subsections.map((subsection) => (
        <div className="resend-record-subsection" key={subsection.title}>
          <RecordTitle subsection={subsection} />
          <DnsTable records={section.records} />
        </div>
      ))}
    </div>
  );
}

function RecordTitle({ subsection }) {
  return (
    <h3 className="resend-record-title">
      <a href={subsection.href} rel="noreferrer" target="_blank">
        {subsection.title}
        {subsection.optional ? <span>(Optional)</span> : null}
        <ExternalLink aria-hidden="true" size={16} />
      </a>
    </h3>
  );
}

function DnsTable({ disabled = false, records }) {
  return (
    <DataTableV2
      columns={[
        { accessor: 'type', header: 'Type' },
        { accessor: 'name', header: 'Name', cell: ({ value }) => <CopyText value={value} /> },
        { accessor: 'content', header: 'Content', cell: ({ value }) => <CopyText value={value} /> },
        { accessor: 'ttl', header: 'TTL' },
        { accessor: 'priority', header: 'Priority' },
        { accessor: 'status', header: 'Status', cell: ({ value }) => (value ? <StatusBadge>{value}</StatusBadge> : null) },
      ]}
      data={records}
      fixed
      getRowId={(record) => `${record.type}-${record.name}-${record.content}`}
      scrollBaseClassName=""
      scrollClassName="resend-dns-table-shell"
      tableBaseClassName=""
      tableClassName={cx('resend-dns-table', disabled && 'is-disabled')}
      withShell={false}
    />
  );
}

function CopyText({ value }) {
  return <span className="resend-copy-text">{value}</span>;
}

export function EnableReceiving() {
  return (
    <section className="resend-enable-receiving">
      <div className="resend-section-divider" />
      <div className="resend-receiving-header">
        <h2>Enable Receiving</h2>
        <button aria-checked="false" className="resend-switch" id="receiving-toggle" role="switch" type="button">
          <span />
        </button>
      </div>
      <div hidden>
        <RecordTitle subsection={receivingRecordSection.subsections[0]} />
        <DnsTable disabled records={receivingRecordSection.records} />
      </div>
      <button className="resend-auto-configure" type="button">
        <CloudflareIcon size={18} />
        Auto configure
      </button>
    </section>
  );
}

function StatusBadge({ children }) {
  return <span className="resend-status-badge">{children}</span>;
}

function CloudflareIcon({ size = 18 }) {
  return (
    <svg aria-label="Cloudflare" fill="none" height={size} role="img" viewBox="0 0 24 24" width={size}>
      <rect fill="white" height="24" rx="12" width="24" />
      <path d="M15.6549 15.8589L15.7572 15.4676C15.8791 15.0023 15.8337 14.572 15.6293 14.256C15.4411 13.9648 15.1276 13.7934 14.7468 13.7734L7.53508 13.6725C7.51269 13.672 7.49073 13.6657 7.47098 13.6541C7.45117 13.6424 7.43421 13.6258 7.42128 13.6056C7.4087 13.5847 7.40064 13.5608 7.39779 13.5359C7.39501 13.5109 7.39751 13.4856 7.40509 13.4618C7.41746 13.4228 7.43991 13.3885 7.46966 13.3634C7.49949 13.3383 7.53521 13.3233 7.57261 13.3204L14.8512 13.2183C15.7146 13.1745 16.6494 12.3998 16.9767 11.4551L17.3917 10.2558C17.4088 10.2051 17.4127 10.1502 17.403 10.0972C16.9317 7.75297 15.0397 6 12.7775 6C10.6932 6 8.92347 7.48756 8.28867 9.55518C7.8597 9.19915 7.32487 9.03548 6.79142 9.09694C5.79147 9.20674 4.98748 10.097 4.88849 11.2028C4.86312 11.479 4.88168 11.7579 4.94348 12.0269C3.30998 12.0796 2 13.5594 2 15.3785C2.00021 15.5409 2.01105 15.703 2.03246 15.8637C2.03719 15.9008 2.0538 15.9348 2.07931 15.9595C2.10483 15.9842 2.13757 15.9979 2.17142 15.9981L15.4856 15.9999C15.4869 16 15.4881 16 15.4894 15.9999C15.527 15.9992 15.5635 15.9851 15.5933 15.9597C15.6231 15.9342 15.6447 15.8989 15.6549 15.8589Z" fill="#F6821F" />
      <path d="M18.0571 10.3428C17.9903 10.3428 17.9237 10.3446 17.8574 10.3483C17.8467 10.3492 17.8362 10.3517 17.8262 10.3559C17.8088 10.3625 17.7931 10.3736 17.7804 10.3883C17.7678 10.4031 17.7585 10.421 17.7535 10.4405L17.47 11.5236C17.3481 11.989 17.3934 12.4188 17.598 12.7349C17.7861 13.0264 18.0996 13.1975 18.4803 13.2174L20.0178 13.3195C20.0394 13.3203 20.0605 13.3266 20.0796 13.3381C20.0985 13.3495 20.1149 13.3656 20.1273 13.3853C20.14 13.4063 20.1482 13.4303 20.151 13.4555C20.1538 13.4806 20.1512 13.5061 20.1435 13.5299C20.1312 13.5689 20.1087 13.6031 20.079 13.6282C20.0493 13.6533 20.0136 13.6683 19.9763 13.6714L18.3789 13.7734C17.5116 13.8176 16.5769 14.5919 16.2499 15.5366L16.1345 15.8702C16.1297 15.8841 16.1279 15.8991 16.1294 15.9139C16.1309 15.9288 16.1354 15.9431 16.1429 15.9555C16.1503 15.968 16.1603 15.9784 16.172 15.9858C16.1838 15.9931 16.197 15.9973 16.2104 15.9979C16.2119 15.9979 16.2132 15.9979 16.2147 15.9979H21.7114C21.7433 15.9982 21.7745 15.987 21.8001 15.9658C21.8257 15.9447 21.8444 15.9149 21.8532 15.8809C21.9506 15.4967 21.9998 15.0995 21.9995 14.7005C21.9989 12.294 20.234 10.3428 18.0571 10.3428Z" fill="#FBAD41" />
    </svg>
  );
}
