import type {
  AudienceContactCsvParseResult,
  AudienceContactCsvStandardField,
} from './types';

const CONTACT_CSV_MAX_BYTES = 50 * 1024 * 1024;
const CONTACT_EMAIL_LIMIT = 1000;
const contactEmailPattern = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+\-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const contactCsvStandardFields: readonly AudienceContactCsvStandardField[] = [
  'email',
  'first_name',
  'last_name',
  'unsubscribed',
];

function parseContactEmails(value: string) {
  return value
    .split(/[\n,]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function getContactEmailsError(value: string) {
  if (value.trim().length === 0) return 'Email addresses are required';

  const emails = parseContactEmails(value);
  if (emails.length === 0) return 'At least one email address is required';
  if (emails.length > CONTACT_EMAIL_LIMIT) {
    return `No more than ${CONTACT_EMAIL_LIMIT} email addresses are allowed at a time`;
  }

  const seen = new Set<string>();
  for (const email of emails) {
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) return `Duplicate email address: ${email}`;
    seen.add(normalized);
    if (!contactEmailPattern.test(email)) return `Invalid email address: ${email}`;
  }

  return null;
}

function getContactCsvFileError(file: File) {
  if (file.size > CONTACT_CSV_MAX_BYTES) return 'CSV file must be 50 MB or less.';
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Please upload a single .csv file.';
  return null;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function getStandardField(value: string): AudienceContactCsvStandardField | undefined {
  const normalized = normalizeCsvHeader(value);
  return contactCsvStandardFields.find((field) => field === normalized);
}

function parseCsvRows(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && value[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += character;
  }

  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

async function parseContactCsvFile(file: File): Promise<AudienceContactCsvParseResult> {
  const rows = parseCsvRows(await file.text());
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const previewRow = dataRows[0] ?? [];

  return {
    mappings: headers.map((csvHeader, index) => {
      const previewValue = previewRow[index]?.trim();
      const suggestedField = getStandardField(csvHeader);
      return {
        csvHeader: csvHeader.trim(),
        ...(previewValue ? { previewValue } : {}),
        ...(suggestedField ? { suggestedField } : {}),
      };
    }),
    rowCount: dataRows.length,
  };
}

function getCustomPropertyKeyError(value: string) {
  return /^[A-Za-z0-9_]{1,100}$/.test(value)
    ? null
    : 'Use only letters, numbers, and underscores (up to 100).';
}

function getTargetId(target: { readonly field: string; readonly kind: 'standard' } | { readonly key: string; readonly kind: 'custom' }) {
  return target.kind === 'standard'
    ? `standard:${target.field}`
    : `custom:${target.key.toLowerCase()}`;
}

export {
  CONTACT_CSV_MAX_BYTES,
  contactCsvStandardFields,
  getContactCsvFileError,
  getContactEmailsError,
  getCustomPropertyKeyError,
  getTargetId,
  parseContactCsvFile,
  parseContactEmails,
};
