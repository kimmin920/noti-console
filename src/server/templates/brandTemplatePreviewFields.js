function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getPlainObject(value) {
  return isPlainObject(value) ? value : null;
}

function getFirstPlainObject(...values) {
  return values.find(isPlainObject) ?? null;
}

function getFirstArray(...values) {
  return values.find((value) => Array.isArray(value)) ?? null;
}

function normalizeOptionalString(value) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function maybeSet(target, key, value) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function normalizeImage(source) {
  const image = getPlainObject(source?.image);
  const normalized = image ? { ...image } : {};

  maybeSet(normalized, 'imageUrl', normalizeOptionalString(source?.imageUrl ?? image?.imageUrl ?? image?.url));
  maybeSet(normalized, 'imageLink', normalizeOptionalString(source?.imageLink ?? image?.imageLink));
  maybeSet(normalized, 'imageRatio', normalizeOptionalString(source?.imageRatio ?? image?.imageRatio));

  return Object.keys(normalized).length ? normalized : null;
}

function normalizeListContainer(source) {
  const container = getFirstPlainObject(source?.item, source?.wideList);
  const list = getFirstArray(
    container?.list,
    container?.items,
    container?.listItems,
    container?.itemList,
    source?.items,
    source?.listItems
  );

  if (!container && !list) {
    return null;
  }

  return {
    ...(container ?? {}),
    ...(list ? { list } : {}),
  };
}

function normalizeCarousel(source) {
  const type = normalizeOptionalString(source?.chatBubbleType ?? source?.messageType)?.toUpperCase();
  const typedCarousel = type === 'CAROUSEL_COMMERCE'
    ? getPlainObject(source?.carouselCommerce)
    : getPlainObject(source?.carouselFeeds);
  const carousel = getFirstPlainObject(source?.carousel, typedCarousel);
  const list = getFirstArray(
    carousel?.list,
    carousel?.items,
    carousel?.listItems,
    carousel?.itemList,
    carousel?.commerceItems,
    carousel?.feedItems,
    source?.carouselItems
  );

  if (!carousel && !list) {
    return null;
  }

  return {
    ...(carousel ?? {}),
    ...(list && !carousel?.list ? { list } : {}),
  };
}

function getCarouselItems(source, carousel) {
  return getFirstArray(
    source?.carouselItems,
    carousel?.list,
    carousel?.items,
    carousel?.listItems,
    carousel?.itemList,
    carousel?.commerceItems,
    carousel?.feedItems
  ) ?? [];
}

function collectStringValues(value, values) {
  if (typeof value === 'string') {
    values.push(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, values));
    return;
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach((entry) => collectStringValues(entry, values));
  }
}

export function normalizeBrandTemplatePreviewFields(template) {
  const image = normalizeImage(template);
  const item = normalizeListContainer(template);
  const wideList = getPlainObject(template?.wideList);
  const carousel = normalizeCarousel(template);
  const commerce = getPlainObject(template?.commerce);
  const video = getPlainObject(template?.video);
  const fields = {
    carousel,
    carouselCommerce: getPlainObject(template?.carouselCommerce),
    carouselFeeds: getPlainObject(template?.carouselFeeds),
    carouselItems: getCarouselItems(template, carousel),
    commerce,
    couponButton: getPlainObject(template?.couponButton),
    image,
    item,
    items: getFirstArray(template?.items, template?.listItems, item?.list, item?.items, item?.listItems, item?.itemList) ?? [],
    video,
    wideList,
  };

  maybeSet(fields, 'additionalContent', normalizeOptionalString(template?.additionalContent));
  maybeSet(fields, 'header', normalizeOptionalString(template?.header ?? template?.templateHeader));
  maybeSet(fields, 'imageLink', normalizeOptionalString(template?.imageLink ?? image?.imageLink));
  maybeSet(fields, 'imageRatio', normalizeOptionalString(template?.imageRatio ?? image?.imageRatio));
  maybeSet(fields, 'imageUrl', normalizeOptionalString(template?.imageUrl ?? image?.imageUrl ?? image?.url));
  maybeSet(fields, 'mainTitle', normalizeOptionalString(template?.mainTitle));
  maybeSet(fields, 'templateHeader', normalizeOptionalString(template?.templateHeader));
  maybeSet(fields, 'templateSubtitle', normalizeOptionalString(template?.templateSubtitle));

  if (template?.adult !== undefined) {
    fields.adult = Boolean(template.adult);
  }

  if (template?.isUseButton !== undefined) {
    fields.isUseButton = Boolean(template.isUseButton);
  }

  if (template?.isUseCouponButton !== undefined) {
    fields.isUseCouponButton = Boolean(template.isUseCouponButton);
  }

  return fields;
}

export function getBrandTemplatePreviewVariableSources(template, previewFields) {
  const values = [];

  collectStringValues(previewFields, values);
  collectStringValues(template?.coupon, values);
  collectStringValues(template?.couponButton, values);

  return values;
}
