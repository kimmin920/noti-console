import { getDb } from '../../db/client.js';
import { resolveNhnKakaoBizmessageConfig, resolveNhnSmsConfig } from '../nhn/config.js';
import { NHN_ALIMTALK_COMMON_TEMPLATE_SOURCES } from '../nhn/kakaoCommonTemplateSources.js';
import { createNhnKakaoBizmessageClient } from '../nhn/kakaoBizmessageClient.js';
import { createNhnSmsClient } from '../nhn/smsClient.js';
import { CHANNELS, PROVIDERS, RELAY_ERROR_CODES, SENDER_RESOURCE_TYPES } from '../relay/constants.js';
import { NhnProviderError, RelayError, RelayValidationError, classifyProviderFailure } from '../relay/errors.js';
import {
  getBrandTemplatePreviewVariableSources,
  normalizeBrandTemplatePreviewFields,
} from './brandTemplatePreviewFields.js';
import { createTemplateCatalogRepository } from './repository.js';
import { ensureSmsTemplateCategoryForUser } from './smsTemplateCategories.js';

const USER_STATUS_ACTIVE = 'active';
const LINK_STATUS_ACTIVE = 'active';
const RESOURCE_STATUS_ACTIVE = 'active';
const ALIMTALK_APPROVED_STATUS = 'APR';
const ALIMTALK_APPROVED_STATUS_CODE = 'TSC03';
const ALIMTALK_TEMPLATE_STATUS_CODES = new Set(['TSC01', 'TSC02', 'TSC03', 'TSC04']);
const ALIMTALK_TEMPLATE_PAGE_SIZE = 1000;
const BRAND_TEMPLATE_PAGE_SIZE = 1000;
const SMS_TEMPLATE_PAGE_SIZE = 1000;
const MAX_TEMPLATE_PAGES = 50;
const BYTES_PER_KB = 1024;
const SMS_MMS_ATTACHMENT_ACCEPTED_EXTENSIONS = new Set(['.jpg', '.jpeg']);
const SMS_MMS_ATTACHMENT_MAX_FILE_BYTES = 300 * BYTES_PER_KB;
const SMS_MMS_ATTACHMENT_MAX_FILE_NAME_LENGTH = 45;
const ALIMTALK_TEMPLATE_IMAGE_ACCEPTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const ALIMTALK_TEMPLATE_IMAGE_MAX_FILE_BYTES = 500 * BYTES_PER_KB;
const ALIMTALK_TEMPLATE_IMAGE_MAX_FILE_NAME_LENGTH = 100;
const BASE64_BODY_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const SMS_TEMPLATE_CREATE_FORBIDDEN_FIELDS = new Set([
  'categoryId',
  'content',
  'fallback',
  'messagePurpose',
  'recipientGroupingKey',
  'recipientList',
  'recipients',
  'requestDate',
  'scheduledAt',
  'sender',
  'senderGroupingKey',
  'sendLog',
  'sendNo',
  'statsId',
  'templateLanguage',
  'templateParameter',
  'targeting',
  'unsubscribe',
  'unsubscribeAuthNo',
  'unsubscribeContent',
  'unsubscribeNo',
  'unsubscribePhoneNumber',
  'unsubscribeSenderNo',
  'unsubscribeServiceNo',
]);
const BRAND_TEMPLATE_CREATE_CHAT_BUBBLE_TYPES = new Set([
  'TEXT',
  'IMAGE',
  'WIDE',
  'WIDE_ITEM_LIST',
  'PREMIUM_VIDEO',
  'COMMERCE',
  'CAROUSEL_FEED',
  'CAROUSEL_COMMERCE',
]);
const BRAND_TEMPLATE_CREATE_FORBIDDEN_FIELDS = new Set([
  'clientRequestId',
  'createUser',
  'fallback',
  'recipientGroupingKey',
  'recipientList',
  'recipients',
  'requestDate',
  'resellerCode',
  'reservation',
  'scheduledAt',
  'sendLog',
  'senderGroupingKey',
  'senderKey',
  'statsId',
  'targeting',
  'unsubscribe',
  'unsubscribeAuthNo',
  'unsubscribeContent',
  'unsubscribeNo',
  'unsubscribePhoneNumber',
  'unsubscribeSenderNo',
  'unsubscribeServiceNo',
]);
const BRAND_TEMPLATE_CREATE_COMMON_FIELDS = new Set([
  'adult',
  'chatBubbleType',
  'templateName',
]);
const BRAND_TEMPLATE_CREATE_FIELDS_BY_TYPE = Object.freeze({
  TEXT: new Set(['buttons', 'content', 'coupon']),
  IMAGE: new Set(['buttons', 'content', 'coupon', 'image']),
  WIDE: new Set(['buttons', 'content', 'coupon', 'image']),
  WIDE_ITEM_LIST: new Set(['buttons', 'coupon', 'header', 'item']),
  PREMIUM_VIDEO: new Set(['buttons', 'content', 'coupon', 'header', 'video']),
  COMMERCE: new Set(['additionalContent', 'buttons', 'commerce', 'coupon', 'image']),
  CAROUSEL_FEED: new Set(['carousel']),
  CAROUSEL_COMMERCE: new Set(['carousel']),
});
const ALIMTALK_TEMPLATE_CREATE_ALLOWED_FIELDS = new Set([
  'buttons',
  'categoryCode',
  'quickReplies',
  'securityFlag',
  'templateCode',
  'templateContent',
  'templateEmphasizeType',
  'templateExtra',
  'templateHeader',
  'templateImageName',
  'templateImageUrl',
  'templateItem',
  'templateItemHighlight',
  'templateMessageType',
  'templateName',
  'templateRepresentLink',
  'templateSubtitle',
  'templateTitle',
]);
const ALIMTALK_TEMPLATE_CREATE_REQUIRED_FIELDS = new Set([
  'templateCode',
  'templateContent',
  'templateMessageType',
  'templateName',
]);
const ALIMTALK_TEMPLATE_CREATE_FORBIDDEN_FIELDS = new Set([
  'clientRequestId',
  'fallback',
  'file',
  'fileBody',
  'imageFileData',
  'imageFileInfo',
  'imageSrcPrefix',
  'recipientGroupingKey',
  'recipientList',
  'recipients',
  'requestDate',
  'reservation',
  'scheduledAt',
  'sendLog',
  'senderGroupingKey',
  'senderKey',
  'statsId',
  'targeting',
  'unsubscribe',
  'unsubscribeAuthNo',
  'unsubscribeContent',
  'unsubscribeNo',
  'unsubscribePhoneNumber',
  'unsubscribeSenderNo',
  'unsubscribeServiceNo',
]);

export const TEMPLATE_SOURCES = Object.freeze({
  GROUP: 'GROUP',
  SENDER_PROFILE: 'SENDER_PROFILE',
});

export function createDefaultTemplateCatalogService() {
  return createTemplateCatalogService({
    repository: createTemplateCatalogRepository(getDb()),
    smsClient: createLazyNhnSmsClient(),
    kakaoClient: createLazyNhnKakaoBizmessageClient(),
    alimtalkCommonTemplateSources: NHN_ALIMTALK_COMMON_TEMPLATE_SOURCES,
  });
}

export function createTemplateCatalogService({
  repository,
  smsClient,
  kakaoClient,
  alimtalkCommonTemplateSources = [],
  kakaoDefaultSenderGroupKey = null,
}) {
  const commonAlimtalkSources = resolveCommonAlimtalkTemplateSources({
    alimtalkCommonTemplateSources,
    kakaoDefaultSenderGroupKey,
  });

  return {
    async listAlimtalkTemplates({ actorUserId, senderResourceId, query = {} }) {
      const user = await requireActiveUser(repository, actorUserId);
      const row = await getOptionalActiveUserSenderResource({
        repository,
        user,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      });
      const resource = row?.resource ?? null;
      const templates = [];
      const listCommonTemplates = shouldListCommonAlimtalkTemplates(query);

      if (listCommonTemplates) {
        for (const commonSource of commonAlimtalkSources) {
          templates.push(
            ...(await listApprovedAlimtalkTemplatesForSender({
              kakaoClient,
              senderKey: commonSource.senderKey,
              source: TEMPLATE_SOURCES.GROUP,
              sourceKey: commonSource.senderKey,
              ownerLabel: commonSource.label,
              requestedQuery: query,
            }))
          );
        }
      }

      if (resource && !isCommonAlimtalkSenderKey(resource.value, commonAlimtalkSources)) {
        templates.push(
          ...(await listApprovedAlimtalkTemplatesForSender({
            kakaoClient,
            senderKey: resource.value,
            source: TEMPLATE_SOURCES.SENDER_PROFILE,
            sourceKey: resource.value,
            ownerLabel: resource.displayName || resource.value,
            requestedQuery: query,
          }))
        );
      }

      return {
        channel: CHANNELS.ALIMTALK,
        senderResource: resource ? toSenderResourceDto(resource) : null,
        templates: dedupeTemplates(templates),
      };
    },

    async createAlimtalkTemplate({ actorUserId, payload = {} }) {
      const { senderResourceId, providerBody } = normalizeAlimtalkTemplateCreatePayload(payload);
      const { resource } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      });
      const response = await kakaoClient.createAlimtalkTemplate({
        senderKey: resource.value,
        body: providerBody,
      });
      const providerTemplate = extractAlimtalkTemplateDetail(response);
      const templateCode = extractCreatedAlimtalkTemplateCode(response, providerTemplate) ?? providerBody.templateCode;
      const template = normalizeAlimtalkTemplate({
        ...providerBody,
        ...(providerTemplate && typeof providerTemplate === 'object' ? providerTemplate : {}),
        senderKey: resource.value,
        status: providerTemplate?.status ?? providerTemplate?.templateStatus ?? 'TSC01',
        templateCode,
      }, {
        source: TEMPLATE_SOURCES.SENDER_PROFILE,
        sourceKey: resource.value,
        ownerLabel: resource.displayName || resource.value,
      });

      return {
        channel: CHANNELS.ALIMTALK,
        senderResource: toSenderResourceDto(resource),
        templateCode,
        template,
      };
    },

    async uploadAlimtalkTemplateImage({ actorUserId, payload = {} }) {
      const { senderResourceId, file, kind } = normalizeAlimtalkTemplateImageUploadPayload(payload);
      const { resource } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      });
      const response = await kakaoClient.uploadAlimtalkTemplateImage({
        blob: file.blob,
        fileName: file.fileName,
        kind,
      });
      const image = extractAlimtalkTemplateImageUpload(response);

      return {
        channel: CHANNELS.ALIMTALK,
        senderResource: toSenderResourceDto(resource),
        ...image,
      };
    },

    async listSmsTemplates({ actorUserId, senderResourceId, query = {} }) {
      const { resource } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      });
      const templates = await listUsableSmsTemplatesForSendNo({
        smsClient,
        sendNo: resource.value,
        requestedQuery: query,
      });

      return {
        channel: CHANNELS.SMS,
        senderResource: toSenderResourceDto(resource),
        templates,
      };
    },

    async createSmsTemplate({ actorUserId, payload = {} }) {
      const { senderResourceId, providerBody } = normalizeSmsTemplateCreatePayload(payload);
      const { resource, user } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      });
      const templateCategory = await ensureSmsTemplateCategoryForUser({
        smsClient,
        user,
      });
      const providerPayload = {
        ...providerBody,
        categoryId: templateCategory.categoryId,
        sendNo: resource.value,
      };

      await smsClient.createTemplate(providerPayload);

      return {
        channel: CHANNELS.SMS,
        senderResource: toSenderResourceDto(resource),
        templateCode: providerPayload.templateId,
        template: await getCreatedSmsTemplateDto({
          smsClient,
          providerPayload,
          resource,
        }),
      };
    },

    async uploadSmsTemplateAttachment({ actorUserId, payload = {} }) {
      const { senderResourceId, fileName, fileBody, byteSize } = normalizeSmsTemplateAttachmentUploadPayload(payload);
      const { resource, user } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
      });
      const response = await smsClient.uploadAttachFile({
        fileName,
        fileBody,
        createUser: normalizeAttachmentCreateUser(user.id),
      });

      return {
        channel: CHANNELS.SMS,
        senderResource: toSenderResourceDto(resource),
        fileId: extractSmsAttachmentUploadFileId(response),
        fileName,
        byteSize,
      };
    },

    async listBrandTemplates({ actorUserId, senderResourceId, query = {} }) {
      const { resource } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      });
      const templates = await listUsableBrandTemplatesForSender({
        kakaoClient,
        senderKey: resource.value,
        ownerLabel: resource.displayName || resource.value,
        requestedQuery: query,
      });

      return {
        channel: CHANNELS.BRAND_MESSAGE,
        senderResource: toSenderResourceDto(resource),
        templates,
      };
    },

    async createBrandTemplate({ actorUserId, payload = {} }) {
      const { senderResourceId, providerBody } = normalizeBrandTemplateCreatePayload(payload);
      const { resource } = await requireActiveUserSenderResource({
        repository,
        actorUserId,
        senderResourceId,
        resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
      });
      const response = await kakaoClient.createBrandTemplate({
        senderKey: resource.value,
        body: providerBody,
      });
      const providerTemplate = extractBrandTemplateDetail(response);
      const templateCode = extractCreatedBrandTemplateCode(response, providerTemplate);
      const template = normalizeBrandTemplate({
        ...providerBody,
        ...(providerTemplate && typeof providerTemplate === 'object' ? providerTemplate : {}),
        ...(templateCode ? { templateCode } : {}),
      }, { ownerLabel: resource.displayName || resource.value });

      return {
        channel: CHANNELS.BRAND_MESSAGE,
        senderResource: toSenderResourceDto(resource),
        templateCode,
        template,
      };
    },

    async getTemplate({ actorUserId, channel, templateCode, query = {} }) {
      const normalizedChannel = normalizeChannel(channel);

      if (normalizedChannel === CHANNELS.ALIMTALK) {
        return {
          channel: CHANNELS.ALIMTALK,
          template: await getAlimtalkTemplate({
            repository,
            kakaoClient,
            actorUserId,
            senderResourceId: query.senderResourceId,
            templateCode,
            source: query.source,
            sourceKey: query.sourceKey,
            commonAlimtalkSources,
          }),
        };
      }

      if (normalizedChannel === CHANNELS.SMS) {
        return {
          channel: CHANNELS.SMS,
          template: await getSmsTemplate({
            repository,
            smsClient,
            actorUserId,
            senderResourceId: query.senderResourceId,
            templateCode,
          }),
        };
      }

      if (normalizedChannel === CHANNELS.BRAND_MESSAGE) {
        return {
          channel: CHANNELS.BRAND_MESSAGE,
          template: await getBrandTemplate({
            repository,
            kakaoClient,
            actorUserId,
            senderResourceId: query.senderResourceId,
            templateCode,
          }),
        };
      }

      throw new RelayValidationError('channel must be alimtalk, brand-message, or sms.');
    },

  };
}

async function requireActiveUserSenderResource({ repository, actorUserId, senderResourceId, resourceType }) {
  const user = await requireActiveUser(repository, actorUserId);
  const normalizedSenderResourceId = normalizeRequiredString(senderResourceId, 'senderResourceId');
  const row = await repository.getUserSenderResource({
    userId: user.id,
    senderResourceId: normalizedSenderResourceId,
  });

  if (!row || !isActiveUserResource(row)) {
    throw forbidden('An active sender resource is required.');
  }

  if (row.resource.provider !== PROVIDERS.NHN || row.resource.type !== resourceType) {
    throw forbidden('Sender resource type does not match this catalog.');
  }

  return { ...row, user };
}

async function getOptionalActiveUserSenderResource({ repository, user, senderResourceId, resourceType }) {
  const normalizedSenderResourceId = normalizeOptionalString(senderResourceId);

  if (!normalizedSenderResourceId) {
    return null;
  }

  const row = await repository.getUserSenderResource({
    userId: user.id,
    senderResourceId: normalizedSenderResourceId,
  });

  if (!row || !isActiveUserResource(row)) {
    throw forbidden('An active sender resource is required.');
  }

  if (row.resource.provider !== PROVIDERS.NHN || row.resource.type !== resourceType) {
    throw forbidden('Sender resource type does not match this catalog.');
  }

  return row;
}

async function requireActiveUser(repository, actorUserId) {
  const userId = normalizeOptionalString(actorUserId);

  if (!userId) {
    throw unauthorized();
  }

  const user = await repository.getUserById(userId);

  if (!user || user.status !== USER_STATUS_ACTIVE) {
    throw unauthorized();
  }

  return user;
}

function isActiveUserResource({ link, resource }) {
  return link.status === LINK_STATUS_ACTIVE && resource?.status === RESOURCE_STATUS_ACTIVE;
}

async function listApprovedAlimtalkTemplatesForSender({
  kakaoClient,
  senderKey,
  source,
  sourceKey,
  ownerLabel,
  requestedQuery,
}) {
  const templates = [];
  const templateStatus = normalizeAlimtalkTemplateStatus(requestedQuery?.templateStatus)
    ?? ALIMTALK_APPROVED_STATUS_CODE;
  let pageNum = 1;
  let totalCount = null;

  while (pageNum <= MAX_TEMPLATE_PAGES) {
    const response = await kakaoClient.listAlimtalkTemplates({
      senderKey,
      templateStatus,
      pageNum,
      pageSize: ALIMTALK_TEMPLATE_PAGE_SIZE,
      ...pickTemplateQuery(requestedQuery, ['templateCode', 'templateName']),
    });
    const page = extractAlimtalkTemplatePage(response);
    totalCount = page.totalCount;
    templates.push(
      ...page.templates
        .filter((template) => isListableAlimtalkTemplate(template, templateStatus))
        .map((template) => normalizeAlimtalkTemplate(template, { source, sourceKey, ownerLabel }))
    );

    if (!hasNextPage({ pageNum, pageSize: page.pageSize, totalCount, receivedCount: page.templates.length })) {
      break;
    }

    pageNum += 1;
  }

  return templates;
}

async function listUsableSmsTemplatesForSendNo({ smsClient, sendNo, requestedQuery }) {
  const normalizedSendNo = normalizePhoneNumber(sendNo);
  const templates = [];
  let pageNum = 1;
  let totalCount = null;

  while (pageNum <= MAX_TEMPLATE_PAGES) {
    const response = await smsClient.listTemplates({
      useYn: 'Y',
      pageNum,
      pageSize: SMS_TEMPLATE_PAGE_SIZE,
      ...pickTemplateQuery(requestedQuery, ['categoryId', 'templateName']),
    });
    const page = extractSmsTemplatePage(response);
    totalCount = page.totalCount;
    templates.push(
      ...page.templates
        .filter(isUsableSmsTemplate)
        .filter((template) => normalizePhoneNumber(template.sendNo) === normalizedSendNo)
        .map(normalizeSmsTemplate)
    );

    if (!hasNextPage({ pageNum, pageSize: page.pageSize, totalCount, receivedCount: page.templates.length })) {
      break;
    }

    pageNum += 1;
  }

  return templates;
}

async function listUsableBrandTemplatesForSender({ kakaoClient, senderKey, ownerLabel, requestedQuery }) {
  const templates = [];
  let pageNum = 1;
  let totalCount = null;

  while (pageNum <= MAX_TEMPLATE_PAGES) {
    const response = await kakaoClient.listBrandTemplates({
      senderKey,
      pageNum,
      pageSize: BRAND_TEMPLATE_PAGE_SIZE,
      ...pickTemplateQuery(requestedQuery, ['templateCode', 'templateName']),
    });
    const page = extractBrandTemplatePage(response);
    totalCount = page.totalCount;
    templates.push(
      ...page.templates
        .filter(isUsableBrandTemplate)
        .map((template) => normalizeBrandTemplate(template, { ownerLabel }))
    );

    if (!hasNextPage({ pageNum, pageSize: page.pageSize, totalCount, receivedCount: page.templates.length })) {
      break;
    }

    pageNum += 1;
  }

  return templates;
}

async function getAlimtalkTemplate({
  repository,
  kakaoClient,
  actorUserId,
  senderResourceId,
  templateCode,
  source,
  sourceKey,
  commonAlimtalkSources,
}) {
  const user = await requireActiveUser(repository, actorUserId);
  const sourceFilter = normalizeTemplateSource(source);
  const row = sourceFilter === TEMPLATE_SOURCES.GROUP && !normalizeOptionalString(senderResourceId)
    ? null
    : await getOptionalActiveUserSenderResource({
      repository,
      user,
      senderResourceId,
      resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
    });
  const resource = row?.resource ?? null;
  const normalizedTemplateCode = normalizeRequiredString(templateCode, 'templateCode');
  const candidates = buildAlimtalkDetailCandidates({
    resource,
    source: sourceFilter,
    sourceKey,
    commonAlimtalkSources,
  });
  const rejectedErrors = [];

  for (const candidate of candidates) {
    try {
      const response = await kakaoClient.getAlimtalkTemplate({
        senderKey: candidate.senderKey,
        templateCode: normalizedTemplateCode,
      });
      const template = extractAlimtalkTemplateDetail(response);

      if (template && isApprovedAlimtalkTemplate(template)) {
        return normalizeAlimtalkTemplate(template, {
          source: candidate.source,
          sourceKey: candidate.sourceKey,
          ownerLabel: candidate.ownerLabel,
        });
      }

      rejectedErrors.push(new Error('Template is not approved.'));
    } catch (error) {
      if (isProviderRejected(error)) {
        rejectedErrors.push(error);
        continue;
      }

      throw error;
    }
  }

  throw notFound('Template was not found or is not usable.', rejectedErrors.at(-1));
}

async function getSmsTemplate({ repository, smsClient, actorUserId, senderResourceId, templateCode }) {
  const { resource } = await requireActiveUserSenderResource({
    repository,
    actorUserId,
    senderResourceId,
    resourceType: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
  });
  const normalizedTemplateCode = normalizeRequiredString(templateCode, 'templateCode');
  const response = await smsClient.getTemplate({ templateId: normalizedTemplateCode });
  const template = extractSmsTemplateDetail(response);

  if (!template || !isUsableSmsTemplate(template)) {
    throw notFound('Template was not found or is not usable.');
  }

  if (normalizePhoneNumber(template.sendNo) !== normalizePhoneNumber(resource.value)) {
    throw forbidden('Template is not available for this sender resource.');
  }

  return normalizeSmsTemplate(template);
}

async function getBrandTemplate({ repository, kakaoClient, actorUserId, senderResourceId, templateCode }) {
  const { resource } = await requireActiveUserSenderResource({
    repository,
    actorUserId,
    senderResourceId,
    resourceType: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
  });
  const normalizedTemplateCode = normalizeRequiredString(templateCode, 'templateCode');
  const response = await kakaoClient.getBrandTemplate({
    senderKey: resource.value,
    templateCode: normalizedTemplateCode,
  });
  const template = extractBrandTemplateDetail(response);

  if (!template || !isUsableBrandTemplate(template)) {
    throw notFound('Template was not found or is not usable.');
  }

  return normalizeBrandTemplate(template, { ownerLabel: resource.displayName || resource.value });
}

async function getCreatedSmsTemplateDto({ smsClient, providerPayload, resource }) {
  try {
    const response = await smsClient.getTemplate({ templateId: providerPayload.templateId });
    const template = extractSmsTemplateDetail(response);

    if (template) {
      const templateSendNo = normalizePhoneNumber(template.sendNo);

      if (!templateSendNo || templateSendNo === normalizePhoneNumber(resource.value)) {
        return normalizeSmsTemplate({
          ...providerPayload,
          ...template,
          sendNo: template.sendNo ?? resource.value,
        });
      }

      throw forbidden('Created template is not available for this sender resource.');
    }
  } catch (error) {
    if (!isProviderRejected(error)) {
      throw error;
    }
  }

  return normalizeSmsTemplate(synthesizeSmsTemplate(providerPayload));
}

function synthesizeSmsTemplate(providerPayload) {
  return {
    ...providerPayload,
    delYn: 'N',
    attachFileYn: providerPayload.attachFileIdList?.length ? 'Y' : 'N',
    attachFileList: (providerPayload.attachFileIdList ?? []).map((fileId) => ({ fileId })),
  };
}

function normalizeAlimtalkTemplateCreatePayload(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const senderResourceId = normalizeRequiredString(source.senderResourceId, 'senderResourceId');
  const forbiddenField = Object.keys(source).find((key) => ALIMTALK_TEMPLATE_CREATE_FORBIDDEN_FIELDS.has(key));

  if (forbiddenField) {
    throw new RelayValidationError(`${forbiddenField} is not accepted for AlimTalk template registration.`);
  }

  const providerBody = {};

  for (const key of ALIMTALK_TEMPLATE_CREATE_ALLOWED_FIELDS) {
    const normalizedValue = normalizeAlimtalkTemplateCreateValue(source[key]);

    if (normalizedValue !== undefined) {
      providerBody[key] = normalizedValue;
    }
  }

  for (const field of ALIMTALK_TEMPLATE_CREATE_REQUIRED_FIELDS) {
    if (!normalizeOptionalString(providerBody[field])) {
      throw new RelayValidationError(`${field} is required.`);
    }
  }

  if (providerBody.templateCode.length > 20) {
    throw new RelayValidationError('templateCode must be 20 characters or less.');
  }

  if (providerBody.templateName.length > 150) {
    throw new RelayValidationError('templateName must be 150 characters or less.');
  }

  if (providerBody.templateContent.length > 1000) {
    throw new RelayValidationError('templateContent must be 1000 characters or less.');
  }

  if (
    ['AD', 'MI'].includes(providerBody.templateMessageType)
    && !normalizeOptionalString(providerBody.templateExtra)
  ) {
    throw new RelayValidationError('templateExtra is required when templateMessageType is AD or MI.');
  }

  return {
    senderResourceId,
    providerBody,
  };
}

function normalizeAlimtalkTemplateImageUploadPayload(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const senderResourceId = normalizeRequiredString(source.senderResourceId, 'senderResourceId');
  const fileName = normalizeRequiredBoundedString(
    source.fileName,
    'fileName',
    ALIMTALK_TEMPLATE_IMAGE_MAX_FILE_NAME_LENGTH
  );
  const contentType = normalizeRequiredString(source.fileType ?? source.contentType, 'fileType').toLowerCase();

  if (!ALIMTALK_TEMPLATE_IMAGE_ACCEPTED_TYPES.has(contentType)) {
    throw new RelayValidationError('fileType must be image/jpeg, image/jpg, or image/png.');
  }

  const { fileBody, byteSize } = normalizeAlimtalkTemplateImageBody(source.fileBody);

  if (byteSize > ALIMTALK_TEMPLATE_IMAGE_MAX_FILE_BYTES) {
    throw new RelayValidationError('fileBody must decode to 500 KB or less.');
  }

  return {
    senderResourceId,
    file: {
      blob: new Blob([Buffer.from(fileBody, 'base64')], { type: contentType }),
      fileName,
    },
    kind: normalizeAlimtalkTemplateImageKind(source.kind),
  };
}

function normalizeAlimtalkTemplateCreateValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeAlimtalkTemplateCreateValue)
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nestedValue]) => [key, normalizeAlimtalkTemplateCreateValue(nestedValue)])
      .filter(([, nestedValue]) => nestedValue !== undefined);

    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
}

function normalizeAlimtalkTemplateImageBody(value) {
  const fileBody = normalizeRequiredString(value, 'fileBody');

  if (!BASE64_BODY_PATTERN.test(fileBody)) {
    throw new RelayValidationError('fileBody must be base64 encoded.');
  }

  const byteSize = Buffer.byteLength(fileBody, 'base64');

  return { fileBody, byteSize };
}

function normalizeAlimtalkTemplateImageKind(value) {
  const kind = normalizeOptionalString(value) ?? 'template';

  if (kind === 'template' || kind === 'item-highlight') {
    return kind;
  }

  throw new RelayValidationError('kind must be template or item-highlight.');
}

function normalizeSmsTemplateCreatePayload(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const forbiddenField = Object.keys(source).find((key) => SMS_TEMPLATE_CREATE_FORBIDDEN_FIELDS.has(key));

  if (forbiddenField) {
    throw new RelayValidationError(`${forbiddenField} is not accepted for SMS template registration.`);
  }

  const providerBody = {
    templateId: normalizeRequiredBoundedString(source.templateId, 'templateId', 50),
    templateName: normalizeRequiredBoundedString(source.templateName, 'templateName', 50),
    sendType: normalizeSmsTemplateCreateSendType(source.sendType),
    body: normalizeRequiredBoundedString(source.body, 'body', 4000),
    useYn: normalizeSmsTemplateCreateUseYn(source.useYn),
  };
  const senderResourceId = normalizeRequiredString(source.senderResourceId, 'senderResourceId');
  const templateDesc = normalizeOptionalBoundedString(source.templateDesc, 'templateDesc', 100);
  const title = normalizeOptionalBoundedString(source.title, 'title', 120);
  const attachFileIdList = normalizeOptionalIntegerArray(source.attachFileIdList, 'attachFileIdList');

  if (providerBody.sendType === '1' && !title) {
    throw new RelayValidationError('title is required when sendType is 1.');
  }

  if (templateDesc) {
    providerBody.templateDesc = templateDesc;
  }

  if (title) {
    providerBody.title = title;
  }

  if (attachFileIdList) {
    providerBody.attachFileIdList = attachFileIdList;
  }

  return {
    senderResourceId,
    providerBody,
  };
}

function normalizeSmsTemplateCreateSendType(value) {
  const sendType = normalizeRequiredString(value, 'sendType');

  if (sendType !== '0' && sendType !== '1') {
    throw new RelayValidationError('sendType must be 0 or 1.');
  }

  return sendType;
}

function normalizeSmsTemplateCreateUseYn(value) {
  const useYn = normalizeRequiredString(value, 'useYn').toUpperCase();

  if (useYn !== 'Y' && useYn !== 'N') {
    throw new RelayValidationError('useYn must be Y or N.');
  }

  return useYn;
}

function normalizeRequiredBoundedString(value, name, maxLength) {
  const normalized = normalizeRequiredString(value, name);

  if (normalized.length > maxLength) {
    throw new RelayValidationError(`${name} must be ${maxLength} characters or less.`);
  }

  return normalized;
}

function normalizeOptionalBoundedString(value, name, maxLength) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new RelayValidationError(`${name} must be ${maxLength} characters or less.`);
  }

  return normalized;
}

function normalizeRequiredInteger(value, name) {
  if (value === undefined || value === null) {
    throw new RelayValidationError(`${name} is required.`);
  }

  let number = NaN;

  if (typeof value === 'number') {
    number = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    number = Number(value.trim());
  }

  if (!Number.isInteger(number)) {
    throw new RelayValidationError(`${name} must be an integer.`);
  }

  return number;
}

function normalizeOptionalIntegerArray(value, name) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new RelayValidationError(`${name} must be an integer array.`);
  }

  return value.map((item, index) => normalizeRequiredInteger(item, `${name}[${index}]`));
}

function normalizeSmsTemplateAttachmentUploadPayload(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const senderResourceId = normalizeRequiredString(source.senderResourceId, 'senderResourceId');
  const fileName = normalizeSmsTemplateAttachmentFileName(source.fileName);
  const { fileBody, byteSize } = normalizeSmsTemplateAttachmentFileBody(source.fileBody);

  return {
    senderResourceId,
    fileName,
    fileBody,
    byteSize,
  };
}

function normalizeSmsTemplateAttachmentFileName(value) {
  const fileName = normalizeRequiredBoundedString(
    value,
    'fileName',
    SMS_MMS_ATTACHMENT_MAX_FILE_NAME_LENGTH
  );
  const extension = getFileExtension(fileName);

  if (fileName.includes('/') || fileName.includes('\\')) {
    throw new RelayValidationError('fileName must not include path separators.');
  }

  if (!SMS_MMS_ATTACHMENT_ACCEPTED_EXTENSIONS.has(extension)) {
    throw new RelayValidationError('fileName must end with .jpg or .jpeg.');
  }

  return fileName;
}

function normalizeSmsTemplateAttachmentFileBody(value) {
  const fileBody = normalizeRequiredString(value, 'fileBody');

  if (!BASE64_BODY_PATTERN.test(fileBody)) {
    throw new RelayValidationError('fileBody must be a base64 string.');
  }

  const byteSize = Buffer.from(fileBody, 'base64').length;

  if (byteSize <= 0) {
    throw new RelayValidationError('fileBody is required.');
  }

  if (byteSize > SMS_MMS_ATTACHMENT_MAX_FILE_BYTES) {
    throw new RelayValidationError('fileBody must decode to 300 KB or less.');
  }

  return { fileBody, byteSize };
}

function getFileExtension(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  return extension ? `.${extension}` : '';
}

function normalizeAttachmentCreateUser(value) {
  return normalizeOptionalString(value) || 'messaging-app';
}

function extractSmsAttachmentUploadFileId(response) {
  const attachment = (
    response?.body?.data
    ?? response?.data
    ?? response?.attachFile
    ?? response?.body?.attachFile
    ?? response?.body
    ?? response
    ?? {}
  );
  const rawFileId = attachment.fileId ?? attachment.attachFileId ?? attachment.id;

  if (rawFileId === undefined || rawFileId === null || rawFileId === '') {
    throw invalidProviderAttachmentResponse();
  }

  const fileId = normalizeOptionalInteger(rawFileId);

  if (!Number.isInteger(fileId)) {
    throw invalidProviderAttachmentResponse();
  }

  return fileId;
}

function invalidProviderAttachmentResponse() {
  return new RelayError({
    code: RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
    message: 'Provider did not return an attachment file id.',
    retryable: false,
    status: 502,
  });
}

function normalizeBrandTemplateCreatePayload(payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const senderResourceId = normalizeRequiredString(source.senderResourceId, 'senderResourceId');
  const templateName = normalizeRequiredString(source.templateName, 'templateName');
  const chatBubbleType = normalizeBrandTemplateCreateChatBubbleType(source.chatBubbleType);
  const forbiddenField = Object.keys(source).find((key) => BRAND_TEMPLATE_CREATE_FORBIDDEN_FIELDS.has(key));

  if (forbiddenField) {
    throw new RelayValidationError(`${forbiddenField} is not accepted for Brand Message template registration.`);
  }

  const allowedFields = new Set([
    ...BRAND_TEMPLATE_CREATE_COMMON_FIELDS,
    ...(BRAND_TEMPLATE_CREATE_FIELDS_BY_TYPE[chatBubbleType] ?? []),
  ]);
  const providerBody = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'senderResourceId' || !allowedFields.has(key)) {
      continue;
    }

    const normalizedValue = normalizeBrandTemplateCreateValue(value);

    if (normalizedValue !== undefined) {
      providerBody[key] = normalizedValue;
    }
  }

  providerBody.templateName = templateName;
  providerBody.chatBubbleType = chatBubbleType;

  return {
    senderResourceId,
    providerBody,
  };
}

function normalizeBrandTemplateCreateChatBubbleType(value) {
  const chatBubbleType = normalizeRequiredString(value, 'chatBubbleType').toUpperCase();

  if (!BRAND_TEMPLATE_CREATE_CHAT_BUBBLE_TYPES.has(chatBubbleType)) {
    throw new RelayValidationError('chatBubbleType is not supported for Brand Message template registration.');
  }

  return chatBubbleType;
}

function normalizeBrandTemplateCreateValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeBrandTemplateCreateValue)
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, nestedValue]) => [key, normalizeBrandTemplateCreateValue(nestedValue)])
      .filter(([, nestedValue]) => nestedValue !== undefined);

    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
}

function buildAlimtalkDetailCandidates({ resource, source, sourceKey, commonAlimtalkSources }) {
  const commonCandidates = selectCommonAlimtalkSources(commonAlimtalkSources, sourceKey).map((commonSource) => ({
    senderKey: commonSource.senderKey,
    source: TEMPLATE_SOURCES.GROUP,
    sourceKey: commonSource.senderKey,
    ownerLabel: commonSource.label,
  }));
  const senderCandidate = resource
    ? {
        senderKey: resource.value,
        source: TEMPLATE_SOURCES.SENDER_PROFILE,
        sourceKey: resource.value,
        ownerLabel: resource.displayName || resource.value,
      }
    : null;

  if (source === TEMPLATE_SOURCES.GROUP) {
    return commonCandidates;
  }

  if (source === TEMPLATE_SOURCES.SENDER_PROFILE) {
    return senderCandidate ? [senderCandidate] : [];
  }

  return senderCandidate ? [senderCandidate, ...commonCandidates] : commonCandidates;
}

function normalizeAlimtalkTemplate(template, { source, sourceKey, ownerLabel }) {
  const templateCode = normalizeOptionalString(template.templateCode) || normalizeOptionalString(template.kakaoTemplateCode);
  const normalizedSourceKey = normalizeOptionalString(sourceKey);
  const body = normalizeOptionalString(template.templateContent) || '';
  const title = normalizeOptionalString(template.templateTitle);
  const subtitle = normalizeOptionalString(template.templateSubtitle);
  const header = normalizeOptionalString(template.templateHeader);
  const requiredVariables = extractTemplateVariables('kakao', [
    body,
    title,
    subtitle,
    header,
    ...(Array.isArray(template.buttons) ? template.buttons.flatMap(getActionVariableSources) : []),
    ...(Array.isArray(template.quickReplies) ? template.quickReplies.flatMap(getActionVariableSources) : []),
  ]);

  return {
    id: [source, normalizedSourceKey, templateCode].filter(Boolean).join(':'),
    value: [source, normalizedSourceKey, templateCode].filter(Boolean).join(':'),
    channel: CHANNELS.ALIMTALK,
    source,
    sourceKey: normalizedSourceKey,
    sourceLabel: ownerLabel,
    templateCode,
    kakaoTemplateCode: normalizeOptionalString(template.kakaoTemplateCode),
    templateName: normalizeOptionalString(template.templateName),
    label: buildTemplateLabel(template.templateName || templateCode, template.plusFriendId || ownerLabel),
    ownerKey: source === TEMPLATE_SOURCES.GROUP ? null : normalizeOptionalString(template.senderKey),
    ownerLabel: normalizeOptionalString(template.plusFriendId) || ownerLabel,
    plusFriendId: normalizeOptionalString(template.plusFriendId),
    plusFriendType: normalizeOptionalString(template.plusFriendType),
    senderKey: normalizeOptionalString(template.senderKey),
    providerStatus: normalizeAlimtalkProviderStatus(template),
    providerStatusCode: normalizeOptionalString(template.status ?? template.templateStatus),
    statusName: normalizeOptionalString(template.statusName),
    body,
    content: body,
    templateMessageType: normalizeOptionalString(template.templateMessageType),
    templateEmphasizeType: normalizeOptionalString(template.templateEmphasizeType),
    templateExtra: normalizeOptionalString(template.templateExtra),
    templateTitle: title,
    templateSubtitle: subtitle,
    templateHeader: header,
    templateItem: template.templateItem ?? null,
    templateItemHighlight: template.templateItemHighlight ?? null,
    templateRepresentLink: template.templateRepresentLink ?? null,
    templateImageName: normalizeOptionalString(template.templateImageName),
    templateImageUrl: normalizeOptionalString(template.templateImageUrl),
    buttons: Array.isArray(template.buttons) ? template.buttons.map(normalizeAction) : [],
    quickReplies: Array.isArray(template.quickReplies) ? template.quickReplies.map(normalizeAction) : [],
    requiredVariables,
    variables: requiredVariables.map((key) => ({ key, type: 'string', fallbackValue: '' })),
    securityFlag: Boolean(template.securityFlag),
    categoryCode: normalizeOptionalString(template.categoryCode),
    createDate: normalizeOptionalString(template.createDate),
    updateDate: normalizeOptionalString(template.updateDate),
  };
}

function normalizeSmsTemplate(template) {
  const templateId = normalizeOptionalString(template.templateId);
  const body = normalizeOptionalString(template.body) || '';
  const title = normalizeOptionalString(template.title);
  const attachments = extractSmsTemplateAttachments(template);
  const requiredVariables = extractTemplateVariables('sms', [body, title]);

  return {
    id: templateId,
    value: templateId,
    channel: normalizeSmsTemplateChannel(template),
    templateId,
    templateCode: templateId,
    templateName: normalizeOptionalString(template.templateName),
    label: normalizeOptionalString(template.templateName) || templateId,
    description: normalizeOptionalString(template.templateDesc),
    providerStatus: 'APR',
    providerStatusCode: normalizeOptionalString(template.useYn),
    categoryId: template.categoryId ?? null,
    categoryName: normalizeOptionalString(template.categoryName),
    sendNo: normalizeOptionalString(template.sendNo),
    sendType: normalizeOptionalString(template.sendType),
    sendTypeName: normalizeOptionalString(template.sendTypeName),
    title,
    body,
    content: body,
    attachFileYn: normalizeOptionalString(template.attachFileYn),
    attachments,
    requiredVariables,
    variables: requiredVariables.map((key) => ({ key, type: 'string', fallbackValue: '' })),
    createDate: normalizeOptionalString(template.createDate),
    updateDate: normalizeOptionalString(template.updateDate),
  };
}

function normalizeBrandTemplate(template, { ownerLabel }) {
  const templateCode = normalizeOptionalString(template.templateCode ?? template.code ?? template.templateId);
  const content = normalizeOptionalString(template.content ?? template.templateContent ?? template.body) || '';
  const chatBubbleType = normalizeOptionalString(template.chatBubbleType ?? template.messageType)?.toUpperCase() || 'TEXT';
  const buttons = Array.isArray(template.buttons) ? template.buttons.map(normalizeAction) : [];
  const previewFields = normalizeBrandTemplatePreviewFields(template);
  const requiredVariables = extractTemplateVariables('kakao', [
    content,
    template.title,
    template.description,
    ...getBrandTemplatePreviewVariableSources(template, previewFields),
    ...(Array.isArray(template.buttons) ? template.buttons.flatMap(getActionVariableSources) : []),
  ]);

  return {
    id: `BRAND:${templateCode}`,
    value: templateCode,
    channel: CHANNELS.BRAND_MESSAGE,
    source: TEMPLATE_SOURCES.SENDER_PROFILE,
    templateCode,
    templateName: normalizeOptionalString(template.templateName ?? template.name),
    label: buildTemplateLabel(template.templateName || template.name || templateCode, ownerLabel),
    ownerKey: normalizeOptionalString(template.senderKey),
    ownerLabel,
    providerStatus: normalizeOptionalString(template.status ?? template.templateStatus ?? template.providerStatus) || 'APR',
    providerStatusCode: normalizeOptionalString(template.status ?? template.templateStatus),
    chatBubbleType,
    content,
    body: content,
    title: normalizeOptionalString(template.title),
    description: normalizeOptionalString(template.description),
    buttons,
    coupon: template.coupon ?? null,
    ...previewFields,
    requiredVariables,
    variables: requiredVariables.map((key) => ({ key, type: 'string', fallbackValue: '' })),
    createDate: normalizeOptionalString(template.createDate),
    updateDate: normalizeOptionalString(template.updateDate),
  };
}

function extractAlimtalkTemplatePage(response) {
  const body = response?.templateListResponse ?? response?.body?.templateListResponse ?? response?.body ?? {};
  const templates = body.templates ?? response?.templates ?? [];

  return {
    templates: Array.isArray(templates) ? templates : [],
    pageSize: Number(body.pageSize ?? ALIMTALK_TEMPLATE_PAGE_SIZE),
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

function extractBrandTemplatePage(response) {
  const body = response?.templateListResponse ?? response?.body?.templateListResponse ?? response?.body ?? {};
  const templates = body.templates ?? body.data ?? response?.templates ?? [];

  return {
    templates: Array.isArray(templates) ? templates : [],
    pageSize: Number(body.pageSize ?? BRAND_TEMPLATE_PAGE_SIZE),
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

function extractSmsTemplatePage(response) {
  const body = response?.body ?? {};
  const templates = body.data ?? response?.data ?? [];

  return {
    templates: Array.isArray(templates) ? templates : [],
    pageSize: Number(body.pageSize ?? SMS_TEMPLATE_PAGE_SIZE),
    totalCount: normalizeOptionalInteger(body.totalCount),
  };
}

function extractAlimtalkTemplateDetail(response) {
  if (!response || typeof response !== 'object') return null;

  return (
    response.template ??
    response.templateResponse ??
    response.body?.template ??
    response.body?.templateResponse ??
    response.body?.data ??
    response.data ??
    (Array.isArray(response.templates) ? response.templates[0] : null) ??
    null
  );
}

function extractCreatedAlimtalkTemplateCode(response, template) {
  return normalizeOptionalString(
    response?.templateCode ??
    response?.body?.templateCode ??
    response?.body?.data?.templateCode ??
    response?.data?.templateCode ??
    response?.templateResponse?.templateCode ??
    template?.templateCode ??
    template?.kakaoTemplateCode
  );
}

function extractAlimtalkTemplateImageUpload(response) {
  const image = (
    response?.templateImageResponse ??
    response?.body?.templateImageResponse ??
    response?.body?.data ??
    response?.data ??
    response?.body ??
    response ??
    {}
  );
  const templateImageName = normalizeOptionalString(
    image.templateImageName ??
    image.imageName ??
    image.fileName
  );
  const templateImageUrl = normalizeOptionalString(
    image.templateImageUrl ??
    image.imageUrl ??
    image.url
  );

  if (!templateImageName || !templateImageUrl) {
    throw new RelayError({
      code: RELAY_ERROR_CODES.PROVIDER_UNAVAILABLE,
      message: 'Provider did not return an AlimTalk template image name and URL.',
      retryable: false,
      status: 502,
    });
  }

  return {
    templateImageName,
    templateImageUrl,
  };
}

function extractBrandTemplateDetail(response) {
  if (!response || typeof response !== 'object') return null;

  return (
    response.template ??
    response.templateResponse ??
    response.body?.template ??
    response.body?.templateResponse ??
    response.body?.data ??
    response.data ??
    (Array.isArray(response.templates) ? response.templates[0] : null) ??
    null
  );
}

function extractCreatedBrandTemplateCode(response, template) {
  return normalizeOptionalString(
    response?.templateCode ??
    response?.body?.templateCode ??
    response?.body?.data?.templateCode ??
    response?.data?.templateCode ??
    response?.templateResponse?.templateCode ??
    template?.templateCode ??
    template?.code ??
    template?.templateId
  );
}

function extractSmsTemplateDetail(response) {
  return response?.body?.data ?? response?.data ?? null;
}

function isApprovedAlimtalkTemplate(template) {
  return normalizeAlimtalkProviderStatus(template) === ALIMTALK_APPROVED_STATUS && !template.block && !template.dormant;
}

function isListableAlimtalkTemplate(template, templateStatus) {
  if (templateStatus === ALIMTALK_APPROVED_STATUS_CODE) {
    return isApprovedAlimtalkTemplate(template);
  }

  return !template.block && !template.dormant;
}

function normalizeAlimtalkProviderStatus(template) {
  const status = normalizeOptionalString(template.status ?? template.templateStatus ?? template.providerStatus)?.toUpperCase();

  if (status === 'APR' || status === ALIMTALK_APPROVED_STATUS_CODE) return ALIMTALK_APPROVED_STATUS;
  if (status === 'REJ' || status === 'TSC04') return 'REJ';
  return 'REQ';
}

function isUsableSmsTemplate(template) {
  return String(template.useYn ?? '').toUpperCase() === 'Y' && String(template.delYn ?? 'N').toUpperCase() !== 'Y';
}

function isUsableBrandTemplate(template) {
  const status = normalizeOptionalString(template.status ?? template.templateStatus ?? template.providerStatus)?.toUpperCase();

  if (template.block || template.dormant) return false;
  if (!status) return true;

  return ['A', 'APR', 'TSC03', 'APPROVED'].includes(status);
}

function extractSmsTemplateAttachments(template) {
  if (Array.isArray(template.attachFileList)) {
    return template.attachFileList.map((file) => ({
      fileId: file.fileId ?? null,
      fileName: normalizeOptionalString(file.fileName),
      uploadType: normalizeOptionalString(file.uploadType),
    }));
  }

  if (Array.isArray(template.attachFileIdList)) {
    return template.attachFileIdList.map((fileId) => ({
      fileId,
      fileName: null,
      uploadType: null,
    }));
  }

  return [];
}

function normalizeSmsTemplateChannel(template) {
  if (String(template.sendType) !== '1') return CHANNELS.SMS;
  if (String(template.attachFileYn ?? '').toUpperCase() === 'Y') return CHANNELS.MMS;
  if (extractSmsTemplateAttachments(template).length > 0) return CHANNELS.MMS;

  return CHANNELS.LMS;
}

function hasNextPage({ pageNum, pageSize, totalCount, receivedCount }) {
  if (!receivedCount) return false;
  if (Number.isInteger(totalCount)) {
    return pageNum * pageSize < totalCount;
  }

  return receivedCount >= pageSize;
}

function dedupeTemplates(templates) {
  const seen = new Set();
  const results = [];

  for (const template of templates) {
    const key = `${template.source}:${template.sourceKey ?? template.ownerKey ?? ''}:${template.templateCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(template);
  }

  return results;
}

function resolveCommonAlimtalkTemplateSources({
  alimtalkCommonTemplateSources,
  kakaoDefaultSenderGroupKey,
}) {
  const sources = Array.isArray(alimtalkCommonTemplateSources)
    ? alimtalkCommonTemplateSources
    : [];
  const normalizedSources = normalizeCommonAlimtalkTemplateSources(sources);

  if (normalizedSources.length) {
    return normalizedSources;
  }

  const legacySenderKey = normalizeOptionalString(kakaoDefaultSenderGroupKey);

  return legacySenderKey
    ? [
        {
          id: 'default',
          label: 'common',
          senderKey: legacySenderKey,
        },
      ]
    : [];
}

function normalizeCommonAlimtalkTemplateSources(sources) {
  const normalizedSources = [];
  const seenSenderKeys = new Set();

  for (const source of sources) {
    const senderKey = normalizeOptionalString(
      typeof source === 'string' ? source : source?.senderKey ?? source?.groupSenderKey
    );

    if (!senderKey || seenSenderKeys.has(senderKey)) {
      continue;
    }

    seenSenderKeys.add(senderKey);
    normalizedSources.push({
      id: normalizeOptionalString(source?.id) ?? senderKey,
      label: normalizeOptionalString(source?.label ?? source?.plusFriendId) ?? senderKey,
      senderKey,
    });
  }

  return normalizedSources;
}

function isCommonAlimtalkSenderKey(senderKey, sources) {
  const normalizedSenderKey = normalizeOptionalString(senderKey);

  return Boolean(
    normalizedSenderKey
    && sources.some((source) => source.senderKey === normalizedSenderKey)
  );
}

function shouldListCommonAlimtalkTemplates(query) {
  return normalizeAlimtalkTemplateStatus(query?.templateStatus) !== 'TSC04';
}

function selectCommonAlimtalkSources(commonAlimtalkSources, sourceKey) {
  const normalizedSourceKey = normalizeOptionalString(sourceKey);

  if (!normalizedSourceKey) {
    return commonAlimtalkSources;
  }

  return commonAlimtalkSources.filter((source) => (
    source.senderKey === normalizedSourceKey
    || source.id === normalizedSourceKey
    || source.label === normalizedSourceKey
  ));
}

function pickTemplateQuery(query, allowedKeys) {
  const result = {};

  for (const key of allowedKeys) {
    const value = normalizeOptionalString(query?.[key]);

    if (value) {
      result[key] = value;
    }
  }

  return result;
}

function normalizeAction(action) {
  return {
    ordering: action.ordering ?? null,
    type: normalizeOptionalString(action.type),
    name: normalizeOptionalString(action.name),
    linkMo: normalizeOptionalString(action.linkMo),
    linkPc: normalizeOptionalString(action.linkPc),
    schemeIos: normalizeOptionalString(action.schemeIos),
    schemeAndroid: normalizeOptionalString(action.schemeAndroid),
    bizFormId: action.bizFormId ?? null,
    pluginId: normalizeOptionalString(action.pluginId),
    telNumber: normalizeOptionalString(action.telNumber),
  };
}

function getActionVariableSources(action) {
  return [
    action.name,
    action.linkMo,
    action.linkPc,
    action.schemeIos,
    action.schemeAndroid,
    action.telNumber,
  ];
}

function extractTemplateVariables(syntax, values) {
  const pattern = syntax === 'sms' ? /##([^#]+)##/g : /#\{([^}]+)\}/g;
  const keyIndex = 1;
  const variables = new Set();

  for (const value of values) {
    if (typeof value !== 'string') continue;

    for (const match of value.matchAll(pattern)) {
      const key = normalizeOptionalString(match[keyIndex]);

      if (key) {
        variables.add(key);
      }
    }
  }

  return [...variables];
}

function buildTemplateLabel(name, ownerLabel) {
  const normalizedName = normalizeOptionalString(name) || 'Untitled template';
  const normalizedOwner = normalizeOptionalString(ownerLabel);

  return normalizedOwner ? `${normalizedName} - ${normalizedOwner}` : normalizedName;
}

function toSenderResourceDto(resource) {
  return {
    id: resource.id,
    resourceRef: resource.resourceRef,
    provider: resource.provider,
    type: resource.type,
    value: resource.value,
    displayName: resource.displayName,
    status: resource.status,
    providerStatus: resource.providerStatus,
  };
}

function normalizeChannel(value) {
  const channel = normalizeRequiredString(value, 'channel').toLowerCase();

  if (channel === CHANNELS.ALIMTALK || channel === CHANNELS.BRAND_MESSAGE || channel === CHANNELS.SMS) {
    return channel;
  }

  throw new RelayValidationError('channel must be alimtalk, brand-message, or sms.');
}

function normalizeTemplateSource(value) {
  const source = normalizeOptionalString(value)?.toUpperCase();

  if (!source) return null;
  if (source === 'COMMON' || source === TEMPLATE_SOURCES.GROUP) return TEMPLATE_SOURCES.GROUP;
  if (source === 'USER' || source === 'SENDER' || source === TEMPLATE_SOURCES.SENDER_PROFILE) {
    return TEMPLATE_SOURCES.SENDER_PROFILE;
  }

  throw new RelayValidationError('source must be GROUP or SENDER_PROFILE.');
}

function normalizeAlimtalkTemplateStatus(value) {
  const status = normalizeOptionalString(value)?.toUpperCase();

  if (!status) return null;
  if (ALIMTALK_TEMPLATE_STATUS_CODES.has(status)) return status;

  throw new RelayValidationError('templateStatus must be TSC01, TSC02, TSC03, or TSC04.');
}

function normalizeRequiredString(value, name) {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new RelayValidationError(`${name} is required.`);
  }

  return normalized;
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePhoneNumber(value) {
  return normalizeOptionalString(value)?.replace(/[\s-]/g, '') ?? '';
}

function normalizeOptionalInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function isProviderRejected(error) {
  return error instanceof NhnProviderError && classifyProviderFailure(error).code === RELAY_ERROR_CODES.PROVIDER_REJECTED;
}

function unauthorized() {
  return new RelayError({
    code: RELAY_ERROR_CODES.UNAUTHORIZED,
    message: 'Authentication is required.',
    retryable: false,
    status: 401,
  });
}

function forbidden(message) {
  return new RelayError({
    code: RELAY_ERROR_CODES.FORBIDDEN,
    message,
    retryable: false,
    status: 403,
  });
}

function notFound(message, cause) {
  return new RelayError({
    code: RELAY_ERROR_CODES.LOCAL_VALIDATION_FAILED,
    message,
    retryable: false,
    status: 404,
    cause,
  });
}

function createLazyNhnSmsClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnSmsClient({ config: resolveNhnSmsConfig() });
    }

    return client;
  }

  return {
    listTemplates: (...args) => getClient().listTemplates(...args),
    getTemplate: (...args) => getClient().getTemplate(...args),
    createTemplate: (...args) => getClient().createTemplate(...args),
    listCategories: (...args) => getClient().listCategories(...args),
    createCategory: (...args) => getClient().createCategory(...args),
    updateCategory: (...args) => getClient().updateCategory(...args),
    uploadAttachFile: (...args) => getClient().uploadAttachFile(...args),
  };
}

function createLazyNhnKakaoBizmessageClient() {
  let client;

  function getClient() {
    if (!client) {
      client = createNhnKakaoBizmessageClient({ config: resolveNhnKakaoBizmessageConfig() });
    }

    return client;
  }

  return {
    listAlimtalkTemplates: (...args) => getClient().listAlimtalkTemplates(...args),
    getAlimtalkTemplate: (...args) => getClient().getAlimtalkTemplate(...args),
    createAlimtalkTemplate: (...args) => getClient().createAlimtalkTemplate(...args),
    uploadAlimtalkTemplateImage: (...args) => getClient().uploadAlimtalkTemplateImage(...args),
    listBrandTemplates: (...args) => getClient().listBrandTemplates(...args),
    getBrandTemplate: (...args) => getClient().getBrandTemplate(...args),
    createBrandTemplate: (...args) => getClient().createBrandTemplate(...args),
  };
}
