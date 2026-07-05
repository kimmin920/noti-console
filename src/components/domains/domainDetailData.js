export const domainDetailNavItems = [
  { href: '/emails', label: 'Emails' },
  { href: '/automations', label: 'Automations' },
  { href: '/templates', label: 'Templates' },
  { href: '/audience', label: 'Audience' },
  { href: '/metrics', label: 'Metrics' },
  { href: '/domains', label: 'Domains' },
  { href: '/logs', label: 'Logs' },
  { href: '/api-keys', label: 'API keys' },
  { href: '/webhooks', label: 'Webhooks' },
  { href: '/settings', label: 'Settings' },
];

export const domainDetailSummary = [
  { label: 'Created', value: '4 days ago' },
  { label: 'Status', value: 'not started', tone: 'badge' },
  { label: 'Provider', value: 'Cloudflare', icon: 'cloudflare' },
  { label: 'Region', value: 'Tokyo', detail: '(ap-northeast-1)' },
];

export const dnsRecordSections = [
  {
    title: 'Domain Verification',
    records: [
      {
        content:
          'p=MIGfMA0GCSqG […] SIb3DQEBAQUAA4GNADCBiQKBgQDZmNyYT5WQ44tACSfmFyKWJ+pHIHORCyTd9EGJt3XIxV1lQ9fiXVCm/6NKEK5+Y8Xul7qFLNZBLdf61cIwpvfokp47f68RGq9/uIiNT8wwd4KciV2+kzEnZUEuTs5yPLoZjeInLxBHYEDxD9V6SF7iFWSgGayd1IRzoiBbQfhkOwIDAQAB',
        name: 'resend._domainkey.new',
        priority: '',
        status: 'not started',
        ttl: 'Auto',
        type: 'TXT',
      },
    ],
    subsections: [{ title: 'DKIM', href: 'https://resend.com/docs/dashboard/domains/introduction#what-are-dkim-records' }],
  },
  {
    title: 'Enable Sending',
    records: [
      {
        content: 'feedback-smtp. […] ap-northeast-1.amazonses.com',
        name: 'send.new',
        priority: '10',
        status: 'not started',
        ttl: 'Auto',
        type: 'MX',
      },
      {
        content: 'v=spf1 include […] :amazonses.com ~all',
        name: 'send.new',
        priority: '',
        status: 'not started',
        ttl: 'Auto',
        type: 'TXT',
      },
    ],
    subsections: [{ title: 'SPF', href: 'https://resend.com/docs/dashboard/domains/introduction#what-are-spf-records' }],
  },
  {
    title: null,
    records: [
      {
        content: 'v=DMARC1; p=none;',
        name: '_dmarc',
        priority: '',
        status: '',
        ttl: 'Auto',
        type: 'TXT',
      },
    ],
    subsections: [{ optional: true, title: 'DMARC', href: 'https://resend.com/docs/dashboard/domains/introduction#what-are-dmarc-records' }],
  },
];

export const receivingRecordSection = {
  records: [
    {
      content: 'inbound-smtp.a […] p-northeast-1.amazonaws.com',
      name: 'new',
      priority: '10',
      status: 'not started',
      ttl: 'Auto',
      type: 'MX',
    },
  ],
  subsections: [{ title: 'MX', href: 'https://resend.com/docs/dashboard/receiving/custom-domains' }],
};
