import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('AlimTalk template create page source-control contract', () => {
  it('keeps the source-required image upload control and preview data path wired', () => {
    const advancedSections = readSource('../../features/console/alimtalkTemplates/AlimtalkTemplateAdvancedSections.jsx');
    const productionCreatePage = readSource('../../features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx');
    const fileUploadField = readSource('../../components/ui/FileUploadField.jsx');

    expect(advancedSections).toContain('알림톡 이미지 업로드 (JPEG, PNG)');
    expect(advancedSections).toContain('type="file"');
    expect(advancedSections).toContain('createAlimtalkImagePatch');
    expect(advancedSections).not.toContain('local-preview-image');

    expect(fileUploadField).toContain('type="file"');
    expect(productionCreatePage).toContain('FileUploadField');
    expect(productionCreatePage).toContain('imageFileData');
    expect(productionCreatePage).toContain('imageSrcPrefix');
    expect(productionCreatePage).toContain('imageUrl={showsImageSection && template.imageFileData');
  });

  it('wires AlimTalk template registration through page, mutation, route, service, and NHN client', () => {
    const newDesign = readSource('../../features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx');
    const payloadBuilder = readSource('../../features/console/alimtalkTemplates/alimtalkTemplateCreatePayload.js');
    const templateApi = readSource('../../features/console/templates/api.js');
    const templateQueries = readSource('../../features/console/templates/queries.js');
    const route = readSource('../../app/api/templates/alimtalk/route.js');
    const templateService = readSource('../templates/service.js');
    const kakaoClient = readSource('../nhn/kakaoBizmessageClient.js');
    const templatePage = readSource('../../features/console/templates/TemplatePage.jsx');

    expect(payloadBuilder).toContain('export function buildAlimtalkTemplateCreatePayload');
    expect(payloadBuilder).toContain('AlimtalkTemplateCreateValidationError');
    expect(payloadBuilder).toContain("templateMessageType: getTemplateMessageType(template)");

    expect(newDesign).toContain('useSenderResourcesQuery()');
    expect(newDesign).toContain('getAlimtalkSenderProfiles(senderResourcesQuery.data)');
    expect(newDesign).toContain('useAlimtalkTemplateCreateMutation()');
    expect(newDesign).toContain('buildAlimtalkTemplateCreatePayload(submissionTemplate');
    expect(newDesign).toContain('createTemplateMutation.mutateAsync(payload)');
    expect(newDesign).toContain('템플릿 코드');
    expect(newDesign).toContain('알림톡 템플릿을 등록했습니다.');

    expect(templateApi).toContain('export function createAlimtalkTemplate(payload)');
    expect(templateApi).toContain("relayPost('/api/templates/alimtalk', payload)");
    expect(templateQueries).toContain('export function useAlimtalkTemplateCreateMutation(options = {})');
    expect(templateQueries).toContain('mutationFn: createAlimtalkTemplate');
    expect(templateQueries).toContain('messageSendQueryKeys.alimtalkTemplates(senderResourceId)');
    expect(templateQueries).toContain('templateQueryKeys.alimtalkCatalog');

    expect(route).toContain('export async function POST(request)');
    expect(route).toContain('parseRelayRequest(request)');
    expect(route).toContain('createDefaultTemplateCatalogService().createAlimtalkTemplate');

    expect(templateService).toContain('async createAlimtalkTemplate({ actorUserId, payload = {} })');
    expect(templateService).toContain('normalizeAlimtalkTemplateCreatePayload(payload)');
    expect(templateService).toContain('kakaoClient.createAlimtalkTemplate({');
    expect(templateService).toContain('senderKey: resource.value');
    expect(templateService).toContain('createAlimtalkTemplate: (...args) => getClient().createAlimtalkTemplate(...args)');

    expect(kakaoClient).toContain('createAlimtalkTemplate: ({ senderKey, body }) =>');
    expect(kakaoClient).toContain('request(`${appRoot}/senders/${encodeURIComponent(senderKey)}/templates`,');
    expect(kakaoClient).toContain("method: 'POST'");

    expect(templatePage).toContain('selectedSenderResourceId');
    expect(templatePage).toContain('/templates/alimtalk/new?');
    expect(templatePage).toContain('/templates/brand/new');
  });

  it('uses the Resend-form design in production while keeping playground coverage', () => {
    const newDesign = readSource('../../features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx');
    const fileUploadField = readSource('../../components/ui/FileUploadField.jsx');
    const consolePages = readSource('../../features/console/ConsolePages.jsx');
    const registry = readSource('../../playground/componentRegistry.jsx');
    const productionRoute = readSource('../../app/templates/alimtalk/new/page.jsx');

    for (const primitive of [
      'ChoiceCardGroup',
      'FormField',
      'FileUploadField',
      'ValidationChecklist',
      'Notice',
      'KakaoTemplatePreview',
    ]) {
      expect(newDesign).toContain(primitive);
    }

    expect(newDesign).toContain('imageFileData');
    expect(newDesign).toContain('imageSrcPrefix');
    expect(newDesign).toContain('highlighThumbnailImageUrl');
    expect(newDesign).toContain('highlightThumbnailFileInfo');
    expect(newDesign).toContain('createAlimtalkImagePatch');
    expect(newDesign).toContain('createHighlightThumbnailPatch');
    expect(newDesign).toMatch(/highlightThumbnailImageId=\{\s*showsItemList && template\.useHighlight && !template\.highlighThumbnailImageUrl/);
    expect(newDesign).toContain("summaryDescription={showsItemList && template.useItemList && template.useSummary ? template.summaryDescription : ''}");
    expect(newDesign).toContain("summaryTitle={showsItemList && template.useItemList && template.useSummary ? template.summaryTitle : ''}");
    expect(newDesign).not.toContain('../solapi-alim-talk');
    expect(newDesign).not.toContain('provider 업로드');
    expect(newDesign).not.toContain('범위 밖');

    for (const sourceBackedCopy of [
      '특별한 강조 없이 글자만 포함하는 알림톡을 발송할 때 사용합니다.',
      '알림톡에 강조 제목을 표기합니다.',
      '알림톡에 이미지를 첨부합니다.',
      '알림톡에 리스트를 추가합니다.',
      '알림톡은 광고를 발송할 수 없습니다.',
      '혜택을 조건으로 개인정보 수집 등 특정 행위를 유도할 수 없습니다.',
      '앱 설치를 유도하는 내용을 포함할 수 없습니다.',
    ]) {
      expect(newDesign).toContain(sourceBackedCopy);
    }

    for (const buttonType of ['AC', 'WL', 'AL', 'DS', 'BK', 'MD', 'BC', 'BT']) {
      expect(newDesign).toContain(`['${buttonType}',`);
    }

    for (const actionField of [
      'BUTTON_ACTION_FIELD_SETS',
      'QUICK_REPLY_TYPES',
      'QUICK_REPLY_ACTION_FIELD_SETS',
      'ActionTypeFields',
      'linkMo',
      'linkPc',
      'schemeAndroid',
      'schemeIos',
      'chatExtra',
      'chatEvent',
      'ALIMTALK_TEMPLATE_BUTTON_MAX_WITH_QUICK_REPLIES',
      'ALIMTALK_TEMPLATE_QUICK_REPLY_MAX_COUNT',
      'getAlimtalkTemplateButtonLimit',
      'hasTooManyButtonsForQuickReplies',
    ]) {
      expect(newDesign).toContain(actionField);
    }

    expect(fileUploadField).toContain('type="file"');
    expect(registry).toContain("id: 'alimtalk-template-create-page'");
    expect(registry).toContain("id: 'alimtalk-template-create-page-new-design'");
    expect(registry).toContain('AlimtalkTemplateCreatePageNewDesign');
    expect(consolePages).toContain('AlimtalkTemplateCreatePageNewDesign as AlimtalkTemplateCreatePage');
    expect(productionRoute).toContain('templates-alimtalk-new');
  });

  it('keeps item-list summary rendering gated by source useItemList state', () => {
    const createPage = readSource('../../features/console/alimtalkTemplates/AlimtalkTemplateCreatePage.jsx');
    const newDesign = readSource('../../features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx');

    const summaryDescriptionGate = "summaryDescription={showsItemList && template.useItemList && template.useSummary ? template.summaryDescription : ''}";
    const summaryTitleGate = "summaryTitle={showsItemList && template.useItemList && template.useSummary ? template.summaryTitle : ''}";

    expect(createPage).toContain(summaryDescriptionGate);
    expect(createPage).toContain(summaryTitleGate);
    expect(newDesign).toContain(summaryDescriptionGate);
    expect(newDesign).toContain(summaryTitleGate);
    expect(newDesign).toContain('disabled={template.useItemList !== true}');
    expect(newDesign).toContain('getSummaryResetPatch()');
  });
});
