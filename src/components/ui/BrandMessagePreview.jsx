'use client';

import { useEffect, useRef, useState } from 'react';
import {
  defaultBrandMessageSenderProfiles,
  defaultBrandMessageTemplates,
  getBrandCouponTitle,
  normalizeBrandMessageDraftValue,
} from './BrandMessageSendForm.jsx';
import { getMessageTemplateVariableValue } from './MessageTemplateVariables.jsx';

const nhnBrandChatBubbleTypes = new Set([
  'TEXT',
  'IMAGE',
  'WIDE',
  'WIDE_ITEM_LIST',
  'PREMIUM_VIDEO',
  'COMMERCE',
  'CAROUSEL_FEED',
  'CAROUSEL_COMMERCE',
]);
const brandCarouselDragThreshold = 36;

const brandPreviewMockup = {
  TEXT: { buttonType: 'vertical', width: null },
  IMAGE: { buttonType: 'vertical', height: 100, width: 200 },
  WIDE: { buttonType: 'horizontal', height: 100, width: 230 },
  PREMIUM_VIDEO: { buttonType: 'horizontal', height: 100, width: 200 },
  WIDE_ITEM_LIST: { buttonType: 'horizontal', height: 88, width: 230 },
  COMMERCE: { buttonType: 'horizontal', height: 267, width: 200 },
  CAROUSEL_FEED: { buttonType: 'horizontal', height: 100, width: 200 },
  CAROUSEL_COMMERCE: { buttonType: 'horizontal', height: 267, width: 200 },
};

function getBrandMessagePreviewValue(value) {
  return normalizeBrandMessageDraftValue(value);
}

function getNhnBrandChatBubbleType(value) {
  const type = String(value || 'TEXT').trim().toUpperCase();

  return nhnBrandChatBubbleTypes.has(type) ? type : 'TEXT';
}

function getSelectedSenderProfile(message, senderProfiles) {
  return senderProfiles.find((item) => item.value === message.senderProfileId) ?? senderProfiles[0] ?? null;
}

function getAvailableBrandTemplates(templates, senderProfileId) {
  return templates.filter((template) => !template.senderProfileId || template.senderProfileId === senderProfileId);
}

function getSelectedTemplate(message, templates) {
  const availableTemplates = getAvailableBrandTemplates(templates, message.senderProfileId);

  return availableTemplates.find((item) => (
    item.value === message.templateCode
    || item.templateCode === message.templateCode
    || item.templateId === message.templateCode
    || item.id === message.templateCode
  )) ?? null;
}

function renderBrandPreviewText(text, variables) {
  return String(text ?? '').split(/(#\{[^}]+\})/g).map((part, index) => {
    const match = part.match(/^#\{(.+)\}$/);

    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    const value = getMessageTemplateVariableValue(variables, match[1]);

    return value ? (
      <span key={`${part}-${index}`}>{value}</span>
    ) : (
      <span className="brand-message-preview-token" key={`${part}-${index}`}>
        {part}
      </span>
    );
  });
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getFirstArray(...values) {
  return values.find((value) => Array.isArray(value) && value.length > 0) ?? null;
}

function isRenderableImageUrl(value) {
  return Boolean(value && !String(value).startsWith('sample:'));
}

function getImageUrl(source) {
  const image = isPlainObject(source?.image) ? source.image : {};

  return source?.imageUrl ?? image.imageUrl ?? image.url ?? '';
}

function getImageRatio(source) {
  const image = isPlainObject(source?.image) ? source.image : {};

  return source?.imageRatio ?? image.imageRatio ?? source?.imageRatio ?? '';
}

function getPreviewButtons(source) {
  if (source?.isUseButton === false) {
    return [];
  }

  return Array.isArray(source?.buttons) ? source.buttons : [];
}

function getPreviewCoupon(source) {
  if (!isPlainObject(source)) {
    return null;
  }

  if (isPlainObject(source.couponButton)) {
    return source.couponButton.isUseCouponButton ? source.couponButton : null;
  }

  if (source.isUseCouponButton === false) {
    return null;
  }

  return isPlainObject(source.coupon) ? source.coupon : null;
}

function getCarouselPreviewSource(source, commerceMode = false) {
  if (isPlainObject(source?.carousel)) {
    return source.carousel;
  }

  const sourceKey = commerceMode ? 'carouselCommerce' : 'carouselFeeds';

  return isPlainObject(source?.[sourceKey]) ? source[sourceKey] : {};
}

function getWideListItems(source) {
  const item = isPlainObject(source?.item) ? source.item : {};
  const wideList = isPlainObject(source?.wideList) ? source.wideList : {};
  const items = getFirstArray(
    source?.items,
    source?.listItems,
    wideList.list,
    wideList.items,
    wideList.listItems,
    item.items,
    item.listItems,
    item.itemList,
    item.list
  );

  if (!items) {
    return [
      { title: '리스트 1' },
      { title: '리스트 2' },
      { title: '리스트 3' },
    ];
  }

  return items.map((entry, index) => {
    const row = isPlainObject(entry) ? entry : { title: String(entry ?? '') };
    const image = isPlainObject(row.image) ? row.image : {};

    return {
      imageUrl: row.imageUrl ?? image.imageUrl ?? image.url ?? '',
      title: row.title ?? row.header ?? row.name ?? `리스트 ${index + 1}`,
    };
  });
}

function getCommercePreview(source) {
  const commerceSource = isPlainObject(source?.commerce) ? source.commerce : {};
  const commerce = isPlainObject(commerceSource.price) ? commerceSource.price : commerceSource;
  const image = isPlainObject(commerce.image) ? commerce.image : {};

  return {
    additionalContent: commerce.additionalContent ?? source?.additionalContent ?? '',
    discountPrice: commerce.discountPrice ?? commerce.salePrice ?? commerce.discountedPrice ?? '',
    discountType: commerce.discountType ?? 'rate',
    imageRatio: commerceSource.imageRatio ?? commerce.imageRatio ?? image.imageRatio ?? getImageRatio(source),
    imageUrl: commerceSource.imageUrl ?? commerce.imageUrl ?? image.imageUrl ?? image.url ?? getImageUrl(source),
    isUsePriceVariable: Boolean(commerce.isUsePriceVariable),
    regularPrice: commerce.regularPrice ?? commerce.price ?? commerce.originalPrice ?? '',
    title: commerce.title ?? commerce.name ?? source?.header ?? '',
  };
}

function getCarouselItems(source, commerceMode = false) {
  const carousel = getCarouselPreviewSource(source, commerceMode);
  const items = getFirstArray(
    source?.carouselItems,
    carousel.list,
    carousel.items,
    carousel.listItems,
    carousel.itemList,
    commerceMode ? carousel.commerceItems : carousel.feedItems
  );
  const fallbackItems = commerceMode ? [
    {
      discountPrice: '39000',
      regularPrice: '59000',
      title: '상품 1',
    },
    {
      discountPrice: '29000',
      regularPrice: '42000',
      title: '상품 2',
    },
  ] : [
    {
      buttons: [{ name: '자세히', type: 'WL' }],
      content: '',
      title: '카드 1',
    },
    {
      buttons: [{ name: '자세히', type: 'WL' }],
      content: '',
      title: '카드 2',
    },
  ];
  const sourceItems = items ?? fallbackItems;
  const carouselItems = sourceItems.map((entry, index) => {
    const row = isPlainObject(entry) ? entry : { title: String(entry ?? '') };
    const commerceSource = isPlainObject(row.commerce) ? row.commerce : row;
    const commerce = isPlainObject(commerceSource.price)
      ? commerceSource.price
      : isPlainObject(row.price)
        ? row.price
        : commerceSource;
    const image = isPlainObject(row.image) ? row.image : {};

    return {
      additionalContent: row.additionalContent ?? commerceSource.additionalContent ?? commerce.additionalContent ?? '',
      buttons: row.buttons ?? commerceSource.buttons ?? commerce.buttons,
      content: row.content ?? row.description ?? row.body ?? '',
      coupon: getPreviewCoupon(row) ?? getPreviewCoupon(commerceSource) ?? getPreviewCoupon(commerce),
      discountPrice: commerce.discountPrice ?? commerce.salePrice ?? '',
      discountType: commerce.discountType ?? 'rate',
      imageRatio: row.imageRatio ?? commerceSource.imageRatio ?? image.imageRatio ?? '',
      imageUrl: row.imageUrl ?? commerceSource.imageUrl ?? image.imageUrl ?? image.url ?? '',
      isUseButton: row.isUseButton ?? commerceSource.isUseButton ?? commerce.isUseButton,
      isUsePriceVariable: Boolean(commerce.isUsePriceVariable),
      regularPrice: commerce.regularPrice ?? commerce.price ?? '',
      title: row.title ?? row.header ?? row.name ?? commerce.title ?? `${commerceMode ? '상품' : '카드'} ${index + 1}`,
      type: row.type,
    };
  });

  const hasIntro = Boolean(carousel.isUseIntro)
    || (carousel.isUseIntro === undefined && (isPlainObject(carousel.head) || isPlainObject(carousel.intro)));

  if (!commerceMode || !hasIntro) {
    return carouselItems;
  }

  const head = isPlainObject(carousel.head) ? carousel.head : isPlainObject(carousel.intro) ? carousel.intro : {};
  const image = isPlainObject(head.image) ? head.image : {};

  return [
    {
      content: head.content ?? '',
      imageRatio: head.imageRatio ?? image.imageRatio ?? '',
      imageUrl: head.imageUrl ?? image.imageUrl ?? image.url ?? '',
      title: head.header ?? '',
      type: 'intro',
    },
    ...carouselItems,
  ];
}

function getCarouselTail(source, commerceMode = false) {
  const carousel = getCarouselPreviewSource(source, commerceMode);
  const tail = isPlainObject(carousel.tail) ? carousel.tail : null;
  const moreButton = isPlainObject(carousel.moreButton) ? carousel.moreButton : null;
  const sourceTail = tail ?? moreButton;

  if (!sourceTail) {
    return null;
  }

  const hasTailLink = Boolean(
    sourceTail.linkMo
    || sourceTail.linkMobile
    || sourceTail.mobileLink
    || sourceTail.mobileWebLink
    || sourceTail.linkPc
    || sourceTail.schemeAndroid
    || sourceTail.schemeIos
  );
  const isMoreButton = sourceTail.isMoreButton === undefined ? hasTailLink : Boolean(sourceTail.isMoreButton);

  if (!isMoreButton) {
    return null;
  }

  return {
    tail: sourceTail,
    title: sourceTail.name ?? '더보기',
    type: 'tail',
  };
}

function getCarouselStep(element) {
  const firstSlide = element?.querySelector('.brand-message-preview-carousel-slide');
  const firstCard = element?.querySelector('.brand-message-preview-carousel-card');
  const styles = element ? window.getComputedStyle(element) : null;
  const gap = Number.parseFloat(styles?.columnGap || styles?.gap || '0');
  const width = firstSlide?.getBoundingClientRect().width ?? firstCard?.getBoundingClientRect().width ?? 200;

  return width + (Number.isFinite(gap) ? gap : 0);
}

function clampCarouselIndex(index, maxIndex) {
  return Math.min(maxIndex, Math.max(0, index));
}

function parsePreviewNumber(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');

  return Number(digits || 0);
}

function formatPreviewWon(value) {
  return `${parsePreviewNumber(value).toLocaleString()}원`;
}

function getPreviewDiscount(regularPrice, discountPrice) {
  const regular = parsePreviewNumber(regularPrice);
  const discount = parsePreviewNumber(discountPrice);

  if (!regular || !discount || regular <= discount) {
    return { amount: 0, rate: 0 };
  }

  const amount = regular - discount;

  return {
    amount,
    rate: Math.floor((amount / regular) * 100),
  };
}

function getPreviewImageHeight({ height, imageRatio, width }) {
  if (!width) {
    return height ?? '100%';
  }

  if (!imageRatio) {
    return height ?? '100%';
  }

  if (typeof imageRatio === 'number') {
    return Math.round(width / imageRatio);
  }

  const [ratioWidth, ratioHeight] = String(imageRatio).split(':').map(Number);

  if (!ratioWidth || !ratioHeight) {
    return height ?? '100%';
  }

  return Math.round(width * (ratioHeight / ratioWidth));
}

function BrandPreviewImageIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.9993 7.99984C16.9327 7.99984 15.9993 8.93317 15.9993 9.99984C15.9993 11.0665 16.9327 11.9998 17.9993 11.9998C19.066 11.9998 19.9993 11.0665 19.9993 9.99984C19.9993 8.93317 19.066 7.99984 17.9993 7.99984ZM25.3327 2.6665H6.66602C4.39935 2.6665 2.66602 4.39984 2.66602 6.6665V25.3332C2.66602 27.5998 4.39935 29.3332 6.66602 29.3332H25.3327C27.5993 29.3332 29.3327 27.5998 29.3327 25.3332V6.6665C29.3327 4.39984 27.5993 2.6665 25.3327 2.6665ZM26.666 18.5332L24.1327 15.9998C22.5327 14.5332 19.9993 14.5332 18.5327 15.9998L17.3327 17.1998L13.466 13.3332C11.866 11.8665 9.33268 11.8665 7.86602 13.3332L5.33268 15.8665V6.6665C5.33268 5.8665 5.86602 5.33317 6.66602 5.33317H25.3327C26.1327 5.33317 26.666 5.8665 26.666 6.6665V18.5332Z"
        fill="#9CA3AF"
      />
    </svg>
  );
}

function BrandPreviewDownloadIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.16561 11.2029L9.1836 3.33143C9.18465 2.87119 9.55859 2.49895 10.0188 2.5C10.4791 2.50105 10.8513 2.875 10.8503 3.33524L10.8322 11.2209H10.8503L13.5649 8.50628C13.9066 8.16457 14.4606 8.16457 14.8023 8.50628C15.144 8.84799 15.144 9.40201 14.8023 9.74372L10.6356 13.9104C10.2939 14.2521 9.73992 14.2521 9.39821 13.9104L5.23154 9.74372C4.88983 9.40201 4.88983 8.84799 5.23154 8.50628C5.57325 8.16457 6.12727 8.16457 6.46898 8.50628L9.16561 11.2029ZM15.0169 15.8333C15.0169 16.2936 14.6438 16.6667 14.1836 16.6667H5.85026C5.39002 16.6667 5.01693 16.2936 5.01693 15.8333C5.01693 15.3731 5.39002 15 5.85026 15H14.1836C14.6438 15 15.0169 15.3731 15.0169 15.8333Z"
        fill="#3B82F6"
      />
    </svg>
  );
}

function BrandPreviewVideoIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12Z" fill="#1F2937" fillOpacity="0.2" />
      <path d="M8.40117 14.9993H4.80117C4.64204 14.9993 4.48943 14.9361 4.37691 14.8236C4.26439 14.7111 4.20117 14.5584 4.20117 14.3993V9.59932C4.20117 9.44019 4.26439 9.28757 4.37691 9.17505C4.48943 9.06253 4.64204 8.99932 4.80117 8.99932H8.40117L13.8012 4.79932V19.1993L8.40117 14.9993Z" fill="white" />
      <path d="M20.4008 10.1997L16.8008 13.7997" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
      <path d="M20.4008 13.7997L16.8008 10.1997" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
    </svg>
  );
}

function BrandPreviewDiscountArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 1.875V10.125" stroke="#FF6E38" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.75" />
      <path d="M2.625 6.75L6 10.125L9.375 6.75" stroke="#FF6E38" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.75" />
    </svg>
  );
}

function BrandPreviewMoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="brand-message-preview-carousel-more-icon"
      fill="none"
      height="48"
      viewBox="0 0 49 48"
      width="49"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0.5 24C0.5 10.7452 11.2452 0 24.5 0C37.7548 0 48.5 10.7452 48.5 24C48.5 37.2548 37.7548 48 24.5 48C11.2452 48 0.5 37.2548 0.5 24Z"
        fill="#D1D5DB"
      />
      <path
        d="M33.8092 22.8569L25.6426 14.6902C24.9892 14.0369 24.0092 14.0369 23.3559 14.6902C22.7026 15.3435 22.7026 16.3235 23.3559 16.9769L28.7459 22.3669H16.3326C15.3526 22.3669 14.6992 23.0202 14.6992 24.0002C14.6992 24.9802 15.3526 25.6335 16.3326 25.6335H28.7459L23.3559 31.0235C22.7026 31.6769 22.7026 32.6569 23.3559 33.3102C24.0092 33.9635 24.9892 33.9635 25.6426 33.3102L33.8092 25.1435C34.4626 24.6535 34.4626 23.5102 33.8092 22.8569Z"
        fill="white"
      />
    </svg>
  );
}

function BrandPreviewChannel({ channelId }) {
  return (
    <div className="brand-message-preview-channel">
      <p>
        (광고) {channelId}
      </p>
    </div>
  );
}

function BrandPreviewUnsubscribe({ className = '', message }) {
  const phone = message.unsubscribeNo || message.fallbackUnsubscribeNumber || '';
  const auth = message.unsubscribeAuthNo || '';

  return (
    <div className={['brand-message-preview-unsubscribe', className].filter(Boolean).join(' ')}>
      <p>
        {phone ? `무료수신거부 ${phone}` : ''}
        <br />
        {auth ? `인증번호 ${auth}` : ''}
      </p>
    </div>
  );
}

function BrandPreviewImage({
  alt,
  className = '',
  height,
  imageRatio = '',
  imageUrl = '',
  isVideo = false,
  width,
}) {
  const imageHeight = getPreviewImageHeight({ height, imageRatio, width });
  const style = typeof imageHeight === 'number' ? { height: imageHeight } : { height: imageHeight };
  const imageClassName = ['brand-message-preview-image', className].filter(Boolean).join(' ');

  return (
    <div aria-label={alt} className={imageClassName} role={isRenderableImageUrl(imageUrl) ? undefined : 'img'} style={style}>
      {isRenderableImageUrl(imageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} src={imageUrl} />
      ) : (
        <BrandPreviewImageIcon />
      )}
      {isVideo ? (
        <div className="brand-message-preview-video-overlay">
          <BrandPreviewVideoIcon />
        </div>
      ) : null}
    </div>
  );
}

function BrandPreviewButtons({ buttons = [], buttonType = 'vertical', isUseButton = true }) {
  if (!isUseButton) {
    return null;
  }

  const visibleButtons = buttons.filter((button) => button.name?.trim());

  if (!visibleButtons.length) {
    return null;
  }

  return (
    <div className={`brand-message-preview-buttons is-${buttonType}`}>
      {[...visibleButtons].sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0)).map((button, index) => {
        const isAddChannel = button.linkType === 'AC' || button.type === 'AC';

        return (
          <div
            className={['brand-message-preview-button', isAddChannel ? 'is-add-channel' : ''].filter(Boolean).join(' ')}
            key={`${button.type ?? button.linkType}-${button.name}-${button.ordering ?? index}`}
          >
            <p>{button.name}</p>
          </div>
        );
      })}
    </div>
  );
}

function BrandPreviewCoupon({ coupon }) {
  if (!coupon) {
    return null;
  }

  return (
    <div className="brand-message-preview-coupon">
      <div className="brand-message-preview-coupon-copy">
        <p>{getBrandCouponTitle(coupon) || coupon.title || '쿠폰 상세 내용을 입력해주세요'}</p>
        <span>{coupon.description ?? ''}</span>
      </div>
      <div className="brand-message-preview-coupon-stamp">
        <BrandPreviewDownloadIcon />
        <p>coupon</p>
      </div>
    </div>
  );
}

function BrandPreviewMessageContent({ content, variables }) {
  if (!content) {
    return (
      <div className="brand-message-preview-text">
        <p className="is-placeholder">메시지 내용을 입력해주세요.</p>
      </div>
    );
  }

  return (
    <div className="brand-message-preview-text">
      <p>{renderBrandPreviewText(content, variables)}</p>
    </div>
  );
}

function BrandPreviewCommercePrice({ price, variables }) {
  const discount = getPreviewDiscount(price.regularPrice, price.discountPrice);

  return (
    <div className="brand-message-preview-price">
      <div className="brand-message-preview-text">
        {price.title ? (
          <p>{renderBrandPreviewText(price.title, variables)}</p>
        ) : (
          <p className="is-placeholder">상품명을 입력해주세요</p>
        )}
      </div>
      <div className="brand-message-preview-price-row">
        <span className="brand-message-preview-discount-price">
          {price.isUsePriceVariable ? '{할인가격}원' : formatPreviewWon(price.discountPrice)}
        </span>
        <span className="brand-message-preview-regular-price">
          {price.isUsePriceVariable ? '{정상가격}원' : formatPreviewWon(price.regularPrice)}
        </span>
        {price.discountType === 'rate' ? (
          <span className="brand-message-preview-discount-meta">
            {price.isUsePriceVariable ? 'NN%' : `${discount.rate}%`}
          </span>
        ) : (
          <>
            <span className="brand-message-preview-discount-meta">
              {price.isUsePriceVariable ? '정액할인가격' : `${discount.amount.toLocaleString()}원`}
            </span>
            <BrandPreviewDiscountArrowIcon />
          </>
        )}
      </div>
      <div className="brand-message-preview-text">
        {price.additionalContent ? (
          <p className="brand-message-preview-additional">
            {renderBrandPreviewText(price.additionalContent, variables)}
          </p>
        ) : (
          <p className="brand-message-preview-additional is-placeholder">부가정보를 입력해주세요</p>
        )}
      </div>
    </div>
  );
}

function BrandPreviewCard({ children, className = '', width }) {
  return (
    <div className="brand-message-preview-card-wrap" style={{ width: width ?? '100%' }}>
      <div className={['brand-message-preview-card', className].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>
  );
}

function BrandMessageStandardBubble({
  buttons = [],
  content = '',
  coupon = null,
  imageRatio = '',
  imageUrl = '',
  message,
  type = 'TEXT',
  variables,
  videoHeader = '',
}) {
  const config = brandPreviewMockup[type] ?? brandPreviewMockup.TEXT;
  const hasImage = Boolean(config.width && config.height);

  return (
    <>
      <BrandPreviewCard width={config.width ?? '100%'}>
        {hasImage ? (
          <BrandPreviewImage
            alt="브랜드 메시지 이미지"
            height={config.height}
            imageRatio={imageRatio}
            imageUrl={imageUrl}
            isVideo={type === 'PREMIUM_VIDEO'}
            width={config.width}
          />
        ) : null}
        <div className="brand-message-preview-card-body">
          {type === 'PREMIUM_VIDEO' ? (
            <div className="brand-message-preview-video-header">
              <p>{videoHeader}</p>
            </div>
          ) : null}
          <BrandPreviewMessageContent content={content} variables={variables} />
          <BrandPreviewButtons buttons={buttons} buttonType={config.buttonType} />
          <BrandPreviewCoupon coupon={coupon} />
        </div>
      </BrandPreviewCard>
      <BrandPreviewUnsubscribe message={message} />
    </>
  );
}

function BrandMessageListBubble({ message, source }) {
  const wideList = isPlainObject(source?.wideList) ? source.wideList : {};
  const items = getWideListItems(source);
  const heroItem = items[0] ?? null;
  const title = source.header || source.mainTitle || wideList.mainTitle || source.templateName || '브랜드 메시지';
  const buttons = getPreviewButtons(wideList).length ? getPreviewButtons(wideList) : getPreviewButtons(source);
  const coupon = getPreviewCoupon(wideList) ?? getPreviewCoupon(source);

  return (
    <>
      <BrandPreviewCard className="brand-message-preview-list-card" width={brandPreviewMockup.WIDE_ITEM_LIST.width}>
        <p className="brand-message-preview-list-title">{title}</p>
        {heroItem ? (
          <div className="brand-message-preview-list-hero">
            <BrandPreviewImage
              alt={heroItem.title || '리스트 대표 이미지'}
              className="brand-message-preview-list-hero-image"
              height={100}
              imageUrl={heroItem.imageUrl}
              width={brandPreviewMockup.WIDE_ITEM_LIST.width}
            />
            <p className="brand-message-preview-list-hero-title">{heroItem.title}</p>
          </div>
        ) : null}
        <div className="brand-message-preview-list">
          {items.slice(1).map((item, index) => (
            <div className="brand-message-preview-list-item" key={`${item.title}-${index}`}>
              <BrandPreviewImage
                alt={item.title || '리스트 이미지'}
                className="brand-message-preview-list-item-image"
                height={48}
                imageRatio="1:1"
                imageUrl={item.imageUrl}
                width={48}
              />
              <div className="brand-message-preview-list-item-copy">
                <p className={item.title ? '' : 'is-placeholder'}>{item.title || '내용을 입력해주세요'}</p>
              </div>
            </div>
          ))}
        </div>
        <BrandPreviewButtons buttons={buttons} buttonType="horizontal" />
        <BrandPreviewCoupon coupon={coupon} />
      </BrandPreviewCard>
      <BrandPreviewUnsubscribe message={message} />
    </>
  );
}

function BrandMessageCommerceBubble({ message, source, variables }) {
  const commerce = getCommercePreview(source);

  return (
    <>
      <BrandPreviewCard width={brandPreviewMockup.COMMERCE.width}>
        <BrandPreviewImage
          alt={commerce.title || '상품 이미지'}
          height={brandPreviewMockup.COMMERCE.height}
          imageRatio={commerce.imageRatio}
          imageUrl={commerce.imageUrl}
          width={brandPreviewMockup.COMMERCE.width}
        />
        <div className="brand-message-preview-card-body">
          <BrandPreviewCommercePrice price={commerce} variables={variables} />
          <BrandPreviewButtons buttons={getPreviewButtons(source)} buttonType="horizontal" />
          <BrandPreviewCoupon coupon={getPreviewCoupon(source)} />
        </div>
      </BrandPreviewCard>
      <BrandPreviewUnsubscribe message={message} />
    </>
  );
}

function BrandMessageCarousel({ carouselTarget = null, commerce = false, message, source, variables }) {
  const carouselItems = getCarouselItems(source, commerce);
  const carouselTail = getCarouselTail(source, commerce);
  const displayItems = carouselTail ? [...carouselItems, carouselTail] : carouselItems;
  const carouselRef = useRef(null);
  const [dragState, setDragState] = useState(null);
  const maxIndex = Math.max(0, displayItems.length - 1);
  const type = commerce ? 'CAROUSEL_COMMERCE' : 'CAROUSEL_FEED';
  const config = brandPreviewMockup[type];

  function scrollToIndex(index, behavior = 'smooth') {
    const element = carouselRef.current;

    if (!element) {
      return;
    }

    const step = getCarouselStep(element);
    element.scrollTo({
      behavior,
      left: clampCarouselIndex(index, maxIndex) * step,
    });
  }

  useEffect(() => {
    const targetIndex = Number(carouselTarget?.index);
    const element = carouselRef.current;

    if (!Number.isFinite(targetIndex) || !element) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const step = getCarouselStep(element);

      element.scrollTo({
        behavior: 'smooth',
        left: clampCarouselIndex(targetIndex, maxIndex) * step,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [carouselTarget, maxIndex, displayItems.length]);

  function handlePointerDown(event) {
    if (event.button !== 0 || maxIndex === 0) {
      return;
    }

    const element = event.currentTarget;
    const step = getCarouselStep(element);

    element.setPointerCapture?.(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      startIndex: clampCarouselIndex(Math.round(element.scrollLeft / step), maxIndex),
      startScrollLeft: element.scrollLeft,
      startX: event.clientX,
      step,
    });
  }

  function handlePointerMove(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = dragState.startScrollLeft - (event.clientX - dragState.startX);
  }

  function finishPointerDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const element = carouselRef.current;
    const delta = event.clientX - dragState.startX;
    const direction = Math.abs(delta) >= brandCarouselDragThreshold ? (delta < 0 ? 1 : -1) : 0;
    const targetIndex = direction
      ? dragState.startIndex + direction
      : Math.round((element?.scrollLeft ?? 0) / dragState.step);

    if (element?.hasPointerCapture?.(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
    window.requestAnimationFrame(() => {
      scrollToIndex(targetIndex);
    });
  }

  function handleKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    const element = carouselRef.current;
    const step = getCarouselStep(element);
    const currentIndex = clampCarouselIndex(Math.round((element?.scrollLeft ?? 0) / step), maxIndex);
    const direction = event.key === 'ArrowRight' ? 1 : -1;

    event.preventDefault();
    scrollToIndex(currentIndex + direction);
  }

  return (
    <>
      <div
        aria-label="브랜드 메시지 캐러셀"
        className={[
          'brand-message-preview-carousel',
          maxIndex > 0 ? 'is-draggable' : '',
          dragState ? 'is-dragging' : '',
          commerce ? 'is-commerce' : 'is-feed',
        ].filter(Boolean).join(' ')}
        onKeyDown={handleKeyDown}
        onPointerCancel={finishPointerDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        ref={carouselRef}
        role="region"
        tabIndex={maxIndex > 0 ? 0 : undefined}
      >
        {displayItems.map((item, index) => {
          if (item.type === 'tail') {
            return (
              <div className="brand-message-preview-carousel-more-slide" key={`${item.type}-${index}`}>
                <div className="brand-message-preview-carousel-more">
                  <BrandPreviewMoreIcon />
                  <p>더보기</p>
                </div>
              </div>
            );
          }

          return (
            <div className="brand-message-preview-carousel-slide" key={`${item.type ?? 'card'}-${item.title}-${index}`}>
              <div className="brand-message-preview-carousel-card-wrap" style={{ width: config.width }}>
                <div className="brand-message-preview-carousel-card">
                  <BrandPreviewImage
                    alt={item.title || '캐러셀 이미지'}
                    height={config.height}
                    imageRatio={item.imageRatio}
                    imageUrl={item.imageUrl}
                    width={config.width}
                  />
                  <div className="brand-message-preview-carousel-body">
                    {commerce ? (
                      item.type === 'intro' ? (
                        <>
                          <div className="brand-message-preview-carousel-intro-header">
                            {item.title ? (
                              <p>{renderBrandPreviewText(item.title, variables)}</p>
                            ) : (
                              <p className="is-placeholder">제목을 입력해주세요</p>
                            )}
                          </div>
                          <div className="brand-message-preview-carousel-intro-content">
                            <BrandPreviewMessageContent content={item.content} variables={variables} />
                          </div>
                        </>
                      ) : (
                        <>
                          <BrandPreviewCommercePrice price={item} variables={variables} />
                          <div className="brand-message-preview-carousel-bottom">
                            <BrandPreviewButtons buttons={item.buttons ?? []} buttonType="horizontal" isUseButton={item.isUseButton !== false} />
                            <BrandPreviewCoupon coupon={item.coupon} />
                          </div>
                        </>
                      )
                    ) : (
                      <>
                        <div className={['brand-message-preview-carousel-header', item.title ? 'has-title' : ''].filter(Boolean).join(' ')}>
                          <p>{item.title}</p>
                        </div>
                        <div className="brand-message-preview-carousel-content">
                          <BrandPreviewMessageContent content={item.content} variables={variables} />
                        </div>
                        <div className="brand-message-preview-carousel-bottom">
                          <BrandPreviewButtons buttons={item.buttons ?? []} buttonType="horizontal" isUseButton={item.isUseButton !== false} />
                          <BrandPreviewCoupon coupon={item.coupon} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <BrandPreviewUnsubscribe
        className={commerce ? 'is-carousel-commerce' : 'is-carousel-feed'}
        message={message}
      />
    </>
  );
}

function BrandTemplatePreview({ carouselTarget, message, template }) {
  if (!template) {
    return (
      <BrandMessageStandardBubble message={message} variables={message.templateParameter}>
        <span className="brand-message-preview-empty">템플릿을 선택하면 미리보기가 표시됩니다</span>
      </BrandMessageStandardBubble>
    );
  }

  const type = getNhnBrandChatBubbleType(template.chatBubbleType);

  if (type === 'CAROUSEL_FEED') {
    return <BrandMessageCarousel carouselTarget={carouselTarget} message={message} source={template} variables={message.templateParameter} />;
  }

  if (type === 'CAROUSEL_COMMERCE') {
    return <BrandMessageCarousel carouselTarget={carouselTarget} commerce message={message} source={template} variables={message.templateParameter} />;
  }

  if (type === 'COMMERCE') {
    return <BrandMessageCommerceBubble message={message} source={template} variables={message.templateParameter} />;
  }

  if (type === 'WIDE_ITEM_LIST') {
    return <BrandMessageListBubble message={message} source={template} />;
  }

  if (type === 'PREMIUM_VIDEO') {
    const video = isPlainObject(template.video) ? template.video : {};

    return (
      <BrandMessageStandardBubble
        buttons={getPreviewButtons(template)}
        content={template.content ?? ''}
        coupon={getPreviewCoupon(template)}
        imageRatio={getImageRatio(template)}
        imageUrl={getImageUrl(template)}
        message={message}
        type="PREMIUM_VIDEO"
        variables={message.templateParameter}
        videoHeader={video.title || template.header || ''}
      />
    );
  }

  return (
    <BrandMessageStandardBubble
      buttons={getPreviewButtons(template)}
      content={template.content ?? ''}
      coupon={getPreviewCoupon(template)}
      imageRatio={getImageRatio(template)}
      imageUrl={getImageUrl(template)}
      message={message}
      type={type}
      variables={message.templateParameter}
    />
  );
}

function BrandFreestylePreview({ carouselTarget, message }) {
  const body = message.content.trim();
  const visibleButtons = message.buttons.filter((button) => button.name?.trim());
  const type = getNhnBrandChatBubbleType(message.chatBubbleType);
  const previewSource = {
    ...message,
    header: message.header,
    templateName: message.header || '브랜드 메시지',
  };

  if (type === 'CAROUSEL_FEED') {
    return <BrandMessageCarousel carouselTarget={carouselTarget} message={message} source={previewSource} variables={message.templateParameter} />;
  }

  if (type === 'CAROUSEL_COMMERCE') {
    return <BrandMessageCarousel carouselTarget={carouselTarget} commerce message={message} source={previewSource} variables={message.templateParameter} />;
  }

  if (type === 'COMMERCE') {
    return <BrandMessageCommerceBubble message={message} source={previewSource} variables={message.templateParameter} />;
  }

  if (type === 'WIDE_ITEM_LIST') {
    return <BrandMessageListBubble message={message} source={previewSource} />;
  }

  if (type === 'PREMIUM_VIDEO') {
    const video = isPlainObject(message.video) ? message.video : {};

    return (
      <BrandMessageStandardBubble
        buttons={visibleButtons}
        content={body}
        coupon={message.coupon}
        imageRatio={getImageRatio(message)}
        imageUrl={getImageUrl(message)}
        message={message}
        type="PREMIUM_VIDEO"
        variables={message.templateParameter}
        videoHeader={video.title || message.header || ''}
      />
    );
  }

  return (
    <BrandMessageStandardBubble
      buttons={visibleButtons}
      content={body}
      coupon={message.coupon}
      imageRatio={getImageRatio(message)}
      imageUrl={getImageUrl(message)}
      message={message}
      type={type}
      variables={message.templateParameter}
    />
  );
}

function getBrandMessagePreviewState(value, senderProfiles, templates) {
  const message = getBrandMessagePreviewValue(value);
  const selectedSenderProfile = getSelectedSenderProfile(message, senderProfiles);
  const selectedTemplate = getSelectedTemplate(message, templates);
  const senderLabel = selectedSenderProfile?.plusFriendId || '발신 프로필 미선택';
  const activeType = getNhnBrandChatBubbleType(selectedTemplate?.chatBubbleType ?? message.chatBubbleType);
  const isCarousel = activeType === 'CAROUSEL_FEED' || activeType === 'CAROUSEL_COMMERCE';

  return {
    isCarousel,
    message,
    selectedTemplate,
    senderLabel,
  };
}

export function BrandMessagePreviewMessage({
  carouselTarget = null,
  previewState = null,
  senderProfiles = defaultBrandMessageSenderProfiles,
  showChannel = true,
  templates = defaultBrandMessageTemplates,
  value,
}) {
  const {
    message,
    selectedTemplate,
    senderLabel,
  } = previewState ?? getBrandMessagePreviewState(value, senderProfiles, templates);

  return (
    <>
      {showChannel ? <BrandPreviewChannel channelId={senderLabel} /> : null}
      {selectedTemplate ? (
        <BrandTemplatePreview carouselTarget={carouselTarget} message={message} template={selectedTemplate} />
      ) : (
        <BrandFreestylePreview carouselTarget={carouselTarget} message={message} />
      )}
    </>
  );
}

export function NhnBrandMessagePreview({
  carouselTarget = null,
  className = '',
  senderProfiles = defaultBrandMessageSenderProfiles,
  templates = defaultBrandMessageTemplates,
  value,
  ...props
}) {
  const previewState = getBrandMessagePreviewState(value, senderProfiles, templates);

  return (
    <aside
      aria-label="브랜드 메시지 미리보기"
      className={['brand-message-preview', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="brand-message-preview-title">미리보기</div>
      <div className={['brand-message-preview-phone', previewState.isCarousel ? 'is-carousel' : ''].filter(Boolean).join(' ')}>
        <BrandMessagePreviewMessage
          carouselTarget={carouselTarget}
          previewState={previewState}
        />
      </div>
    </aside>
  );
}

export const BrandMessagePreview = NhnBrandMessagePreview;
