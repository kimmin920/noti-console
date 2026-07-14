import { describe, expect, it } from 'vitest';
import {
  createSmsConsentDocumentTemplate,
  getMissingSmsConsentDocumentFields,
  SMS_CONSENT_DOCUMENT_INITIAL_INPUTS,
} from '../../components/sender-resources/smsConsentDocumentTemplate.js';

describe('SMS consent document template', () => {
  it('starts with no sender owner or document values', () => {
    expect(SMS_CONSENT_DOCUMENT_INITIAL_INPUTS).toEqual({
      ownerName: '',
      ownerSignature: '',
      phoneNumbers: '',
      sealImage: '',
    });
  });

  it('requires every user-provided document value', () => {
    expect(getMissingSmsConsentDocumentFields(SMS_CONSENT_DOCUMENT_INITIAL_INPUTS)).toEqual([
      'ownerName',
      'ownerSignature',
      'phoneNumbers',
      'sealImage',
    ]);
    expect(getMissingSmsConsentDocumentFields({
      ownerName: '홍길동 / 1990.01.01 / 개인',
      ownerSignature: '홍길동',
      phoneNumbers: '010-1234-5678',
      sealImage: 'data:image/png;base64,seal',
    })).toEqual([]);
  });

  it('marks every rendered schema as required', () => {
    const template = createSmsConsentDocumentTemplate(new ArrayBuffer(0));

    expect(template.schemas[0]).toHaveLength(4);
    expect(template.schemas[0].every((schema) => schema.required)).toBe(true);
  });

  it('uses the business document field layout for company numbers', () => {
    const template = createSmsConsentDocumentTemplate(new ArrayBuffer(0), {
      numberType: 'company',
    });

    expect(template.schemas[0]).toHaveLength(4);
    expect(template.schemas[0][0]).toMatchObject({
      name: 'ownerName',
      position: { x: 61, y: 78.5 },
    });
    expect(template.schemas[0][1]).toMatchObject({
      fontSize: 11,
      name: 'phoneNumbers',
      position: { x: 50, y: 114.7 },
    });
    expect(template.schemas[0][2]).toMatchObject({
      fontSize: 9,
      name: 'ownerSignature',
      position: { x: 151, y: 188 },
      width: 32.5,
    });
    expect(template.schemas[0][3]).toMatchObject({
      name: 'sealImage',
      position: { x: 184.5, y: 184.1 },
    });
  });
});
