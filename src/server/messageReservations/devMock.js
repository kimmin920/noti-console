import {
  CHANNELS,
  PROVIDERS,
  SENDER_RESOURCE_TYPES,
} from '../relay/constants.js';

export const DEV_MESSAGE_RESERVATIONS_PARAM = 'devMockReservations';

const DEV_BILLING_ACCOUNT_ID = 'dev_reservation_billing_account';
const DEV_BILLING_REF = 'dev-reservation-billing';
const DEV_KAKAO_RESOURCE_ID = 'dev_reservation_kakao_sender';
const DEV_KAKAO_SENDER_KEY = 'dev-kakao-sender-key';
const DEV_SMS_BULK_RUN_ID = 'dev_sms_reservation_bulk_run';
const DEV_SMS_RESOURCE_ID = 'dev_reservation_sms_sender';
const DEV_SMS_SEND_NO = '01000000000';
const DEV_SMS_BULK_REQUEST_IDS = [
  'dev-bulk-reservation-1',
  'dev-bulk-reservation-2',
  'dev-bulk-reservation-3',
];

export function isDevMessageReservationsMockQuery(query = {}, env = process.env) {
  if (env.NODE_ENV === 'production') return false;

  const value = normalizeString(query[DEV_MESSAGE_RESERVATIONS_PARAM]);
  return value === '1' || value === 'true' || value === 'yes';
}

export function createDevMessageReservationMockDependencies({
  repository,
}) {
  return {
    kakaoClient: createDevKakaoReservationClient(),
    repository: createDevMessageReservationRepository(repository),
    smsClient: createDevSmsReservationClient(),
  };
}

function createDevMessageReservationRepository(baseRepository) {
  return {
    ...baseRepository,

    async findBillingAccountForUser(userId) {
      return createDevBillingAccount(userId);
    },

    async findSmsBulkRunMappingsByProviderRequestIds({
      actorUserId,
      providerRequestIds,
      senderResourceId,
    }) {
      const ids = normalizeIdList(providerRequestIds);
      const mappings = new Map();

      if (senderResourceId && senderResourceId !== DEV_SMS_RESOURCE_ID) {
        return mappings;
      }

      for (const providerRequestId of ids) {
        if (!DEV_SMS_BULK_REQUEST_IDS.includes(providerRequestId)) continue;

        mappings.set(providerRequestId, {
          batch: {
            providerRequestId,
            recipientCount: 4,
            runId: DEV_SMS_BULK_RUN_ID,
            sequence: DEV_SMS_BULK_REQUEST_IDS.indexOf(providerRequestId) + 1,
            status: 'accepted',
          },
          run: {
            acceptedCount: 3,
            batchSize: 4,
            billingAccountId: DEV_BILLING_ACCOUNT_ID,
            channel: CHANNELS.SMS,
            id: DEV_SMS_BULK_RUN_ID,
            managementSendName: '개발 예약 벌크 3개 배치',
            requestDate: '2026-06-08 10:00',
            senderResourceId: DEV_SMS_RESOURCE_ID,
            status: 'completed',
            totalBatches: DEV_SMS_BULK_REQUEST_IDS.length,
            totalRecipients: 12,
            userId: actorUserId,
          },
        });
      }

      return mappings;
    },

    async getBillingAccountById(billingAccountId) {
      if (billingAccountId === DEV_BILLING_ACCOUNT_ID) {
        return createDevBillingAccount(null);
      }

      return baseRepository.getBillingAccountById?.(billingAccountId) ?? null;
    },

    async listSmsBulkBatchesForActor({ actorUserId, runId, senderResourceId }) {
      if (
        !actorUserId
        || runId !== DEV_SMS_BULK_RUN_ID
        || (senderResourceId && senderResourceId !== DEV_SMS_RESOURCE_ID)
      ) {
        return [];
      }

      return DEV_SMS_BULK_REQUEST_IDS.map((providerRequestId, index) => ({
        errorCode: null,
        errorMessage: null,
        errorState: null,
        id: `dev_sms_reservation_batch_${index + 1}`,
        providerRequestId,
        recipientCount: 4,
        requestDate: '2026-06-08 10:00',
        runId: DEV_SMS_BULK_RUN_ID,
        sequence: index + 1,
        status: 'accepted',
        totalBatches: DEV_SMS_BULK_REQUEST_IDS.length,
      }));
    },

    async listUserSenderResources(userId) {
      const user = await baseRepository.getUserById(userId);
      if (!user) return [];

      return [
        createDevSenderResourceRow({
          displayName: '개발 SMS 발신번호',
          linkId: 'dev_reservation_sms_link',
          resourceId: DEV_SMS_RESOURCE_ID,
          resourceRef: 'dev-sms-reservation',
          type: SENDER_RESOURCE_TYPES.SMS_SEND_NO,
          userId,
          value: DEV_SMS_SEND_NO,
        }),
        createDevSenderResourceRow({
          displayName: '개발 카카오 발신프로필',
          linkId: 'dev_reservation_kakao_link',
          resourceId: DEV_KAKAO_RESOURCE_ID,
          resourceRef: 'dev-kakao-reservation',
          type: SENDER_RESOURCE_TYPES.KAKAO_SENDER_KEY,
          userId,
          value: DEV_KAKAO_SENDER_KEY,
        }),
      ];
    },
  };
}

function createDevSmsReservationClient() {
  return {
    async cancelReservations({ reservationList = [] } = {}) {
      return {
        body: {
          data: {
            canceledCount: reservationList.length,
            requestedCount: reservationList.length,
          },
        },
      };
    },

    async listReservations(query = {}) {
      return createSmsPage(
        filterByRequestId(createDevSmsReservations(query), query.requestId),
        query
      );
    },
  };
}

function createDevKakaoReservationClient() {
  return {
    async cancelAlimtalkMessages() {
      return createKakaoCancelResponse();
    },

    async cancelBrandMessages() {
      return createKakaoCancelResponse();
    },

    async listAlimtalkMessages(query = {}) {
      return createKakaoPage(
        filterByRequestId(createDevKakaoReservations({
          channel: CHANNELS.ALIMTALK,
          query,
        }), query.requestId),
        query
      );
    },

    async listBrandMessages(query = {}) {
      return createKakaoPage(
        filterByRequestId(createDevKakaoReservations({
          channel: CHANNELS.BRAND_MESSAGE,
          query,
        }), query.requestId),
        query
      );
    },
  };
}

function createDevSmsReservations(query) {
  const sendNo = normalizeString(query.sendNo) ?? DEV_SMS_SEND_NO;

  return [
    ...DEV_SMS_BULK_REQUEST_IDS.flatMap((requestId, requestIndex) =>
      Array.from({ length: 4 }, (_, recipientIndex) =>
        createSmsReservation({
          body: '개발 벌크 예약 메시지입니다.',
          recipientIndex: requestIndex * 4 + recipientIndex,
          recipientSeq: recipientIndex + 1,
          requestDate: getMockRequestDate(query, requestIndex + 1, 10),
          requestId,
          sendNo,
          status: 'RESERVED',
        })
      )
    ),
    createSmsReservation({
      body: '개발 단건 예약 메시지입니다.',
      recipientIndex: 20,
      recipientSeq: 1,
      requestDate: getMockRequestDate(query, 1, 15),
      requestId: 'dev-single-reservation',
      sendNo,
      status: 'RESERVED',
    }),
    createSmsReservation({
      body: '개발 취소된 예약 메시지입니다.',
      recipientIndex: 30,
      recipientSeq: 1,
      requestDate: getMockRequestDate(query, 2, 16),
      requestId: 'dev-canceled-reservation',
      sendNo,
      status: 'CANCEL',
    }),
    createSmsReservation({
      body: '개발 성공률 확인 메시지입니다.',
      recipientIndex: 40,
      recipientSeq: 1,
      requestDate: getMockRequestDate(query, 3, 11),
      requestId: 'dev-completed-reservation',
      sendNo,
      status: 'COMPLETED',
    }),
    createSmsReservation({
      body: '개발 성공률 확인 메시지입니다.',
      recipientIndex: 41,
      recipientSeq: 2,
      requestDate: getMockRequestDate(query, 3, 11),
      requestId: 'dev-completed-reservation',
      sendNo,
      status: 'FAILED',
    }),
    createSmsReservation({
      body: '개발 실패 예약 메시지입니다.',
      recipientIndex: 50,
      recipientSeq: 1,
      requestDate: getMockRequestDate(query, 4, 14),
      requestId: 'dev-failed-reservation',
      sendNo,
      status: 'FAILED',
    }),
    createSmsReservation({
      body: '개발 발송 중 예약 메시지입니다.',
      recipientIndex: 60,
      recipientSeq: 1,
      requestDate: getMockRequestDate(query, 5, 13),
      requestId: 'dev-sending-reservation',
      sendNo,
      status: 'SENDING',
    }),
  ];
}

function createDevKakaoReservations({ channel, query }) {
  const isBrand = channel === CHANNELS.BRAND_MESSAGE;
  const senderKey = normalizeString(query.senderKey) ?? DEV_KAKAO_SENDER_KEY;
  const requestId = isBrand ? 'dev-brand-reservation' : 'dev-alimtalk-reservation';

  return [
    {
      content: isBrand
        ? '개발 브랜드메시지 예약 내용입니다.'
        : '개발 알림톡 예약 내용입니다.',
      messageStatus: 'READY',
      recipientNo: isBrand ? '01070000001' : '01060000001',
      recipientSeq: 1,
      requestDate: getMockRequestDate(query, isBrand ? 6 : 2, isBrand ? 11 : 17, { seconds: false }),
      requestId,
      senderKey,
      templateCode: isBrand ? 'BRAND_DEV_001' : 'AT_DEV_001',
    },
  ];
}

function createSmsReservation({
  body,
  recipientIndex,
  recipientSeq,
  requestDate,
  requestId,
  sendNo,
  status,
}) {
  return {
    body,
    messageStatus: status,
    recipientNo: `010${String(10000000 + recipientIndex).padStart(8, '0').slice(-8)}`,
    recipientSeq,
    requestDate,
    requestId,
    sendNo,
  };
}

function createDevSenderResourceRow({
  displayName,
  linkId,
  resourceId,
  resourceRef,
  type,
  userId,
  value,
}) {
  return {
    link: {
      billingAccountId: DEV_BILLING_ACCOUNT_ID,
      id: linkId,
      role: 'owner',
      senderResourceId: resourceId,
      status: 'active',
      userId,
    },
    resource: {
      displayName,
      id: resourceId,
      provider: PROVIDERS.NHN,
      providerStatus: 'approved',
      resourceRef,
      status: 'active',
      type,
      value,
    },
  };
}

function createDevBillingAccount(ownerId) {
  return {
    billingRef: DEV_BILLING_REF,
    id: DEV_BILLING_ACCOUNT_ID,
    ownerId,
    ownerType: 'user',
    status: 'active',
  };
}

function createSmsPage(items, query) {
  const page = paginate(items, query);

  return {
    body: {
      data: page.items,
      pageNum: page.pageNum,
      pageSize: page.pageSize,
      totalCount: items.length,
    },
  };
}

function createKakaoPage(items, query) {
  const page = paginate(items, query);

  return {
    messageSearchResultResponse: {
      messages: page.items,
      pageNum: page.pageNum,
      pageSize: page.pageSize,
      totalCount: items.length,
    },
  };
}

function createKakaoCancelResponse() {
  return {
    body: {
      data: {
        canceledCount: 1,
        requestedCount: 1,
      },
    },
  };
}

function paginate(items, query) {
  const pageNum = normalizePositiveInteger(query.pageNum, 1);
  const pageSize = normalizePositiveInteger(query.pageSize, Math.max(items.length, 1));
  const startIndex = (pageNum - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    pageNum,
    pageSize,
  };
}

function filterByRequestId(items, requestId) {
  const normalizedRequestId = normalizeString(requestId);
  if (!normalizedRequestId) return items;

  return items.filter((item) => item.requestId === normalizedRequestId);
}

function getMockRequestDate(query, dayOffset, hour, { seconds = true } = {}) {
  const base = getMockBaseDate(query.startRequestDate);
  const date = new Date(base.getTime() + dayOffset * 86400000);
  const pad = (value) => String(value).padStart(2, '0');
  const dateText = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const timeText = `${pad(hour)}:00`;

  return seconds ? `${dateText} ${timeText}:00` : `${dateText} ${timeText}`;
}

function getMockBaseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalizeString(value) ?? '');

  if (!match) {
    return new Date(Date.UTC(2026, 5, 7, 0, 0, 0));
  }

  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0));
}

function normalizeIdList(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeString(value))
    .filter(Boolean))];
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function normalizeString(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}
