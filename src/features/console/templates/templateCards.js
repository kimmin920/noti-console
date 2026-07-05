const TEMPLATE_STATUS_LABELS = Object.freeze({
  A: '등록',
  APR: '승인',
  APPROVED: '승인',
  REQ: '요청',
  REJ: '반려',
  S: '차단',
  TSC01: '요청',
  TSC02: '검수중',
  TSC03: '승인',
  TSC04: '반려',
  Y: '사용',
  N: '미사용',
});

const TEMPLATE_STATUS_TONES = Object.freeze({
  A: 'green',
  APR: 'green',
  APPROVED: 'green',
  REQ: 'yellow',
  REJ: 'red',
  S: 'red',
  TSC01: 'yellow',
  TSC02: 'blue',
  TSC03: 'green',
  TSC04: 'red',
  Y: 'green',
  N: 'neutral',
});

const COMMON_TEMPLATE_SOURCE = 'GROUP';

export function getTemplateCardItems(templates) {
  return templates.map((template) => {
    const code = String(template.templateCode ?? template.templateId ?? template.value ?? template.id ?? '');
    const name = String(template.templateName ?? template.name ?? template.label ?? code);
    const ownerLabel = getTemplateOwnerLabel(template);
    const statusCode = template.providerStatusCode ?? template.providerStatus;

    return {
      body: String(template.body ?? template.content ?? template.description ?? ''),
      buttons: Array.isArray(template.buttons) ? template.buttons : [],
      channel: String(template.channel ?? template.channelType ?? ''),
      ...getTemplatePreviewRichFields(template),
      codeMetaLabel: getTemplateCodeMetaLabel(template, ownerLabel),
      code,
      id: template.id ?? `${template.channel}:${code}`,
      imageUrl: getTemplateImageUrl(template),
      name,
      ownerLabel,
      quickReplies: Array.isArray(template.quickReplies) ? template.quickReplies : [],
      source: template.source ?? '',
      sourceKey: template.sourceKey ?? '',
      status: getTemplateStatusLabel(statusCode, template.statusName),
      statusCode,
      statusTone: getTemplateStatusTone(statusCode),
      updatedAt: template.updateDate ?? template.createDate ?? '',
    };
  });
}

function getTemplateImageUrl(template) {
  return template.templateImageUrl
    ?? template.imageUrl
    ?? template.image?.imageUrl
    ?? template.image?.url
    ?? null;
}

function getTemplatePreviewRichFields(template) {
  return {
    additionalContent: template.additionalContent,
    adult: template.adult,
    carousel: template.carousel,
    carouselCommerce: template.carouselCommerce,
    carouselFeeds: template.carouselFeeds,
    carouselItems: template.carouselItems,
    chatBubbleType: template.chatBubbleType ?? template.messageType,
    commerce: template.commerce,
    coupon: template.coupon,
    couponButton: template.couponButton,
    header: template.header ?? template.templateHeader,
    image: template.image,
    imageLink: template.imageLink,
    imageRatio: template.imageRatio ?? template.image?.imageRatio,
    isUseButton: template.isUseButton,
    isUseCouponButton: template.isUseCouponButton,
    item: template.item ?? template.wideList,
    items: template.items ?? template.listItems,
    mainTitle: template.mainTitle,
    templateHeader: template.templateHeader,
    templateSubtitle: template.templateSubtitle,
    video: template.video,
    wideList: template.wideList,
  };
}

function getTemplateCodeMetaLabel(template, ownerLabel) {
  if (String(template.source ?? '').toUpperCase() === COMMON_TEMPLATE_SOURCE) {
    return '공통';
  }

  return ownerLabel;
}

function getTemplateOwnerLabel(template) {
  return String(template.sourceLabel ?? template.ownerLabel ?? template.plusFriendId ?? template.sendNo ?? '').trim();
}

function getTemplateStatusLabel(statusCode, fallback) {
  return TEMPLATE_STATUS_LABELS[String(statusCode ?? '').toUpperCase()] ?? fallback ?? '상태 없음';
}

function getTemplateStatusTone(statusCode) {
  return TEMPLATE_STATUS_TONES[String(statusCode ?? '').toUpperCase()] ?? 'neutral';
}
