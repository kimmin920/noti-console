import { NHN_PRODUCTS, NHN_PROVIDER_IDEMPOTENCY, CHANNELS } from '../relay/constants.js';
import { resolveNhnSmsConfig } from './config.js';
import { requestNhnJson } from './http.js';

export function createNhnSmsClient(options = {}) {
  const config = options.config ?? resolveNhnSmsConfig();
  const request = (path, requestOptions = {}) =>
    requestNhnJson({
      baseUrl: config.baseUrl,
      secretKey: config.secretKey,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      path,
      ...requestOptions,
    });

  const appRoot = `/sms/v3.0/appKeys/${encodeURIComponent(config.appKey)}`;

  return {
    product: NHN_PRODUCTS.SMS,
    providerIdempotencySupported: NHN_PROVIDER_IDEMPOTENCY[CHANNELS.SMS],
    sendSms: (body) =>
      request(`${appRoot}/sender/sms`, {
        method: 'POST',
        body,
      }),
    sendAdSms: (body) =>
      request(`${appRoot}/sender/ad-sms`, {
        method: 'POST',
        body,
      }),
    sendMms: (body) =>
      request(`${appRoot}/sender/mms`, {
        method: 'POST',
        body,
      }),
    sendAdMms: (body) =>
      request(`${appRoot}/sender/ad-mms`, {
        method: 'POST',
        body,
      }),
    listSmsMessages: (query) =>
      request(`${appRoot}/sender/sms`, {
        query,
      }),
    getSmsMessage: ({ requestId, recipientSeq }) =>
      request(`${appRoot}/sender/sms/${encodeURIComponent(requestId)}`, {
        query: { recipientSeq },
      }),
    listMmsMessages: (query) =>
      request(`${appRoot}/sender/mms`, {
        query,
      }),
    getMmsMessage: ({ requestId, recipientSeq }) =>
      request(`${appRoot}/sender/mms/${encodeURIComponent(requestId)}`, {
        query: { recipientSeq },
      }),
    listMessageResults: (query) =>
      request(`${appRoot}/message-results`, {
        query,
      }),
    listReservations: (query) =>
      request(`${appRoot}/reservations`, {
        query,
      }),
    getReservation: ({ requestId, recipientSeq }) =>
      request(`${appRoot}/reservations/${encodeURIComponent(requestId)}/${encodeURIComponent(recipientSeq)}`),
    cancelReservations: (body) =>
      request(`${appRoot}/reservations/cancel`, {
        method: 'PUT',
        body,
      }),
    listSendNos: (query) =>
      request(`${appRoot}/sendNos`, {
        query,
      }),
    listTemplates: (query) =>
      request(`${appRoot}/templates`, {
        query,
      }),
    getTemplate: ({ templateId }) =>
      request(`${appRoot}/templates/${encodeURIComponent(templateId)}`),
    createTemplate: (body) =>
      request(`${appRoot}/templates`, {
        method: 'POST',
        body,
      }),
    listCategories: (query) =>
      request(`${appRoot}/categories`, {
        query,
      }),
    createCategory: (body) =>
      request(`${appRoot}/categories`, {
        method: 'POST',
        body,
      }),
    updateCategory: ({ categoryId, ...body }) =>
      request(`${appRoot}/categories/${encodeURIComponent(categoryId)}`, {
        method: 'PUT',
        body,
      }),
    uploadAttachFile: (body) =>
      request(`${appRoot}/attachfile/binaryUpload`, {
        method: 'POST',
        body,
      }),
  };
}
