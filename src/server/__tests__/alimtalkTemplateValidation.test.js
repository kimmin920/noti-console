import { describe, expect, it } from 'vitest';

import {
  ALIMTALK_TEMPLATE_VALIDATION_MESSAGES as MESSAGES,
  detectUnsupportedAlimtalkEmoji,
  getAlimtalkTemplateContentDefaults,
  getAlimtalkTemplateTextSize,
  getAlimtalkTemplateVariables,
  hasAlimtalkTemplateVariables,
  validateAlimtalkTemplateAdvancedSections,
  validateAlimtalkTemplateContent,
  validateAlimtalkTemplateHighlightThumbnailFile,
  validateAlimtalkTemplateImageFile,
} from '../../features/console/alimtalkTemplates/alimtalkTemplateValidation.js';
import {
  createAlimtalkImagePatch,
  createAlimtalkImageReadFailurePatch,
  createHighlightThumbnailPatch,
  createHighlightThumbnailReadFailurePatch,
} from '../../features/console/alimtalkTemplates/alimtalkTemplateImageState.js';

const VALID_FORM = {
  formExtraText: '',
  formTemplateContent: '안녕하세요',
  formTemplateName: '주문 안내',
  isTextEmphasize: false,
};

const VALID_TEXT_EMPHASIS_FORM = {
  ...VALID_FORM,
  formEmphasizeSubtitle: '보조 문구',
  formEmphasizeTitle: '강조 제목',
  isTextEmphasize: true,
};

function validationMessages(overrides = {}) {
  return validateAlimtalkTemplateContent({ ...VALID_FORM, ...overrides }).map((error) => error.message);
}

function textEmphasisMessages(overrides = {}) {
  return validateAlimtalkTemplateContent({ ...VALID_TEXT_EMPHASIS_FORM, ...overrides }).map(
    (error) => error.message
  );
}

function advancedMessages(overrides = {}) {
  return validateAlimtalkTemplateAdvancedSections({ emphasizeType: 'ITEM_LIST', ...overrides }).map(
    (error) => error.message
  );
}

function actionMessages(overrides = {}) {
  return validateAlimtalkTemplateAdvancedSections({ emphasizeType: 'TEXT', ...overrides }).map(
    (error) => error.message
  );
}

function createActionButton(index, patch = {}) {
  return {
    buttonName: `버튼 ${index + 1}`,
    buttonType: 'BK',
    ...patch,
  };
}

function createQuickReply(index, patch = {}) {
  return {
    name: `바로가기 ${index + 1}`,
    type: 'BK',
    ...patch,
  };
}

describe('AlimTalk template content validation', () => {
  it('validates template name length and variable restrictions with source messages', () => {
    expect(validationMessages({ formTemplateName: 'a'.repeat(91) })).toEqual([
      MESSAGES.templateNameTooLong,
    ]);
    expect(validationMessages({ formTemplateName: 'a' })).toEqual([
      MESSAGES.templateNameTooShort,
    ]);
    expect(validationMessages({ formTemplateName: '템플릿 #{name}' })).toEqual([
      MESSAGES.templateNameNoVariables,
    ]);
  });

  it('validates required, too-short, and max-length content with the source text-size helper', () => {
    expect(getAlimtalkTemplateTextSize('a')).toBe(1);
    expect(getAlimtalkTemplateTextSize('가')).toBe(2);
    expect(validationMessages({ formTemplateContent: '' })).toEqual([
      MESSAGES.contentRequired,
    ]);
    expect(validationMessages({ formTemplateContent: 'a' })).toEqual([
      MESSAGES.contentTooShort,
    ]);
    expect(validationMessages({ formExtraText: 'b', formTemplateContent: 'a'.repeat(1000) })).toEqual([
      '템플릿 내용과 부가정보 내용 길이의 합은 1,000자를 넘을 수 없습니다.',
    ]);
  });

  it('uses the source max-content defaults for normal, text-emphasis, and item-list types', () => {
    expect(getAlimtalkTemplateContentDefaults()).toEqual({
      isTextEmphasize: false,
      maxContentLength: 1000,
    });
    expect(getAlimtalkTemplateContentDefaults({ emphasizeType: 'TEXT' })).toEqual({
      isTextEmphasize: true,
      maxContentLength: 1000,
    });
    expect(getAlimtalkTemplateContentDefaults({ emphasizeType: 'ITEM_LIST' })).toEqual({
      isTextEmphasize: false,
      maxContentLength: 164,
    });
    expect(validationMessages({
      emphasizeType: 'ITEM_LIST',
      formExtraText: 'b',
      formTemplateContent: 'a'.repeat(164),
    })).toEqual([
      '템플릿 내용과 부가정보 내용 길이의 합은 164자를 넘을 수 없습니다.',
    ]);
  });

  it('validates content variable syntax without rejecting valid AlimTalk variables', () => {
    expect(validationMessages({ formTemplateContent: '안내 #{name}' })).toEqual([]);
    expect(validationMessages({ formTemplateContent: '안내 #[name]' })).toEqual([
      MESSAGES.contentInvalidVariable,
    ]);
    expect(getAlimtalkTemplateVariables('', { strict: true })).toBe(false);
    expect(hasAlimtalkTemplateVariables('#{name}')).toBe(true);
    expect(hasAlimtalkTemplateVariables('#{name}', { strict: true })).toBe(false);
    expect(hasAlimtalkTemplateVariables('#[name]', { strict: true })).toBe(true);
  });

  it('validates unsupported emoji sequences from the source detector', () => {
    const unsupportedEmoji = '👩‍💻';

    expect(detectUnsupportedAlimtalkEmoji(`안내 ${unsupportedEmoji}`)).toMatchObject({
      brokenEmojis: [unsupportedEmoji],
      hasBrokenEmoji: true,
      message: `이모지가 저장 시 분리될 수 있습니다: ${unsupportedEmoji}`,
    });
    expect(validationMessages({ formTemplateContent: `안내 ${unsupportedEmoji}` })).toEqual([
      MESSAGES.contentUnsupportedEmoji,
    ]);
  });

  it('validates extra text length and variable restrictions', () => {
    expect(validationMessages({ formExtraText: 'a'.repeat(501) })).toEqual([
      MESSAGES.extraTooLong,
    ]);
    expect(validationMessages({ formExtraText: '부가 #{name}' })).toEqual([
      MESSAGES.extraNoVariables,
    ]);
  });

  it('validates text-emphasis title requirements, length, and invalid variable syntax', () => {
    expect(textEmphasisMessages({ formEmphasizeTitle: '' })).toEqual([
      MESSAGES.emphasisTitleRequired,
    ]);
    expect(textEmphasisMessages({ formEmphasizeTitle: 'a'.repeat(51) })).toEqual([
      MESSAGES.emphasisTitleTooLong,
    ]);
    expect(textEmphasisMessages({ formEmphasizeTitle: '강조 #[name]' })).toEqual([
      MESSAGES.emphasisTitleInvalidVariable,
    ]);
    expect(textEmphasisMessages({ formEmphasizeTitle: '강조 #{name}' })).toEqual([]);
  });

  it('validates text-emphasis subtitle requirements, length, and variable restriction', () => {
    expect(textEmphasisMessages({ formEmphasizeSubtitle: '' })).toEqual([
      MESSAGES.emphasisSubtitleRequired,
    ]);
    expect(textEmphasisMessages({ formEmphasizeSubtitle: 'a'.repeat(51) })).toEqual([
      MESSAGES.emphasisSubtitleTooLong,
    ]);
    expect(textEmphasisMessages({ formEmphasizeSubtitle: '보조 #{name}' })).toEqual([
      MESSAGES.emphasisSubtitleNoVariables,
    ]);
  });
});

describe('AlimTalk advanced template validation', () => {
  it('validates item-list templates require at least one source-backed advanced section', () => {
    expect(advancedMessages()).toEqual([
      MESSAGES.itemListSectionRequired,
    ]);
    expect(advancedMessages({ imageFileData: 'base64-image' })).toEqual([]);
    expect(advancedMessages({ useHeader: true, header: '주문 안내' })).toEqual([]);
  });

  it('validates image templates require uploaded image file data', () => {
    expect(advancedMessages({ emphasizeType: 'IMAGE' })).toContain(MESSAGES.imageRequired);
    expect(advancedMessages({ emphasizeType: 'IMAGE', imageFileData: 'base64-image' })).toEqual([]);
    expect(advancedMessages({ emphasizeType: 'TEXT' })).toEqual([]);
  });

  it('validates button and quick-reply action inputs by selected type', () => {
    expect(actionMessages({
      buttons: [{ buttonName: '', buttonType: 'WL' }],
    })).toEqual([
      `버튼 1: ${MESSAGES.actionNameRequired}`,
      `버튼 1: ${MESSAGES.actionWebLinkRequired}`,
    ]);

    expect(actionMessages({
      buttons: [{ buttonName: '자세히 보기', buttonType: 'WL', linkMo: 'https://m.example.com' }],
    })).toEqual([]);

    expect(actionMessages({
      buttons: [{ buttonName: '앱 열기', buttonType: 'AL', schemeAndroid: 'myapp://open' }],
    })).toEqual([
      `버튼 1: ${MESSAGES.actionAppLinkRequired}`,
    ]);

    expect(actionMessages({
      buttons: [{ buttonName: '앱 열기', buttonType: 'AL', linkAnd: 'myapp://android', linkIos: 'myapp://ios' }],
    })).toEqual([]);

    expect(actionMessages({
      buttons: [{ buttonName: '봇 전환', buttonType: 'BT', chatExtra: 'order' }],
    })).toEqual([
      `버튼 1: ${MESSAGES.buttonBotEventRequired}`,
    ]);

    expect(actionMessages({
      quickReplies: [{ name: '상담', type: 'WL' }],
    })).toEqual([
      `바로가기 1: ${MESSAGES.actionWebLinkRequired}`,
    ]);

    expect(actionMessages({
      quickReplies: [
        { name: '상담', type: 'BK' },
        { name: '앱 열기', schemeAndroid: 'myapp://android', schemeIos: 'myapp://ios', type: 'AL' },
      ],
    })).toEqual([]);
  });

  it('validates action count and channel-add placement limits', () => {
    expect(actionMessages({
      buttons: Array.from({ length: 6 }, (_, index) => createActionButton(index)),
    })).toEqual([
      MESSAGES.buttonTooMany,
    ]);

    expect(actionMessages({
      quickReplies: Array.from({ length: 11 }, (_, index) => createQuickReply(index)),
    })).toEqual([
      MESSAGES.quickReplyTooMany,
    ]);

    expect(actionMessages({
      buttons: Array.from({ length: 3 }, (_, index) => createActionButton(index)),
      quickReplies: [createQuickReply(0)],
    })).toEqual([
      MESSAGES.buttonTooManyWithQuickReplies,
    ]);

    expect(actionMessages({
      buttons: [
        createActionButton(0),
        createActionButton(1, { buttonName: '채널 추가', buttonType: 'AC' }),
      ],
    })).toEqual([
      MESSAGES.addChannelButtonPosition,
    ]);

    expect(actionMessages({
      buttons: [
        createActionButton(0, { buttonName: '채널 추가', buttonType: 'AC' }),
        createActionButton(1, { buttonName: '채널 추가', buttonType: 'AC' }),
      ],
    })).toEqual([
      MESSAGES.addChannelButtonDuplicate,
      MESSAGES.addChannelButtonPosition,
    ]);
  });

  it('validates header and highlight constraints with source messages', () => {
    expect(advancedMessages({ useHeader: true, header: '' })).toEqual([
      MESSAGES.itemListHeaderRequired,
    ]);
    expect(advancedMessages({ useHeader: true, header: 'a'.repeat(17) })).toEqual([
      MESSAGES.itemListHeaderTooLong,
    ]);
    expect(advancedMessages({ useHighlight: true, highlightTitle: '', highlightDescription: '' })).toEqual([
      MESSAGES.highlightTitleRequired,
      MESSAGES.highlightDescriptionRequired,
    ]);
    expect(advancedMessages({ useHighlight: true, highlightTitle: 'a'.repeat(31), highlightDescription: '설명' })).toEqual([
      MESSAGES.highlightTitleTooLong,
    ]);
    expect(advancedMessages({ useHighlight: true, highlightTitle: '제목', highlightDescription: '설명 #{value}' })).toEqual([
      MESSAGES.highlightDescriptionNoVariables,
    ]);
  });

  it('validates item count and summary constraints with source messages', () => {
    expect(advancedMessages({ useItemList: true, items: [{ title: '상품', description: '커피' }] })).toEqual([
      MESSAGES.itemListTooFew,
    ]);
    expect(advancedMessages({ useItemList: true, items: Array.from({ length: 11 }, () => ({ title: '상품' })) })).toEqual([
      MESSAGES.itemListTooMany,
    ]);
    expect(advancedMessages({ useItemList: true, items: [], useSummary: true, summaryTitle: '', summaryDescription: '' })).toEqual([
      MESSAGES.summaryTitleRequired,
      MESSAGES.summaryDescriptionRequired,
    ]);
    expect(advancedMessages({
      useItemList: true,
      useSummary: true,
      summaryDescription: '1,000원',
      summaryTitle: '합계#{x}',
    })).toEqual([
      MESSAGES.summaryTitleNoVariables,
    ]);
    expect(advancedMessages({
      useItemList: true,
      useSummary: true,
      useSummaryVariable: true,
      summaryDescription: '#{합계}원abc',
      summaryTitle: '합계',
    })).toEqual([
      MESSAGES.summaryVariableInvalidCharacters,
    ]);
    expect(advancedMessages({
      useItemList: true,
      useSummary: true,
      useSummaryVariable: true,
      summaryDescription: '#{합계}12345678901234',
      summaryTitle: '합계',
    })).toEqual([
      MESSAGES.summaryDescriptionTooLong,
    ]);
  });

  it('validates highlight thumbnail file metadata with source messages', () => {
    const invalidMessages = validateAlimtalkTemplateHighlightThumbnailFile({
      fileSize: 501 * 1024,
      fileType: 'image/gif',
      height: 100,
      width: 107,
    }).map((error) => error.message);

    expect(invalidMessages).toContain(MESSAGES.highlightThumbnailTooLarge);
    expect(invalidMessages).toContain(MESSAGES.highlightThumbnailInvalidType);
    expect(invalidMessages).toContain(MESSAGES.highlightThumbnailTooNarrow);
    expect(invalidMessages[3]).toContain('하이라이트 썸네일 이미지의 가로:세로 비율이 1:1이어야 합니다.');

    expect(validateAlimtalkTemplateHighlightThumbnailFile({
      fileSize: 500 * 1024,
      fileType: 'image/png',
      height: 108,
      width: 108,
    })).toEqual([]);
  });

  it('validates main image file metadata with source messages', () => {
    const invalidMessages = validateAlimtalkTemplateImageFile({
      fileSize: 501 * 1024,
      fileType: 'image/gif',
      height: 251,
      width: 499,
    }).map((error) => error.message);

    expect(invalidMessages).toContain(MESSAGES.imageTooLarge);
    expect(invalidMessages).toContain(MESSAGES.imageInvalidType);
    expect(invalidMessages).toContain(MESSAGES.imageTooNarrow);
    expect(invalidMessages[3]).toContain('이미지의 가로:세로 비율이 2:1이어야 합니다.');

    expect(validateAlimtalkTemplateImageFile({
      fileSize: 500 * 1024,
      fileType: 'image/png',
      height: 300,
      width: 600,
    })).toEqual([]);
  });

  it('creates source-reachable main image state patches', () => {
    expect(createAlimtalkImagePatch({
      fileName: 'alimtalk.png',
      fileSize: 500 * 1024,
      fileType: 'image/png',
      height: 300,
      imageDataUrl: 'data:image/png;base64,valid',
      width: 600,
    })).toEqual({
      imageCheckList: [
        { checked: true, error: false, errorLabel: '', label: '가로 너비 500px 이상 (권장 800px * 400px)' },
        { checked: true, error: false, errorLabel: '', label: '가로:세로 비율이 2:1' },
        { checked: true, error: false, errorLabel: '', label: 'JPEG, JPG, PNG 확장자' },
        { checked: true, error: false, errorLabel: '', label: '파일 사이즈 최대 500KB' },
      ],
      imageFileData: 'valid',
      imageFileInfo: {
        fileName: 'alimtalk.png',
        fileSize: 500 * 1024,
        fileType: 'image/png',
        height: 300,
        width: 600,
      },
      imageId: '',
      imageSrcPrefix: 'data:image/png;base64,',
    });

    expect(createAlimtalkImagePatch({
      fileName: 'invalid.gif',
      fileSize: 501 * 1024,
      fileType: 'image/gif',
      height: 251,
      imageDataUrl: 'data:image/gif;base64,invalid',
      width: 499,
    })).toEqual({
      imageCheckList: [
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.imageTooNarrow,
          label: '가로 너비 500px 이상 (권장 800px * 400px)',
        },
        {
          checked: false,
          error: true,
          errorLabel: '이미지의 가로:세로 비율이 2:1이어야 합니다. / 현재 비율 1.988:1 / 너비:499 높이:251',
          label: '가로:세로 비율이 2:1',
        },
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.imageInvalidType,
          label: 'JPEG, JPG, PNG 확장자',
        },
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.imageTooLarge,
          label: '파일 사이즈 최대 500KB',
        },
      ],
      imageFileData: '',
      imageFileInfo: {
        fileName: 'invalid.gif',
        fileSize: 501 * 1024,
        fileType: 'image/gif',
        height: 251,
        width: 499,
      },
      imageId: '',
      imageSrcPrefix: '',
    });

    expect(createAlimtalkImageReadFailurePatch({
      fileName: 'broken.png',
      fileSize: 7,
      fileType: 'image/png',
    })).toEqual({
      imageCheckList: [
        { checked: false, error: false, errorLabel: '', label: '가로 너비 500px 이상 (권장 800px * 400px)' },
        { checked: false, error: false, errorLabel: '', label: '가로:세로 비율이 2:1' },
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.imageUnreadable,
          label: 'JPEG, JPG, PNG 확장자',
        },
        { checked: false, error: false, errorLabel: '', label: '파일 사이즈 최대 500KB' },
      ],
      imageFileData: '',
      imageFileInfo: {
        fileName: 'broken.png',
        fileSize: 7,
        fileType: 'image/png',
        readError: true,
      },
      imageId: '',
      imageSrcPrefix: '',
    });
  });

  it('creates source-reachable highlight thumbnail state patches', () => {
    expect(createHighlightThumbnailPatch({
      fileSize: 500 * 1024,
      fileType: 'image/png',
      height: 108,
      imageDataUrl: 'data:image/png;base64,valid',
      width: 108,
    })).toEqual({
      highlighThumbnailImageUrl: 'data:image/png;base64,valid',
      highlightThumbnailCheckList: [
        { checked: true, error: false, errorLabel: '', label: '가로 너비 108px 이상' },
        { checked: true, error: false, errorLabel: '', label: '가로:세로 비율 1:1' },
        { checked: true, error: false, errorLabel: '', label: 'JPEG, JPG, PNG 확장자' },
        { checked: true, error: false, errorLabel: '', label: '파일 사이즈 최대 500KB' },
      ],
      highlightThumbnailFileInfo: {
        fileSize: 500 * 1024,
        fileType: 'image/png',
        height: 108,
        width: 108,
      },
      highlightThumbnailImageId: '',
    });

    expect(createHighlightThumbnailPatch({
      fileSize: 501 * 1024,
      fileType: 'image/gif',
      height: 100,
      imageDataUrl: 'data:image/gif;base64,invalid',
      width: 107,
    })).toEqual({
      highlighThumbnailImageUrl: '',
      highlightThumbnailCheckList: [
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.highlightThumbnailTooNarrow,
          label: '가로 너비 108px 이상',
        },
        {
          checked: false,
          error: true,
          errorLabel: '하이라이트 썸네일 이미지의 가로:세로 비율이 1:1이어야 합니다. / 현재 비율:1.07:1 / 너비:107 높이:100',
          label: '가로:세로 비율 1:1',
        },
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.highlightThumbnailInvalidType,
          label: 'JPEG, JPG, PNG 확장자',
        },
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.highlightThumbnailTooLarge,
          label: '파일 사이즈 최대 500KB',
        },
      ],
      highlightThumbnailFileInfo: {
        fileSize: 501 * 1024,
        fileType: 'image/gif',
        height: 100,
        width: 107,
      },
      highlightThumbnailImageId: '',
    });

    expect(createHighlightThumbnailReadFailurePatch({
      fileSize: 5,
      fileType: 'image/png',
    })).toEqual({
      highlighThumbnailImageUrl: '',
      highlightThumbnailCheckList: [
        { checked: false, error: false, errorLabel: '', label: '가로 너비 108px 이상' },
        { checked: false, error: false, errorLabel: '', label: '가로:세로 비율 1:1' },
        {
          checked: false,
          error: true,
          errorLabel: MESSAGES.highlightThumbnailUnreadable,
          label: 'JPEG, JPG, PNG 확장자',
        },
        { checked: false, error: false, errorLabel: '', label: '파일 사이즈 최대 500KB' },
      ],
      highlightThumbnailFileInfo: {
        fileSize: 5,
        fileType: 'image/png',
        readError: true,
      },
      highlightThumbnailImageId: '',
    });
  });
});
