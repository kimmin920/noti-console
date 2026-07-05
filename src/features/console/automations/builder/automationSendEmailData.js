export const defaultAutomationSendEmailTemplates = [
  {
    id: 'template-untitled-primary',
    name: 'Untitled Template',
    status: 'draft',
  },
  {
    id: 'template-product-welcome',
    name: 'Product welcome',
    status: 'published',
  },
  {
    id: 'template-trial-nudge',
    name: 'Trial nudge',
    status: 'published',
  },
  {
    id: 'template-event-receipt',
    name: 'Event receipt',
    status: 'draft',
  },
];

export const defaultAutomationSendEmailVariables = [
  {
    fallbackValue: null,
    id: 'variable-first-name',
    key: 'first_name',
    type: 'string',
  },
  {
    fallbackValue: 'Resend',
    id: 'variable-company',
    key: 'company',
    type: 'string',
  },
  {
    fallbackValue: null,
    id: 'variable-plan-count',
    key: 'plan_count',
    type: 'number',
  },
];

export const defaultAutomationSendEmailFormValues = {
  from: '',
  replyTo: '',
  subject: '',
  variables: {},
};

export const defaultVerifiedDomainNames = [
  'resend.dev',
  'example.com',
];
