import { SMS_CONSENT_DOCUMENT_FONT_NAME } from './smsConsentDocumentTemplate.js';

export const SMS_RELATIONSHIP_PROOF_DOCUMENT_FONT_NAME = SMS_CONSENT_DOCUMENT_FONT_NAME;

export const SMS_RELATIONSHIP_PROOF_REQUIRED_FIELDS = Object.freeze([
  'ownerCompanyName',
  'ownerBusinessNumber',
  'senderNumber',
  'relationshipDescription',
  'signedDate',
  'ownerSignature',
  'ownerSealImage',
]);

export function createSmsRelationshipProofInitialInputs(senderNumber = '', date = new Date()) {
  return {
    ownerBusinessNumber: '',
    ownerCompanyName: '',
    ownerSealImage: '',
    ownerSignature: '',
    relationshipDescription: '',
    senderNumber,
    signedDate: formatKoreanDocumentDate(date),
  };
}

export function getMissingSmsRelationshipProofFields(inputs = {}) {
  return SMS_RELATIONSHIP_PROOF_REQUIRED_FIELDS.filter((field) => {
    const value = inputs[field];

    return typeof value !== 'string' || value.trim() === '';
  });
}

const TEXT_FIELD_BASE = {
  alignment: 'left',
  backgroundColor: '',
  characterSpacing: 0,
  content: '',
  fontColor: '#202124',
  fontName: SMS_RELATIONSHIP_PROOF_DOCUMENT_FONT_NAME,
  fontSize: 8.5,
  lineHeight: 1,
  opacity: 1,
  padding: {
    bottom: 0.7,
    left: 1,
    right: 1,
    top: 0.7,
  },
  required: true,
  type: 'text',
  verticalAlignment: 'middle',
};

export function createSmsRelationshipProofDocumentTemplate(basePdf) {
  return {
    basePdf,
    schemas: [[
      {
        ...TEXT_FIELD_BASE,
        height: 8,
        name: 'ownerCompanyName',
        position: { x: 50, y: 39.2 },
        width: 150,
      },
      {
        ...TEXT_FIELD_BASE,
        height: 8,
        name: 'ownerBusinessNumber',
        position: { x: 50, y: 48.5 },
        width: 150,
      },
      {
        ...TEXT_FIELD_BASE,
        height: 8,
        name: 'senderNumber',
        position: { x: 50, y: 100 },
        width: 150,
      },
      {
        ...TEXT_FIELD_BASE,
        height: 8,
        name: 'relationshipDescription',
        position: { x: 50, y: 118.35 },
        width: 150,
      },
      {
        ...TEXT_FIELD_BASE,
        alignment: 'center',
        backgroundColor: '#ffffff',
        height: 8,
        name: 'signedDate',
        position: { x: 84, y: 176.8 },
        width: 42,
      },
      {
        ...TEXT_FIELD_BASE,
        height: 8,
        name: 'ownerSignature',
        position: { x: 13, y: 198.5 },
        width: 72,
      },
      {
        content: '',
        height: 16,
        name: 'ownerSealImage',
        opacity: 1,
        position: { x: 87.6, y: 206.3 },
        required: true,
        type: 'sealImage',
        width: 16,
      },
    ]],
  };
}

export function formatKoreanDocumentDate(date) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}년 ${values.month}월 ${values.day}일`;
}
