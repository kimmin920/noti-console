import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KakaoTemplatePreview } from '../../components/ui/KakaoTemplatePreview.jsx';

function renderPreview(props) {
  return renderToStaticMarkup(React.createElement(KakaoTemplatePreview, props));
}

function expectOrder(html, values) {
  const positions = values.map((value) => {
    const position = html.indexOf(value);

    expect(position, `${value} should be rendered`).toBeGreaterThanOrEqual(0);

    return position;
  });

  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index - 1], `${values[index - 1]} should precede ${values[index]}`).toBeLessThan(
      positions[index]
    );
  }
}

describe('KakaoTemplatePreview source-backed contract', () => {
  it('renders normal text, source shell structure, sorted buttons, quick replies, ads, and literal variables', () => {
    const html = renderPreview({
      adFlag: true,
      buttons: [
        { buttonName: '상세 보기', buttonType: 'WL', priority: 2 },
        { buttonName: '채널 추가', buttonType: 'AC', priority: -1 },
        { buttonName: '배송조회', buttonType: 'DS', priority: 1 },
      ],
      dateString: '2026-06-13T09:05:00',
      extra: '부가정보',
      quickReplies: [{ name: '문의하기' }],
      text: '주문 #{orderNo}\n(미소)',
    });

    expect(html).toContain('kakao-template-preview-root');
    expect(html).toContain('kakao-template-preview-paper');
    expect(html).toContain('kakao-template-preview-dateWrap');
    expect(html).toContain('kakao-template-preview-profileImg');
    expect(html).toContain('kakao-template-preview-bubbleArea');
    expect(html).toContain('kakao-template-preview-talkMessageWrap');
    expect(html).toContain('kakao-template-preview-roundBox');
    expect(html).toContain('kakao-template-preview-title');
    expect(html).toContain('kakao-template-preview-badge');
    expect(html).toContain('kakao-template-preview-text');
    expect(html).toContain('kakao-template-preview-buttonArea');
    expect(html).toContain('kakao-template-preview-addKakaoButton');
    expect(html).toContain('kakao-template-preview-quickRepliyBtnWrap');
    expect(html).toContain('kakao-template-preview-quickRepliyBtnNameBox');
    expect(html).toContain('kakao-template-preview-time');

    expect(html).toContain('2026년 06월 13일');
    expect(html).toContain('오전 9:05');
    expect(html).toContain('(광고)');
    expect(html).toContain('채널명');
    expect(html).toContain('kakao');
    expect(html).toContain('알림톡 도착');
    expect(html).toContain('주문 #{orderNo}');
    expect(html).toContain('부가정보');
    expect(html).toContain('채널 추가하고 이 채널의 광고와 마케팅 메시지를 카카오톡으로 받기');
    expect(html).toContain('문의하기');
    expect(html).toContain('수신거부 | 홈 → 채널 차단');
    expect(html).toContain('미리보기는 실제 단말기와 차이가 있을 수 있습니다.');
    expect(html).toContain('채널추가');
    expect(html).toContain('배송조회');
    expect(html).toContain('/src/static/image/emoji/001.png');
    expect(html).toContain('alt="(미소)"');

    expectOrder(html, ['채널 추가</button>', '배송조회</button>', '상세 보기</button>']);
    expect(html).not.toContain('alimtalk-preview-token');
    expect(html).not.toContain('템플릿을 선택하면 미리보기가 표시됩니다');
    expect(html).not.toContain('버튼/링크');
    expect(html).not.toContain('채널 미선택');
  });

  it('renders bubble-only text emphasis in source order without the full phone shell', () => {
    const html = renderPreview({
      bubbleOnly: true,
      emphasizeSubtitle: '보조 문구',
      emphasizeTitle: '강조 제목',
      text: '본문 #{변수}',
    });

    expect(html).toContain('kakao-template-preview-bubbleArea');
    expect(html).toContain('kakao-template-preview-emphasizeSubtitle');
    expect(html).toContain('kakao-template-preview-emphasizeTitle');
    expect(html).toContain('kakao-template-preview-divider');
    expect(html).toContain('본문 #{변수}');
    expect(html).not.toContain('kakao-template-preview-paper');
    expect(html).not.toContain('미리보기는 실제 단말기와 차이가 있을 수 있습니다.');
    expect(html).not.toContain('alimtalk-preview-token');
    expectOrder(html, ['보조 문구', '강조 제목', 'kakao-template-preview-divider', '본문 #{변수}']);
  });

  it('renders renderer-only image placeholder and item-list structure branches', () => {
    const html = renderPreview({
      bubbleOnly: true,
      header: '주문 안내',
      highlightDescription: '하이라이트 설명',
      highlightThumbnailImageId: 'thumbnail-id',
      highlightTitle: '하이라이트 제목',
      imageId: 'image-id',
      isCta: true,
      items: [
        { title: '상품명', description: '커피' },
        { title: '수량', description: '2개' },
      ],
      summaryDescription: '12,000원',
      summaryTitle: '합계',
      text: '본문',
    });

    expect(html).toContain('kakao-template-preview-imgBubbleArea');
    expect(html).toContain('kakao-template-preview-ataTmpImgBox');
    expect(html).toContain('이미지 미리보기');
    expect(html).toContain('kakao-template-preview-header');
    expect(html).toContain('kakao-template-preview-highlight');
    expect(html).toContain('kakao-template-preview-highlightThumbnailPlaceholder');
    expect(html).not.toContain('kakao-template-preview-highlighThumbnailImageWrap');
    expect(html).not.toContain('alt="alimtalk_highlight_thumbnail_image"');
    expect(html).toContain('kakao-template-preview-itemRow');
    expect(html).toContain('kakao-template-preview-summaryRow');
    expect(html).toContain('주문 안내');
    expect(html).toContain('하이라이트 제목');
    expect(html).toContain('하이라이트 설명');
    expect(html).toContain('상품명');
    expect(html).toContain('커피');
    expect(html).toContain('합계');
    expect(html).toContain('12,000원');
    expect(html).not.toContain('알림톡 도착');
    expect(html).not.toContain('kakao-template-preview-badge');

    expectOrder(html, ['이미지 미리보기', '주문 안내', '하이라이트 제목', '상품명', '합계', '본문']);
  });

  it('renders source-reachable loaded highlight thumbnail without the renderer placeholder', () => {
    const html = renderPreview({
      bubbleOnly: true,
      header: '주문 안내',
      highlightDescription: '하이라이트 설명',
      highlighThumbnailImageUrl: 'https://example.test/highlight.png',
      highlightTitle: '하이라이트 제목',
      items: [
        { title: '상품명', description: '커피' },
        { title: '수량', description: '2개' },
      ],
      summaryDescription: '12,000원',
      summaryTitle: '합계',
      text: '본문',
    });

    expect(html).toContain('kakao-template-preview-header');
    expect(html).toContain('kakao-template-preview-highlight');
    expect(html).toContain('kakao-template-preview-highlighThumbnailImageWrap');
    expect(html).toContain('alt="alimtalk_highlight_thumbnail_image"');
    expect(html).not.toContain('kakao-template-preview-highlightThumbnailPlaceholder');
    expect(html).toContain('하이라이트 제목');
    expect(html).toContain('하이라이트 설명');
    expect(html).toContain('상품명');
    expect(html).toContain('합계');
  });

  it('renders source image priority branches for direct image URL and local file data', () => {
    const imageUrlHtml = renderPreview({
      bubbleOnly: true,
      fileData: ['R0lGODlhAQABAIAAAAUEBA=='],
      imageId: 'image-id',
      imageUrl: 'https://example.test/main.png',
      text: '이미지 본문',
    });
    const fileDataHtml = renderPreview({
      bubbleOnly: true,
      fileData: ['R0lGODlhAQABAIAAAAUEBA=='],
      imageId: 'image-id',
      text: '파일 본문',
    });
    const placeholderHtml = renderPreview({
      bubbleOnly: true,
      imageId: 'image-id',
      text: '플레이스홀더 본문',
    });

    expect(imageUrlHtml).toContain('src="https://example.test/main.png"');
    expect(imageUrlHtml).not.toContain('data:image/gif;base64');
    expect(imageUrlHtml).not.toContain('이미지 미리보기');
    expect(fileDataHtml).toContain('src="data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA=="');
    expect(fileDataHtml).not.toContain('이미지 미리보기');
    expect(fileDataHtml).toContain('파일 본문');
    expect(placeholderHtml).toContain('kakao-template-preview-ataTmpImgBox');
    expect(placeholderHtml).toContain('이미지 미리보기');
    expect(placeholderHtml).not.toContain('kakao-template-preview-ataImg"');
  });
});
