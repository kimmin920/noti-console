import {
  validateAlimtalkTemplateHighlightThumbnailFile,
  validateAlimtalkTemplateImageFile,
} from './alimtalkTemplateAdvancedValidation.js';

export const DEFAULT_ALIMTALK_IMAGE_CHECKS = Object.freeze([
  Object.freeze({ checked: false, label: '가로 너비 500px 이상 (권장 800px * 400px)' }),
  Object.freeze({ checked: false, label: '가로:세로 비율이 2:1' }),
  Object.freeze({ checked: false, label: 'JPEG, JPG, PNG 확장자' }),
  Object.freeze({ checked: false, label: '파일 사이즈 최대 500KB' }),
]);

export const DEFAULT_HIGHLIGHT_THUMBNAIL_CHECKS = Object.freeze([
  Object.freeze({ checked: false, label: '가로 너비 108px 이상' }),
  Object.freeze({ checked: false, label: '가로:세로 비율 1:1' }),
  Object.freeze({ checked: false, label: 'JPEG, JPG, PNG 확장자' }),
  Object.freeze({ checked: false, label: '파일 사이즈 최대 500KB' }),
]);

export function createAlimtalkImagePatch({
  fileName,
  fileSize,
  fileType,
  height,
  imageDataUrl,
  width,
} = {}) {
  const imageFileInfo = {
    fileName,
    fileSize,
    fileType,
    height,
    width,
  };
  const imageParts = splitImageDataUrl(imageDataUrl);
  const hasValidationErrors = validateAlimtalkTemplateImageFile(imageFileInfo).length > 0;

  return {
    imageCheckList: createAlimtalkImageCheckList(imageFileInfo),
    imageFileData: hasValidationErrors ? '' : imageParts.fileData,
    imageFileInfo,
    imageId: '',
    imageSrcPrefix: hasValidationErrors ? '' : imageParts.srcPrefix,
  };
}

export function createAlimtalkImageReadFailurePatch({
  fileName,
  fileSize,
  fileType,
} = {}) {
  const imageFileInfo = {
    fileName,
    fileSize,
    fileType,
    readError: true,
  };

  return {
    imageCheckList: createAlimtalkImageCheckList(imageFileInfo),
    imageFileData: '',
    imageFileInfo,
    imageId: '',
    imageSrcPrefix: '',
  };
}

export function createAlimtalkImageCheckList(fileInfo = null) {
  const errors = validateAlimtalkTemplateImageFile(fileInfo);

  return DEFAULT_ALIMTALK_IMAGE_CHECKS.map((check, index) => {
    const error = errors.find((item) => item.thumbnailCheckIndex === index);

    if (error) {
      return {
        ...check,
        checked: false,
        error: true,
        errorLabel: error.message,
      };
    }

    return {
      ...check,
      checked: fileInfo !== null && fileInfo.readError !== true,
      error: false,
      errorLabel: '',
    };
  });
}

export function createHighlightThumbnailPatch({
  fileSize,
  fileType,
  height,
  imageDataUrl,
  width,
} = {}) {
  const highlightThumbnailFileInfo = {
    fileSize,
    fileType,
    height,
    width,
  };
  const hasValidationErrors = validateAlimtalkTemplateHighlightThumbnailFile(highlightThumbnailFileInfo).length > 0;

  return {
    highlighThumbnailImageUrl: hasValidationErrors ? '' : String(imageDataUrl ?? ''),
    highlightThumbnailCheckList: createHighlightThumbnailCheckList(highlightThumbnailFileInfo),
    highlightThumbnailFileInfo,
    highlightThumbnailImageId: '',
  };
}

function splitImageDataUrl(imageDataUrl = '') {
  const value = String(imageDataUrl);
  const separatorIndex = value.indexOf(',');

  if (separatorIndex < 0) {
    return {
      fileData: value,
      srcPrefix: '',
    };
  }

  return {
    fileData: value.slice(separatorIndex + 1),
    srcPrefix: `${value.slice(0, separatorIndex + 1)}`,
  };
}

export function createHighlightThumbnailReadFailurePatch({
  fileSize,
  fileType,
} = {}) {
  const highlightThumbnailFileInfo = {
    fileSize,
    fileType,
    readError: true,
  };

  return {
    highlighThumbnailImageUrl: '',
    highlightThumbnailCheckList: createHighlightThumbnailCheckList(highlightThumbnailFileInfo),
    highlightThumbnailFileInfo,
    highlightThumbnailImageId: '',
  };
}

export function createHighlightThumbnailCheckList(fileInfo = null) {
  const errors = validateAlimtalkTemplateHighlightThumbnailFile(fileInfo);

  return DEFAULT_HIGHLIGHT_THUMBNAIL_CHECKS.map((check, index) => {
    const error = errors.find((item) => item.thumbnailCheckIndex === index);

    if (error) {
      return {
        ...check,
        checked: false,
        error: true,
        errorLabel: error.message,
      };
    }

    return {
      ...check,
      checked: fileInfo !== null && fileInfo.readError !== true,
      error: false,
      errorLabel: '',
    };
  });
}
