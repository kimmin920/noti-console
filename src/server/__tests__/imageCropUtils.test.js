import { describe, expect, it } from 'vitest';

import { validateImageCropOriginalFile } from '../../components/ui/imageCropUtils.js';

describe('imageCropUtils', () => {
  it('allows SMS MMS PNG originals above the provider output byte limit before JPEG conversion', () => {
    const pngOriginal = {
      name: 'notice.png',
      size: 400 * 1024,
      type: 'image/png',
    };
    const image = {
      naturalWidth: 1000,
      naturalHeight: 1000,
    };

    expect(() => validateImageCropOriginalFile({
      file: pngOriginal,
      image,
      preset: 'SMS_MMS',
    })).not.toThrow();
  });

  it('rejects very large SMS MMS originals before loading them into the crop editor', () => {
    const oversizedPngOriginal = {
      name: 'notice.png',
      size: (5 * 1024 * 1024) + 1,
      type: 'image/png',
    };
    const image = {
      naturalWidth: 1000,
      naturalHeight: 1000,
    };

    expect(() => validateImageCropOriginalFile({
      file: oversizedPngOriginal,
      image,
      preset: 'SMS_MMS',
    })).toThrow('용량은 최대 5MB까지 등록 가능합니다.');
  });
});
