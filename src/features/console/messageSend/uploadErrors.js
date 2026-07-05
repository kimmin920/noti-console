import { getRelayErrorMessage } from './api.js';

const BRAND_IMAGE_UPLOAD_GUIDANCE = {
  IMAGE: '일반 이미지는 JPG/PNG, 5MB 이하, 가로 500px 이상, 세로/가로 비율 0.5~1.333이어야 합니다.',
  WIDE_IMAGE: '와이드 이미지는 JPG/PNG, 5MB 이하, 가로 500px 이상, 세로/가로 비율 0.5~1이어야 합니다.',
  MAIN_WIDE_ITEMLIST_IMAGE: '와이드 아이템 리스트 첫 이미지는 JPG/PNG, 5MB 이하, 가로 500px 이상, 세로/가로 비율 0.5여야 합니다.',
  NORMAL_WIDE_ITEMLIST_IMAGE: '와이드 아이템 리스트 일반 이미지는 JPG/PNG, 5MB 이하, 가로 500px 이상, 세로/가로 비율 1이어야 합니다.',
  CAROUSEL_FEED_IMAGE: '캐러셀 피드 이미지는 JPG/PNG, 5MB 이하, 가로 500px 이상, 세로/가로 비율 0.5~1.333이어야 합니다.',
  CAROUSEL_COMMERCE_IMAGE: '캐러셀 커머스 이미지는 JPG/PNG, 5MB 이하, 가로 500px 이상, 세로/가로 비율 0.5~1.333이어야 합니다.',
};

const BRAND_IMAGE_UPLOAD_LABELS = {
  IMAGE: '일반 이미지',
  WIDE_IMAGE: '와이드 이미지',
  MAIN_WIDE_ITEMLIST_IMAGE: '와이드 아이템 리스트 첫 이미지',
  NORMAL_WIDE_ITEMLIST_IMAGE: '와이드 아이템 리스트 이미지',
  CAROUSEL_FEED_IMAGE: '캐러셀 피드 이미지',
  CAROUSEL_COMMERCE_IMAGE: '캐러셀 커머스 이미지',
};

export function getBrandImageUploadFailureMessage({ error, target } = {}) {
  const imageType = String(target?.imageType || '').trim().toUpperCase();
  const label = BRAND_IMAGE_UPLOAD_LABELS[imageType] ?? '브랜드 이미지';
  const detail = getRelayErrorMessage(error, 'NHN 이미지 업로드 요청을 처리할 수 없습니다.');
  const providerMessage = normalizeProviderMessage(error?.providerMessage);
  const guidance = BRAND_IMAGE_UPLOAD_GUIDANCE[imageType];
  const lines = [
    `${label} 업로드에 실패했습니다.`,
    detail,
    providerMessage && providerMessage !== detail ? `NHN 응답: ${providerMessage}` : null,
    guidance,
  ];

  return lines.filter(Boolean).join('\n');
}

function normalizeProviderMessage(value) {
  const message = typeof value === 'string' ? value.trim() : '';
  return message || null;
}
