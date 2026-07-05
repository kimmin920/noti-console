import { parse, parseDate } from 'chrono-node';
import Sugar from 'sugar-date';
import 'sugar-date/locales/ko.js';

const HANGUL_PATTERN = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
const KOREAN_EXPLICIT_TIME_PATTERN = /([0-9０-９영일한이삼사오육칠팔구십]+)\s*시|[0-9０-９]{1,2}\s*[:：]\s*[0-9０-９]{2}/;
const KOREAN_DAYPARTS = [
  { pattern: /(아침|오전)/, value: '오전 6시' },
  { pattern: /(점심|정오)/, value: '오후 12시' },
  { pattern: /(오후)/, value: '오후 3시' },
  { pattern: /(저녁)/, value: '오후 6시' },
  { pattern: /(밤)/, value: '오후 10시' },
  { pattern: /(새벽)/, value: '오전 1시' },
];

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function normalizeKoreanScheduleText(value) {
  const text = value.trim().replace(/\s+/g, ' ');

  if (!HANGUL_PATTERN.test(text) || KOREAN_EXPLICIT_TIME_PATTERN.test(text)) {
    return text;
  }

  const daypart = KOREAN_DAYPARTS.find((item) => item.pattern.test(text));

  if (!daypart) {
    return text;
  }

  return text.replace(daypart.pattern, daypart.value);
}

function parseKoreanScheduleDate(value) {
  if (!HANGUL_PATTERN.test(value)) {
    return null;
  }

  const normalizedValue = normalizeKoreanScheduleText(value);
  const date = Sugar.Date.create(normalizedValue, 'ko');

  return isValidDate(date) ? date : null;
}

export function parseEmailSendFormScheduleDate(value, timeZone) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  const directDate = new Date(text);

  if (isValidDate(directDate)) {
    return directDate;
  }

  const koreanDate = parseKoreanScheduleDate(text);

  if (koreanDate) {
    return koreanDate;
  }

  return parseDate(text, { timezone: timeZone });
}

export function parseEmailSendFormScheduleText(value, timeZone) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  const koreanDate = parseKoreanScheduleDate(text);

  if (koreanDate) {
    return {
      label: text,
      originalText: text,
      value: koreanDate.toISOString(),
    };
  }

  const results = parse(text, { timezone: timeZone });
  const date = results[0]?.start?.date();

  if (!date) {
    return null;
  }

  return {
    label: results[0].text,
    originalText: text,
    value: date.toISOString(),
  };
}
