import { describe, expect, it } from 'vitest';
import {
  createSmsRelationshipProofDocumentTemplate,
  createSmsRelationshipProofInitialInputs,
  formatKoreanDocumentDate,
  getMissingSmsRelationshipProofFields,
} from '../../components/sender-resources/smsRelationshipProofDocumentTemplate.js';

describe('SMS relationship proof document template', () => {
  it('starts with the sender number and current document date only', () => {
    expect(createSmsRelationshipProofInitialInputs('02-1234-5678', new Date('2026-07-14T00:00:00+09:00'))).toEqual({
      ownerBusinessNumber: '',
      ownerCompanyName: '',
      ownerSealImage: '',
      ownerSignature: '',
      relationshipDescription: '',
      senderNumber: '02-1234-5678',
      signedDate: '2026년 07월 14일',
    });
  });

  it('requires every user-provided relationship value', () => {
    const initialInputs = createSmsRelationshipProofInitialInputs('', new Date('2026-07-14T00:00:00+09:00'));

    expect(getMissingSmsRelationshipProofFields(initialInputs)).toEqual([
      'ownerCompanyName',
      'ownerBusinessNumber',
      'senderNumber',
      'relationshipDescription',
      'ownerSignature',
      'ownerSealImage',
    ]);
    expect(getMissingSmsRelationshipProofFields({
      ...initialInputs,
      ownerBusinessNumber: '123-45-67890',
      ownerCompanyName: '주식회사 예시',
      ownerSealImage: 'data:image/png;base64,seal',
      ownerSignature: '주식회사 예시',
      relationshipDescription: '메시지 발송 업무 위수탁 관계',
      senderNumber: '02-1234-5678',
    })).toEqual([]);
  });

  it('places fields over the relationship proof blanks', () => {
    const template = createSmsRelationshipProofDocumentTemplate(new ArrayBuffer(0));

    expect(template.schemas[0]).toHaveLength(7);
    expect(template.schemas[0].every((schema) => schema.required)).toBe(true);
    expect(template.schemas[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'ownerCompanyName',
        position: { x: 50, y: 39.2 },
      }),
      expect.objectContaining({
        name: 'senderNumber',
        position: { x: 50, y: 100 },
      }),
      expect.objectContaining({
        fontSize: 8.5,
        name: 'relationshipDescription',
        position: { x: 50, y: 118.35 },
      }),
      expect.objectContaining({
        backgroundColor: '#ffffff',
        name: 'signedDate',
        position: { x: 84, y: 176.8 },
      }),
      expect.objectContaining({
        name: 'ownerSealImage',
        position: { x: 87.6, y: 206.3 },
        type: 'sealImage',
      }),
    ]));
  });

  it('formats dates using the Korean document convention', () => {
    expect(formatKoreanDocumentDate(new Date('2026-12-03T22:00:00Z'))).toBe('2026년 12월 04일');
  });
});
