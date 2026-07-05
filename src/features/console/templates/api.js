'use client';

import { RelayClientError, relayPost } from '../messageSend/api.js';

export function createSmsTemplate(payload) {
  return relayPost('/api/templates/sms', payload);
}

export function createAlimtalkTemplate(payload) {
  return relayPost('/api/templates/alimtalk', payload);
}

export function uploadAlimtalkTemplateImage(payload) {
  return relayPost('/api/templates/alimtalk/images', payload);
}

export async function uploadSmsTemplateAttachmentFromFile({ file, senderResourceId }) {
  if (!file || typeof file !== 'object') {
    throw new RelayClientError({
      code: 'LOCAL_VALIDATION_FAILED',
      message: '업로드할 MMS 이미지를 선택해 주세요.',
      source: 'client',
    });
  }

  return relayPost('/api/templates/sms/attachments', {
    senderResourceId,
    fileName: file.name,
    fileBody: await readFileAsBase64(file),
  });
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const result = String(reader.result ?? '');
      const [, fileBody] = result.split(',');

      if (!fileBody) {
        reject(new RelayClientError({
          code: 'LOCAL_VALIDATION_FAILED',
          message: '이미지를 base64 형식으로 읽을 수 없습니다.',
          source: 'client',
        }));
        return;
      }

      resolve(fileBody);
    });
    reader.addEventListener('error', () => {
      reject(new RelayClientError({
        code: 'LOCAL_VALIDATION_FAILED',
        message: '이미지를 읽을 수 없습니다.',
        source: 'client',
      }));
    });
    reader.readAsDataURL(file);
  });
}
