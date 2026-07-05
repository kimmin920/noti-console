import { describe, expect, it } from 'vitest';
import {
  formatParserStep,
  getFilteredPublEventVariables,
  getParserFormatLabel,
  normalizePublEventDetail,
} from '../../features/console/publEvents/publEventDetailModel.js';

describe('PUBL event detail variable model', () => {
  it('sorts variables by required and enabled priority when listing filtered variables', () => {
    const detail = normalizePublEventDetail({
      props: [
        { alias: 'optionalDisabled', enabled: false, label: '선택 미사용', rawPath: 'd', required: false, sortOrder: 1 },
        { alias: 'requiredDisabled', enabled: false, label: '필수 미사용', rawPath: 'b', required: true, sortOrder: 2 },
        { alias: 'optionalEnabled', enabled: true, label: '선택 사용', rawPath: 'c', required: false, sortOrder: 3 },
        { alias: 'requiredEnabled', enabled: true, label: '필수 사용', rawPath: 'a', required: true, sortOrder: 4 },
      ],
    });

    const variables = getFilteredPublEventVariables({ detail, filter: 'all', query: '' });

    expect(variables.map((variable) => variable.alias)).toEqual([
      'requiredEnabled',
      'requiredDisabled',
      'optionalEnabled',
      'optionalDisabled',
    ]);
  });

  it('keeps sort order inside the same required and enabled priority group', () => {
    const detail = normalizePublEventDetail({
      props: [
        { alias: 'second', enabled: true, label: '두 번째', rawPath: 'second', required: true, sortOrder: 2 },
        { alias: 'first', enabled: true, label: '첫 번째', rawPath: 'first', required: true, sortOrder: 1 },
      ],
    });

    const variables = getFilteredPublEventVariables({ detail, filter: 'all', query: '' });

    expect(variables.map((variable) => variable.alias)).toEqual(['first', 'second']);
  });

  it('searches visible table fields and does not match hidden raw paths', () => {
    const detail = normalizePublEventDetail({
      props: [
        { alias: 'displayAlias', enabled: true, label: '표시 라벨', rawPath: 'developerOnlyPath', required: true, sortOrder: 1 },
      ],
    });

    expect(getFilteredPublEventVariables({ detail, filter: 'all', query: 'displayAlias' })).toHaveLength(1);
    expect(getFilteredPublEventVariables({ detail, filter: 'all', query: 'developerOnlyPath' })).toHaveLength(0);
  });

  it('formats parser steps with user-facing format names', () => {
    expect(formatParserStep({ type: 'dateFormat', timezone: 'Asia/Seoul' }).label).toBe('날짜 표시');
    expect(formatParserStep({ type: 'currencyFormat', currencyPath: 'source.currency' }).label).toBe('금액 표시');
    expect(formatParserStep({ type: 'mapTemplate', template: '#{productName} #{qty}개' }).label).toBe('항목 문구 만들기');
  });

  it('returns the first visible format label for table cells', () => {
    expect(getParserFormatLabel([{ type: 'mapTemplate' }, { type: 'join' }])).toBe('항목 문구 만들기');
    expect(getParserFormatLabel([{ type: 'none' }])).toBe('');
    expect(getParserFormatLabel([])).toBe('');
  });

  it('filters variables with visible format rules only', () => {
    const detail = normalizePublEventDetail({
      props: [
        { alias: 'formatted', enabled: true, label: '날짜', parserPipeline: [{ type: 'dateFormat' }], rawPath: 'a' },
        { alias: 'noneStep', enabled: true, label: '가공 없음', parserPipeline: [{ type: 'none' }], rawPath: 'b' },
        { alias: 'empty', enabled: true, label: '빈 값', parserPipeline: [], rawPath: 'c' },
      ],
    });

    const variables = getFilteredPublEventVariables({ detail, filter: 'transformed', query: '' });

    expect(variables.map((variable) => variable.alias)).toEqual(['formatted']);
  });
});
