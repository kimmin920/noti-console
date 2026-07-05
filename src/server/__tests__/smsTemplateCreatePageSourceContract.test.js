import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('SMS template create page source-control contract', () => {
  it('keeps MMS image upload internal while hiding provider fileId entry from users', () => {
    const createPage = readSource('../../features/console/templates/SmsTemplateCreatePage.jsx');
    const styles = readSource('../../styles/components.css');

    expect(createPage).toContain('useSmsTemplateAttachmentUploadMutation');
    expect(createPage).toContain('attachmentUploadMutation.mutateAsync');
    expect(createPage).toContain('buildSmsTemplateCreatePayloadWithUploadedAttachments');
    expect(createPage).toContain('선택한 이미지는 템플릿 등록 전에 자동 업로드합니다.');

    for (const removedUserFacingContract of [
      'provider <CodeToken>fileId</CodeToken>',
      'sms-template-file-id-input',
      'ProviderFileIdTags',
      'fileIdInput',
      'handleFileIdAdd',
      'fileId 추가',
      '직접 입력한 provider',
      'provider-safe fileId',
      'upload flow',
      '등록 payload',
    ]) {
      expect(createPage).not.toContain(removedUserFacingContract);
    }

    expect(styles).not.toContain('sms-template-file-id-row');
    expect(styles).not.toContain('sms-template-file-id-tags');
  });

  it('keeps SMS billing copy only beside the registration type summary', () => {
    const createPage = readSource('../../features/console/templates/SmsTemplateCreatePage.jsx');

    expect(createPage).toContain('전송유형 {model.providerSendType}');
    expect(createPage).toContain('변수 값이 길어져 실제 본문이');
    expect(countOccurrences(createPage, 'LMS 과금이 적용될 수 있습니다.')).toBe(1);

    for (const removedDuplicatedCopy of [
      '본문 바이트와 이미지 여부로 SMS/LMS/MMS 등록 타입을 자동 판정합니다.',
      '변수 값은 실제 발송 시 과금 타입을 바꿀 수 있습니다.',
      'SMS로 등록해도 변수 치환 후 90바이트를 넘으면 실제 발송 과금은 LMS가 될 수 있습니다.',
      '90바이트 초과 또는 이미지 추가 시 자동 전환됩니다.',
      '이미지를 추가하면 MMS로 자동 전환합니다.',
      '자동 {model.messageType}',
      '자동 판정 메시지 내용 검증',
    ]) {
      expect(createPage).not.toContain(removedDuplicatedCopy);
    }
  });

  it('does not render empty extracted-variable guidance copy', () => {
    const createPage = readSource('../../features/console/templates/SmsTemplateCreatePage.jsx');
    const styles = readSource('../../styles/components.css');

    expect(createPage).toContain('sms-template-variable-token-list');
    expect(createPage).toContain('추출된 변수');

    for (const removedEmptyVariableCopy of [
      '추출된 변수가 없습니다.',
      '본문에 <CodeToken>##code##</CodeToken>처럼 작성하면 미리보기에서도 변수 토큰으로 표시됩니다.',
      'sms-template-variable-empty',
    ]) {
      expect(createPage).not.toContain(removedEmptyVariableCopy);
      expect(styles).not.toContain(removedEmptyVariableCopy);
    }
  });

  it('does not expose provider SMS category id entry to users', () => {
    const createPage = readSource('../../features/console/templates/SmsTemplateCreatePage.jsx');

    expect(createPage).toContain('NOTI');
    expect(createPage).not.toContain('카테고리 ID');
    expect(createPage).not.toContain('provider 템플릿 카테고리의 숫자 ID를 입력합니다.');
    expect(createPage).not.toContain('name="categoryId"');
    expect(createPage).not.toContain('patchDraft({ categoryId: event.target.value })');
  });
});

function countOccurrences(text, pattern) {
  return text.split(pattern).length - 1;
}
