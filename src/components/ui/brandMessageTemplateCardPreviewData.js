export const brandTemplateTypeLabels = Object.freeze({
  CAROUSEL_COMMERCE: '캐러셀 커머스',
  CAROUSEL_FEED: '캐러셀 피드',
  COMMERCE: '커머스',
  IMAGE: '이미지',
  PREMIUM_VIDEO: '동영상',
  TEXT: '텍스트',
  WIDE: '와이드',
  WIDE_ITEM_LIST: '와이드 리스트',
});

const brandTemplateTypes = new Set(Object.keys(brandTemplateTypeLabels));

export function getBrandTemplateType(template) {
  const declaredType = String(template?.chatBubbleType ?? template?.messageType ?? '').trim().toUpperCase();

  if (brandTemplateTypes.has(declaredType)) return declaredType;
  if (template?.carousel || template?.carouselItems || template?.carouselCommerce || template?.carouselFeeds) return 'CAROUSEL_FEED';
  if (template?.commerce) return 'COMMERCE';
  if (template?.video) return 'PREMIUM_VIDEO';
  if (template?.item || template?.wideList || template?.items) return 'WIDE_ITEM_LIST';
  if (getImageUrl(template)) return 'IMAGE';
  return 'TEXT';
}

export function getBrandTemplateSenderLabel(template) {
  return String(template?.ownerLabel ?? template?.codeMetaLabel ?? template?.sourceLabel ?? template?.plusFriendId ?? '브랜드 메시지').trim() || '브랜드 메시지';
}

export function getBrandTemplateAvatarText(senderLabel) {
  return senderLabel.replace(/^@/, '').slice(0, 1).toUpperCase() || 'B';
}

export function getBrandTemplateBody(template) {
  return template?.body ?? template?.content ?? template?.description ?? '';
}

export function getBrandTemplateActions(source) {
  if (source?.isUseButton === false) {
    return [];
  }

  return Array.isArray(source?.buttons)
    ? source.buttons.filter((action) => action?.name || action?.type).sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0)).slice(0, 2)
    : [];
}

export function getBrandTemplateActionLabel(type) {
  if (type === 'WL') return '웹링크';
  if (type === 'AL') return '앱링크';
  if (type === 'AC') return '채널 추가';
  if (type === 'BK') return '봇 키워드';
  if (type === 'MD') return '메시지 전달';
  if (type === 'BT') return '챗봇 전환';
  if (type === 'BF') return '비즈니스폼';
  return type || '버튼';
}

export function getCommercePreview(source) {
  const commerceSource = isPlainObject(source?.commerce) ? source.commerce : {};
  const commerce = isPlainObject(commerceSource.price) ? commerceSource.price : commerceSource;
  const image = isPlainObject(commerce.image) ? commerce.image : {};

  return {
    additionalContent: commerce.additionalContent ?? source?.additionalContent ?? '',
    buttons: commerce.buttons ?? source?.buttons,
    discountPrice: commerce.discountPrice ?? commerce.salePrice ?? commerce.discountedPrice ?? '',
    imageUrl: commerceSource.imageUrl ?? commerce.imageUrl ?? image.imageUrl ?? image.url ?? getImageUrl(source),
    regularPrice: commerce.regularPrice ?? commerce.price ?? commerce.originalPrice ?? '',
    title: commerce.title ?? commerce.name ?? source?.header ?? '',
  };
}

export function getCarouselItems(source, commerceMode) {
  const carousel = getCarouselSource(source, commerceMode);
  const items = getFirstArray(
    source?.carouselItems,
    carousel.list,
    carousel.items,
    carousel.listItems,
    carousel.itemList,
    commerceMode ? carousel.commerceItems : carousel.feedItems
  ) ?? [];

  return items.map((entry, index) => {
    const row = isPlainObject(entry) ? entry : { title: String(entry ?? '') };
    const commerceItem = commerceMode ? getCommercePreview(row) : {};

    return {
      ...row,
      ...commerceItem,
      content: row.content ?? row.description ?? row.body ?? commerceItem.additionalContent ?? '',
      imageUrl: row.imageUrl ?? commerceItem.imageUrl ?? getImageUrl(row),
      title: row.title ?? row.header ?? row.name ?? commerceItem.title ?? `${commerceMode ? '상품' : '카드'} ${index + 1}`,
    };
  });
}

export function getCarouselIntro(source) {
  const carousel = getCarouselSource(source, true);
  const head = isPlainObject(carousel.head) ? carousel.head : isPlainObject(carousel.intro) ? carousel.intro : null;

  if (!head) {
    return null;
  }

  return {
    content: head.content ?? head.description ?? '',
    imageUrl: getImageUrl(head),
    title: head.header ?? head.title ?? '',
    type: 'intro',
  };
}

export function getWideListItems(source) {
  const item = isPlainObject(source?.item) ? source.item : {};
  const wideList = isPlainObject(source?.wideList) ? source.wideList : {};
  const items = getFirstArray(source?.items, wideList.list, wideList.items, item.list, item.items, item.itemList) ?? [];

  return items.map((entry, index) => {
    const row = isPlainObject(entry) ? entry : { title: String(entry ?? '') };

    return {
      content: row.content ?? row.body ?? '',
      description: row.description ?? '',
      imageUrl: getImageUrl(row),
      title: row.title ?? row.header ?? row.name ?? `리스트 ${index + 1}`,
    };
  });
}

export function getImageUrl(source) {
  const image = isPlainObject(source?.image) ? source.image : {};

  return source?.imageUrl ?? image.imageUrl ?? image.url ?? '';
}

export function formatPreviewMoney(value) {
  const text = String(value ?? '').trim();

  if (!text || text.includes('#{') || /[원%]$/.test(text)) {
    return text;
  }

  const numericText = text.replace(/\D/g, '');

  if (!numericText) {
    return text;
  }

  return `${Number(numericText).toLocaleString('ko-KR')}원`;
}

function getCarouselSource(source, commerceMode) {
  if (isPlainObject(source?.carousel)) return source.carousel;
  const typedCarousel = commerceMode ? source?.carouselCommerce : source?.carouselFeeds;
  return isPlainObject(typedCarousel) ? typedCarousel : {};
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getFirstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length > 0) ?? null;
}
