import { RelayClientError, relayGet, relayPost, withQuery } from '../messageSend/api.js';

const MESSAGE_LOGS_PATH = '/api/message-logs';
const MESSAGE_LOG_GROUPS_PATH = '/api/message-log-groups';

export function listMessageLogs(filters) {
  return relayGet(withQuery(MESSAGE_LOGS_PATH, filters));
}

export function listMessageLogGroups(filters) {
  return relayGet(withQuery(MESSAGE_LOG_GROUPS_PATH, filters));
}

export function getMessageLogGroupDetail({ demo, groupId, channel, from, to }) {
  return relayGet(withQuery(`${MESSAGE_LOG_GROUPS_PATH}/${encodeURIComponent(groupId)}`, { channel, demo, from, to }));
}

export function listMessageLogGroupRequestRecipients({ demo, groupId, page = 1, pageSize = 100, requestLocalId }) {
  return relayGet(withQuery(
    [
      MESSAGE_LOG_GROUPS_PATH,
      encodeURIComponent(groupId),
      'requests',
      encodeURIComponent(requestLocalId),
      'recipients',
    ].join('/'),
    { demo, page, pageSize }
  ));
}

export function listMessageLogGroupRequestFailures({ demo, groupId, page = 1, pageSize = 100, requestLocalId }) {
  return relayGet(withQuery(
    [
      MESSAGE_LOG_GROUPS_PATH,
      encodeURIComponent(groupId),
      'requests',
      encodeURIComponent(requestLocalId),
      'failures',
    ].join('/'),
    { demo, page, pageSize }
  ));
}

export function getMessageLogGroupRequestRecipientDetail({ groupId, recipientSeq, requestLocalId }) {
  return relayGet([
    MESSAGE_LOG_GROUPS_PATH,
    encodeURIComponent(groupId),
    'requests',
    encodeURIComponent(requestLocalId),
    'recipients',
    encodeURIComponent(recipientSeq),
  ].join('/'));
}

export function getMessageLogDetail({ channel, requestId, recipientSeq }) {
  return relayGet(getMessageLogRowPath({ channel, requestId, recipientSeq }));
}

export function resendMessageLog({ channel, requestId, recipientSeq }) {
  return relayPost(`${getMessageLogRowPath({ channel, requestId, recipientSeq })}/resend`, {});
}

export async function downloadMessageLogsExport(filters) {
  const response = await fetch(withQuery(`${MESSAGE_LOGS_PATH}/export`, filters), {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await readExportError(response);
  }

  const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';
  if (!contentType.includes('text/csv')) {
    throw new RelayClientError({
      code: 'INVALID_EXPORT_RESPONSE',
      message: '발송기록 내보내기 응답을 처리할 수 없습니다.',
      status: response.status,
    });
  }

  const filename = getExportFilename(response.headers.get('Content-Disposition') || '');
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);

  return {
    filename,
    rowCount: Number(response.headers.get('X-Relay-Export-Row-Count') || 0),
  };
}

function getMessageLogRowPath({ channel, requestId, recipientSeq }) {
  return [
    MESSAGE_LOGS_PATH,
    encodeURIComponent(channel),
    encodeURIComponent(requestId),
    encodeURIComponent(recipientSeq),
  ].join('/');
}

async function readExportError(response) {
  const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const envelope = await response.json();
      const error = envelope?.error;

      if (error && typeof error === 'object') {
        return new RelayClientError({
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          source: error.source,
          state: error.state,
          status: response.status,
        });
      }
    } catch {}
  }

  return new RelayClientError({
    code: `HTTP_${response.status}`,
    message: '발송기록 내보내기에 실패했습니다.',
    retryable: response.status >= 500,
    status: response.status,
  });
}

function getExportFilename(contentDisposition) {
  const filenameStar = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (filenameStar?.[1]) {
    return decodeURIComponent(filenameStar[1].replaceAll('"', '').trim());
  }

  const filename = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (filename?.[1]) {
    return filename[1].trim();
  }

  return 'message-logs.csv';
}
