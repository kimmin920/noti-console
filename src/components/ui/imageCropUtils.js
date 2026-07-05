export const IMAGE_CROP_PRESETS = Object.freeze({
  SMS_MMS: {
    aspect: 1,
    aspectOptions: [
      { label: '1:1', value: 1 },
      { label: '4:3', value: 4 / 3 },
      { label: '2:1', value: 2 },
    ],
    maxBytes: 300 * 1024,
    maxHeight: 1000,
    maxOriginalBytes: 5 * 1024 * 1024,
    maxWidth: 1000,
    outputMimeType: 'image/jpeg',
    title: '문자 이미지 편집',
  },
  ALIMTALK_MAIN_IMAGE: {
    aspect: 2,
    maxBytes: 500 * 1024,
    minWidth: 500,
    outputMimeType: 'image/jpeg',
    title: '알림톡 이미지 편집',
  },
  ALIMTALK_HIGHLIGHT_THUMBNAIL: {
    aspect: 1,
    maxBytes: 500 * 1024,
    minWidth: 108,
    outputMimeType: 'image/jpeg',
    title: '하이라이트 썸네일 편집',
  },
  BRAND_IMAGE: {
    aspect: 1,
    aspectOptions: [
      { label: '2:1', value: 2 },
      { label: '3:4', value: 3 / 4 },
      { label: '1:1', value: 1 },
    ],
    maxBytes: 5 * 1024 * 1024,
    minWidth: 500,
    outputMimeType: 'image/jpeg',
    title: '브랜드 이미지 편집',
  },
  BRAND_WIDE_IMAGE: {
    aspect: 2,
    maxBytes: 5 * 1024 * 1024,
    minWidth: 500,
    outputMimeType: 'image/jpeg',
    title: '와이드 이미지 편집',
  },
  BRAND_MAIN_WIDE_ITEM_LIST_IMAGE: {
    aspect: 2,
    maxBytes: 5 * 1024 * 1024,
    minWidth: 500,
    outputMimeType: 'image/jpeg',
    title: '와이드 아이템 첫 이미지 편집',
  },
  BRAND_NORMAL_WIDE_ITEM_LIST_IMAGE: {
    aspect: 1,
    maxBytes: 5 * 1024 * 1024,
    minWidth: 500,
    outputMimeType: 'image/jpeg',
    title: '와이드 아이템 이미지 편집',
  },
  BRAND_CAROUSEL_IMAGE: {
    aspect: 1,
    aspectOptions: [
      { label: '2:1', value: 2 },
      { label: '3:4', value: 3 / 4 },
      { label: '1:1', value: 1 },
    ],
    maxBytes: 5 * 1024 * 1024,
    minWidth: 500,
    outputMimeType: 'image/jpeg',
    title: '캐러셀 이미지 편집',
  },
});

const DEFAULT_PRESET = Object.freeze({
  aspect: 1,
  fillColor: '#fff',
  maxBytes: null,
  maxHeight: null,
  maxWidth: null,
  minHeight: null,
  minWidth: null,
  outputMimeType: 'image/jpeg',
  quality: 0.92,
  title: '이미지 편집',
});

const mimeExtensions = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});
const BRAND_IMAGE_MIN_WIDTH_MESSAGE = '가로 500px 이상 등록 가능합니다.';

export function getImageCropPreset(preset) {
  const source = typeof preset === 'string' ? IMAGE_CROP_PRESETS[preset] : preset;
  return {
    ...DEFAULT_PRESET,
    ...(source ?? {}),
  };
}

export function validateImageCropOriginalFile({ file, image, preset }) {
  const resolvedPreset = getImageCropPreset(preset);
  const allowedTypes = new Set(['image/jpeg', 'image/png']);
  const maxOriginalBytes = resolvedPreset.maxOriginalBytes ?? resolvedPreset.maxBytes;

  if (file?.type && !allowedTypes.has(file.type)) {
    throw new Error('jpg/png 파일만 등록 가능합니다.');
  }

  if (maxOriginalBytes && file?.size > maxOriginalBytes) {
    throw new Error(`용량은 최대 ${Math.round(maxOriginalBytes / (1024 * 1024))}MB까지 등록 가능합니다.`);
  }

  const naturalWidth = image?.naturalWidth || image?.width || 0;

  if (resolvedPreset.minWidth && naturalWidth < resolvedPreset.minWidth) {
    throw new Error(
      resolvedPreset.minWidth === 500
        ? BRAND_IMAGE_MIN_WIDTH_MESSAGE
        : `가로 ${resolvedPreset.minWidth}px 이상 등록 가능합니다.`
    );
  }
}

export async function createCroppedImageFile({
  crop,
  file,
  imageSrc,
  preset,
  rotation = 0,
}) {
  if (!crop || !imageSrc) {
    throw new Error('크롭할 이미지 영역을 확인할 수 없습니다.');
  }

  const resolvedPreset = getImageCropPreset(preset);
  const image = await loadImage(imageSrc);
  const targetSize = getTargetSize(crop, resolvedPreset);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지를 편집할 수 없습니다.');
  }

  canvas.width = targetSize.width;
  canvas.height = targetSize.height;
  context.fillStyle = resolvedPreset.fillColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawCroppedImage(context, image, crop, targetSize, rotation);

  const mimeType = resolvedPreset.outputMimeType || file?.type || 'image/jpeg';
  const blob = await createBlobWithinLimit(canvas, mimeType, resolvedPreset);
  const outputFileName = getOutputFileName(file?.name, mimeType);
  const outputFile = new File([blob], outputFileName, {
    lastModified: Date.now(),
    type: blob.type || mimeType,
  });

  return {
    file: outputFile,
    height: canvas.height,
    size: outputFile.size,
    type: outputFile.type,
    width: canvas.width,
  };
}

function getOutputFileName(fileName = 'cropped-image', mimeType) {
  const extension = mimeExtensions[mimeType] ?? 'jpg';
  const baseName = String(fileName).replace(/\.[^.]+$/, '') || 'cropped-image';
  return `${baseName}.${extension}`;
}

function getTargetSize(crop, preset) {
  let width = Math.max(1, Math.round(crop.width));
  let height = Math.max(1, Math.round(crop.height));
  const minScale = Math.max(
    preset.minWidth ? preset.minWidth / width : 1,
    preset.minHeight ? preset.minHeight / height : 1,
    1
  );
  const maxScale = Math.min(
    preset.maxWidth ? preset.maxWidth / width : Number.POSITIVE_INFINITY,
    preset.maxHeight ? preset.maxHeight / height : Number.POSITIVE_INFINITY
  );
  const scale = Math.min(minScale, maxScale);

  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  return { height, width };
}

function drawCroppedImage(context, image, crop, targetSize, rotation) {
  if (!rotation) {
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      targetSize.width,
      targetSize.height
    );
    return;
  }

  const rotatedCanvas = createRotatedCanvas(image, rotation);
  context.drawImage(
    rotatedCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetSize.width,
    targetSize.height
  );
}

function createRotatedCanvas(image, rotation) {
  const radians = rotation * (Math.PI / 180);
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = Math.round(width * cos + height * sin);
  canvas.height = Math.round(width * sin + height * cos);

  if (!context) {
    throw new Error('이미지를 회전할 수 없습니다.');
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, -width / 2, -height / 2);

  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('이미지를 읽을 수 없습니다.')));
    image.src = src;
  });
}

async function createBlobWithinLimit(canvas, mimeType, preset) {
  const quality = Number.isFinite(preset.quality) ? preset.quality : 0.92;
  const qualities = mimeType === 'image/png'
    ? [quality]
    : [quality, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56];

  for (const nextQuality of qualities) {
    const blob = await canvasToBlob(canvas, mimeType, nextQuality);
    if (!preset.maxBytes || blob.size <= preset.maxBytes) {
      return blob;
    }
  }

  throw new Error('이미지 용량을 제한에 맞출 수 없습니다.');
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('이미지를 파일로 변환할 수 없습니다.'));
    }, mimeType, quality);
  });
}
