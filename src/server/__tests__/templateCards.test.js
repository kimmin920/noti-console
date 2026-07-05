import { describe, expect, it } from 'vitest';

import { getTemplateCardItems } from '../../features/console/templates/templateCards.js';

describe('template card items', () => {
  it('labels common Kakao template sources as common next to the template code', () => {
    const [item] = getTemplateCardItems([
      {
        channel: 'alimtalk',
        providerStatus: 'APR',
        source: 'GROUP',
        sourceLabel: '@비주오',
        templateCode: 'ORDER_01',
        templateName: '주문완료1',
      },
    ]);

    expect(item).toMatchObject({
      code: 'ORDER_01',
      codeMetaLabel: '공통',
      name: '주문완료1',
      ownerLabel: '@비주오',
    });
  });

  it('labels sender-profile templates with their registered channel next to the template code', () => {
    const [item] = getTemplateCardItems([
      {
        channel: 'alimtalk',
        providerStatus: 'APR',
        source: 'SENDER_PROFILE',
        sourceLabel: '@store',
        templateCode: 'STORE_ORDER_01',
        templateName: '매장 주문 완료',
      },
    ]);

    expect(item).toMatchObject({
      code: 'STORE_ORDER_01',
      codeMetaLabel: '@store',
      name: '매장 주문 완료',
      ownerLabel: '@store',
    });
  });

  it('labels Brand Message registered status from the provider status code', () => {
    const [item] = getTemplateCardItems([
      {
        channel: 'brand-message',
        providerStatus: 'A',
        source: 'SENDER_PROFILE',
        sourceLabel: '@brand',
        templateCode: 'BRAND_WELCOME',
        templateName: '브랜드 안내',
      },
    ]);

    expect(item).toMatchObject({
      code: 'BRAND_WELCOME',
      name: '브랜드 안내',
      status: '등록',
      statusTone: 'green',
    });
  });

  it('preserves Brand Message rich preview fields from template list responses', () => {
    const [item] = getTemplateCardItems([
      {
        carousel: {
          head: {
            header: '인트로',
            imageUrl: 'https://cdn.example.com/intro.jpg',
          },
          list: [
            {
              commerce: {
                discountPrice: '29000',
                regularPrice: '42000',
                title: '상품',
              },
              imageUrl: 'https://cdn.example.com/product.jpg',
            },
          ],
        },
        carouselItems: [{ title: '상품' }],
        channel: 'brand-message',
        chatBubbleType: 'CAROUSEL_COMMERCE',
        commerce: { title: '대표 상품' },
        imageUrl: 'https://cdn.example.com/top.jpg',
        item: { list: [{ title: '리스트' }] },
        templateCode: 'BRAND_CAROUSEL',
        templateName: '브랜드 캐러셀',
        video: { videoUrl: 'https://tv.kakao.com/v/1234' },
      },
    ]);

    expect(item).toMatchObject({
      carousel: {
        head: {
          header: '인트로',
          imageUrl: 'https://cdn.example.com/intro.jpg',
        },
      },
      carouselItems: [{ title: '상품' }],
      chatBubbleType: 'CAROUSEL_COMMERCE',
      commerce: { title: '대표 상품' },
      imageUrl: 'https://cdn.example.com/top.jpg',
      item: { list: [{ title: '리스트' }] },
      video: { videoUrl: 'https://tv.kakao.com/v/1234' },
    });
  });
});
