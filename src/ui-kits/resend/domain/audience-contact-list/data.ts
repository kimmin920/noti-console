import type {
  AudienceContact,
  AudienceContactTableHeader,
  AudienceSegment,
  AudienceStatus,
  AudienceStatusOption,
  AudienceTopic,
} from './types';

const audienceContactTableHeaders: readonly AudienceContactTableHeader[] = [
  { className: 'resend-ui-audience-contact-list__header--email', id: 'email', name: 'Email' },
  { className: 'resend-ui-audience-contact-list__header--segments', id: 'segments', name: 'Segments' },
  { className: 'resend-ui-audience-contact-list__header--status', id: 'status', name: 'Status' },
  { align: 'right', className: 'resend-ui-audience-contact-list__header--created', id: 'created_at', name: 'Added' },
  { className: 'resend-ui-audience-contact-list__header--actions', id: 'actions', name: '' },
] as const;

const audienceStatusOptions: readonly AudienceStatusOption[] = [
  { id: 'all', name: 'All subscriptions' },
  { id: 'subscribed', name: 'Subscribed' },
  { id: 'unsubscribed', name: 'Unsubscribed' },
] as const;

const defaultSelectedAudienceSegment: AudienceSegment = {
  contactsCount: 1240,
  id: 'segment-product',
  name: 'Product updates',
};

const newsletterSegment: AudienceSegment = {
  contactsCount: 842,
  id: 'segment-newsletter',
  name: 'Newsletter',
};

const foundersSegment: AudienceSegment = {
  contactsCount: 318,
  id: 'segment-founders',
  name: 'Founders',
};

const changelogTopic: AudienceTopic = { id: 'topic-changelog', name: 'Changelog' };
const productTopic: AudienceTopic = { id: 'topic-product', name: 'Product updates' };

const defaultAudienceSegments: readonly AudienceSegment[] = [
  defaultSelectedAudienceSegment,
  newsletterSegment,
  foundersSegment,
] as const;

const defaultAudienceTopics: readonly AudienceTopic[] = [changelogTopic, productTopic] as const;

const defaultAudienceContacts: readonly AudienceContact[] = [
  {
    createdAtDateTime: '2026-06-29T12:00:00.000Z',
    createdAtLabel: '3d ago',
    email: 'ada@example.com',
    firstName: 'Ada',
    id: 'contact-ada',
    lastName: 'Lovelace',
    segments: [defaultSelectedAudienceSegment, newsletterSegment],
    topics: [productTopic],
    unsubscribed: false,
  },
  {
    createdAtDateTime: '2026-06-24T09:30:00.000Z',
    createdAtLabel: '8d ago',
    email: 'alan@example.com',
    firstName: 'Alan',
    id: 'contact-alan',
    lastName: 'Turing',
    segments: [newsletterSegment],
    topics: [],
    unsubscribed: true,
  },
  {
    createdAtDateTime: '2026-06-20T08:45:00.000Z',
    createdAtLabel: '12d ago',
    email: 'grace@example.com',
    firstName: 'Grace',
    id: 'contact-grace',
    lastName: 'Hopper',
    segments: defaultAudienceSegments,
    topics: defaultAudienceTopics,
    unsubscribed: false,
  },
] as const;

function getAudienceContactStatus(contact: AudienceContact): Exclude<AudienceStatus, 'all'> {
  return contact.unsubscribed ? 'unsubscribed' : 'subscribed';
}

function getAudienceContactStatusAppearance(unsubscribed: boolean) {
  return unsubscribed ? 'red' : 'green';
}

function getAudienceContactFullName(contact: AudienceContact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
}

function getAudienceContactInitial(contact: AudienceContact) {
  return (getAudienceContactFullName(contact) || contact.email).slice(0, 1).toUpperCase();
}

export {
  audienceContactTableHeaders,
  audienceStatusOptions,
  defaultAudienceContacts,
  defaultAudienceSegments,
  defaultSelectedAudienceSegment,
  defaultAudienceTopics,
  getAudienceContactFullName,
  getAudienceContactInitial,
  getAudienceContactStatus,
  getAudienceContactStatusAppearance,
};
