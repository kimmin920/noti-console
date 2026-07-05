import { CHANNELS, NHN_API_VERSIONS, NHN_PRODUCTS, NHN_PROVIDER_IDEMPOTENCY } from '../relay/constants.js';
import { resolveNhnKakaoBizmessageConfig } from './config.js';
import { requestNhnJson } from './http.js';

export function createNhnKakaoBizmessageClient(options = {}) {
  const config = options.config ?? resolveNhnKakaoBizmessageConfig();
  const request = (path, requestOptions = {}) =>
    requestNhnJson({
      baseUrl: config.baseUrl,
      secretKey: config.secretKey,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      path,
      ...requestOptions,
    });

  const appRoot = `/alimtalk/${NHN_API_VERSIONS.KAKAO_BIZMESSAGE}/appkeys/${encodeURIComponent(config.appKey)}`;
  const brandRoot = `/brand-message/${NHN_API_VERSIONS.BRAND_MESSAGE}/appkeys/${encodeURIComponent(config.appKey)}`;
  const idempotencyHeaders = (idempotencyKey) =>
    idempotencyKey ? { 'X-NC-API-IDEMPOTENCY-KEY': idempotencyKey } : undefined;

  return {
    product: NHN_PRODUCTS.KAKAO_BIZMESSAGE,
    providerIdempotencySupported: NHN_PROVIDER_IDEMPOTENCY[CHANNELS.ALIMTALK],
    sendAlimtalkMessage: (body, { idempotencyKey } = {}) =>
      request(`${appRoot}/messages`, {
        method: 'POST',
        body,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    sendRawAlimtalkMessage: (body, { idempotencyKey } = {}) =>
      request(`${appRoot}/raw-messages`, {
        method: 'POST',
        body,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    sendBrandFreestyleMessage: (body, { idempotencyKey } = {}) =>
      request(`${brandRoot}/freestyle-messages`, {
        method: 'POST',
        body,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    sendBrandBasicMessage: (body, { idempotencyKey } = {}) =>
      request(`${brandRoot}/basic-messages`, {
        method: 'POST',
        body,
        headers: idempotencyHeaders(idempotencyKey),
      }),
    listBrandMessages: (query) =>
      request(`${brandRoot}/messages`, {
        query,
      }),
    cancelBrandMessages: ({ requestId, recipientSeq }) =>
      request(`${brandRoot}/messages/${encodeURIComponent(requestId)}`, {
        method: 'DELETE',
        query: recipientSeq ? { recipientSeq } : undefined,
      }),
    getBrandMessage: ({ requestId, recipientSeq }) =>
      request(`${brandRoot}/messages/${encodeURIComponent(requestId)}/${encodeURIComponent(recipientSeq)}`),
    listBrandTemplates: ({ senderKey, ...query }) =>
      request(`${brandRoot}/senders/${encodeURIComponent(senderKey)}/templates`, {
        query,
      }),
    getBrandTemplate: ({ senderKey, templateCode }) =>
      request(`${brandRoot}/senders/${encodeURIComponent(senderKey)}/templates/${encodeURIComponent(templateCode)}`),
    createBrandTemplate: ({ senderKey, body }) =>
      request(`${brandRoot}/senders/${encodeURIComponent(senderKey)}/templates`, {
        method: 'POST',
        body,
      }),
    uploadBrandImage: (body) =>
      request(`${brandRoot}/images`, {
        method: 'POST',
        body,
      }),
    listAlimtalkMessages: (query) =>
      request(`${appRoot}/messages`, {
        query,
      }),
    cancelAlimtalkMessages: ({ requestId, recipientSeq }) =>
      request(`${appRoot}/messages/${encodeURIComponent(requestId)}`, {
        method: 'DELETE',
        query: recipientSeq ? { recipientSeq } : undefined,
      }),
    getAlimtalkMessage: ({ requestId, recipientSeq }) =>
      request(`${appRoot}/messages/${encodeURIComponent(requestId)}/${encodeURIComponent(recipientSeq)}`),
    listAlimtalkMessageResults: (query) =>
      request(`${appRoot}/message-results`, {
        query,
      }),
    registerSender: (body) =>
      request(`${appRoot}/senders`, {
        method: 'POST',
        body,
      }),
    verifySenderToken: (body) =>
      request(`${appRoot}/sender/token`, {
        method: 'POST',
        body,
      }),
    listSenderCategories: () => request(`${appRoot}/sender/categories`),
    addSenderToGroup: ({ groupSenderKey, senderKey }) =>
      request(
        `${appRoot}/sender-groups/${encodeURIComponent(groupSenderKey)}/senders/${encodeURIComponent(senderKey)}`,
        {
          method: 'POST',
        }
      ),
    getSender: ({ senderKey }) => request(`${appRoot}/senders/${encodeURIComponent(senderKey)}`),
    getSenderGroup: ({ groupSenderKey }) =>
      request(`${appRoot}/sender-groups/${encodeURIComponent(groupSenderKey)}`),
    listSenders: (query) =>
      request(`${appRoot}/senders`, {
        query,
      }),
    listAlimtalkTemplates: ({ senderKey, ...query }) =>
      request(`${appRoot}/senders/${encodeURIComponent(senderKey)}/templates`, {
        query,
      }),
    getAlimtalkTemplate: ({ senderKey, templateCode }) =>
      request(
        `${appRoot}/senders/${encodeURIComponent(senderKey)}/templates/${encodeURIComponent(templateCode)}`
      ),
    createAlimtalkTemplate: ({ senderKey, body }) =>
      request(`${appRoot}/senders/${encodeURIComponent(senderKey)}/templates`, {
        method: 'POST',
        body,
      }),
    uploadAlimtalkTemplateImage: ({ blob, fileName, kind = 'template' }) => {
      const formData = new FormData();
      formData.append('file', blob, fileName || 'alimtalk-template-image.jpeg');

      return request(`${appRoot}/template-image${kind === 'item-highlight' ? '/item-highlight' : ''}`, {
        method: 'POST',
        body: formData,
      });
    },
  };
}
