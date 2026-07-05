import { afterEach, describe, expect, it, vi } from 'vitest';

import { RelayClientError, relayPostForm } from '../../features/console/messageSend/api.js';
import { getBrandImageUploadFailureMessage } from '../../features/console/messageSend/uploadErrors.js';

describe('Brand Message image upload errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes NHN provider detail and wide image guidance in the user-facing message', () => {
    const message = getBrandImageUploadFailureMessage({
      error: new RelayClientError({
        message: 'NHN 서비스를 사용할 수 없습니다.',
        providerMessage: 'image ratio is invalid',
        status: 500,
      }),
      target: { imageType: 'WIDE_IMAGE' },
    });

    expect(message).toContain('와이드 이미지 업로드에 실패했습니다.');
    expect(message).toContain('NHN 서비스를 사용할 수 없습니다.');
    expect(message).toContain('NHN 응답: image ratio is invalid');
    expect(message).toContain('세로/가로 비율 0.5~1');
  });

  it('falls back to a Brand Message image upload explanation without provider detail', () => {
    const message = getBrandImageUploadFailureMessage({
      error: new Error('fetch failed'),
      target: { imageType: 'IMAGE' },
    });

    expect(message).toContain('일반 이미지 업로드에 실패했습니다.');
    expect(message).toContain('NHN 이미지 업로드 요청을 처리할 수 없습니다.');
    expect(message).toContain('세로/가로 비율 0.5~1.333');
  });

  it('preserves NHN provider detail from relay upload responses', async () => {
    const formData = new FormData();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      ok: false,
      error: {
        source: 'nhn',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'NHN 서비스를 사용할 수 없습니다.',
        providerCode: '-101',
        providerMessage: 'image ratio is invalid',
        retryable: true,
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(relayPostForm('/api/messages/brand/images', formData)).rejects.toMatchObject({
      name: 'RelayClientError',
      message: 'NHN 서비스를 사용할 수 없습니다.',
      providerCode: '-101',
      providerMessage: 'image ratio is invalid',
      status: 500,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/messages/brand/images', expect.objectContaining({
      body: formData,
      method: 'POST',
    }));
  });
});
