import React from 'react';

const KAKAO_EMOJI_TOKENS = [
  '(미소)',
  '(윙크)',
  '(방긋)',
  '(반함)',
  '(눈물)',
  '(절규)',
  '(크크)',
  '(메롱)',
  '(잘자)',
  '(잘난척)',
  '(헤롱)',
  '(놀람)',
  '(아픔)',
  '(당황)',
  '(풍선껌)',
  '(버럭)',
  '(부끄)',
  '(궁금)',
  '(흡족)',
  '(깜찍)',
  '(으으)',
  '(민망)',
  '(곤란)',
  '(잠)',
  '(행복)',
  '(안도)',
  '(우웩)',
  '(외계인)',
  '(외계인녀)',
  '(공포)',
  '(근심)',
  '(악마)',
  '(썩소)',
  '(쳇)',
  '(야호)',
  '(좌절)',
  '(삐짐)',
  '(하트)',
  '(실연)',
  '(별)',
  '(브이)',
  '(오케이)',
  '(최고)',
  '(최악)',
  '(그만)',
  '(땀)',
  '(알약)',
  '(밥)',
  '(커피)',
  '(맥주)',
  '(소주)',
  '(와인)',
  '(치킨)',
  '(축하)',
  '(음표)',
  '(선물)',
  '(케익)',
  '(촛불)',
  '(컵케익a)',
  '(컵케익b)',
  '(해)',
  '(구름)',
  '(비)',
  '(눈)',
  '(똥)',
  '(근조)',
  '(딸기)',
  '(호박)',
  '(입술)',
  '(야옹)',
  '(돈)',
  '(담배)',
  '(축구)',
  '(야구)',
  '(농구)',
  '(당구)',
  '(골프)',
  '(카톡)',
  '(꽃)',
  '(총)',
  '(크리스마스)',
  '(콜)',
  '(하트뿅)',
  '(하하)',
  '(우와)',
  '(심각)',
  '(힘듦)',
  '(흑흑)',
  '(아잉)',
  '(찡긋)',
  '(뿌듯)',
  '(깜짝)',
  '(빠직)',
  '(짜증)',
  '(제발)',
  '(씨익)',
  '(신나)',
  '(헉)',
  '(열받아)',
  '(흥)',
  '(감동)',
  '(뽀뽀)',
  '(멘붕)',
  '(정색)',
  '(쑥스)',
  '(꺄아)',
  '(좋아)',
  '(굿)',
  '(훌쩍)',
  '(허걱)',
  '(부르르)',
  '(푸하하)',
  '(발그레)',
  '(수줍)',
  '(컴온)',
  '(졸려)',
];

const KAKAO_EMOJI_PATTERN = new RegExp(
  `(${KAKAO_EMOJI_TOKENS.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'g'
);

function cx(...classNames) {
  return classNames.filter(Boolean).join(' ');
}

function SourceImg(props) {
  return React.createElement('img', props);
}

function isPresent(value) {
  return value !== null && value !== undefined && value !== '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getEmojiImagePath(index) {
  if (index > 82) {
    return `/src/static/image/emoji/1${String(index - 82).padStart(3, '0')}.png`;
  }

  return `/src/static/image/emoji/${String(index).padStart(3, '0')}.png`;
}

function renderKakaoEmojiText(text) {
  const value = String(text ?? '');

  if (!value) {
    return [];
  }

  const parts = [];
  let lastIndex = 0;
  let match = KAKAO_EMOJI_PATTERN.exec(value);

  while (match) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }

    const token = match[0];
    const emojiIndex = KAKAO_EMOJI_TOKENS.indexOf(token) + 1;

    parts.push(SourceImg({
      alt: token,
      className: 'kakao-template-preview-emojiImg',
      key: `${token}-${match.index}`,
      src: getEmojiImagePath(emojiIndex),
      title: token,
    }));
    lastIndex = match.index + token.length;
    match = KAKAO_EMOJI_PATTERN.exec(value);
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  KAKAO_EMOJI_PATTERN.lastIndex = 0;

  return parts;
}

function getDate(dateString) {
  const date = dateString ? new Date(dateString) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

function formatDateLabel(date) {
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`;
}

function formatTimeLabel(date) {
  const hours = date.getHours();
  const period = hours >= 12 ? '오후' : '오전';
  const twelveHour = hours % 12 || 12;

  return `${period} ${twelveHour}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function sortButtons(buttons) {
  return [...buttons].sort((left, right) => {
    const leftPriority = Number.isFinite(Number(left?.priority)) ? Number(left.priority) : 0;
    const rightPriority = Number.isFinite(Number(right?.priority)) ? Number(right.priority) : 0;

    return leftPriority - rightPriority;
  });
}

function hasButtonType(buttons, buttonType) {
  return buttons.some((button) => button?.buttonType === buttonType);
}

function hasSummary(summaryTitle, summaryDescription) {
  return isPresent(summaryTitle) || isPresent(summaryDescription);
}

function SourceDivider({ className = '' }) {
  return <div className={cx('kakao-template-preview-sourceDivider', className)} />;
}

function KakaoTemplatePreviewBubble({
  adFlag,
  buttons,
  emphasizeSubtitle,
  emphasizeTitle,
  extra,
  fileData,
  header,
  highlightDescription,
  highlighThumbnailImageUrl,
  highlightThumbnailImageId,
  highlightTitle,
  imageId,
  imageUrl,
  isCta,
  isIncludedAcButton,
  items,
  quickReplies,
  summaryDescription,
  summaryTitle,
  text,
}) {
  const normalizedButtons = toArray(buttons);
  const normalizedFileData = toArray(fileData);
  const normalizedItems = toArray(items);
  const normalizedQuickReplies = toArray(quickReplies);
  const usesImageBubble = isCta && (isPresent(imageUrl) || isPresent(imageId) || normalizedFileData.length > 0);
  const showsHighlight = isPresent(highlightTitle) || isPresent(highlightDescription);
  const showsTextEmphasis = isPresent(emphasizeTitle) || isPresent(emphasizeSubtitle);
  const showsSummary = hasSummary(summaryTitle, summaryDescription);

  return (
    <div className={usesImageBubble ? 'kakao-template-preview-imgBubbleArea' : 'kakao-template-preview-bubbleArea'}>
      <div className="kakao-template-preview-channelName">
        {adFlag === true ? <span className="kakao-template-preview-channelAdText">(광고)</span> : null}
        채널명
      </div>
      <div className="kakao-template-preview-talkMessageWrap">
        {!isCta ? <div className="kakao-template-preview-badge">kakao</div> : null}
        <div className="kakao-template-preview-roundBox">
          {!isCta ? <div className="kakao-template-preview-title">알림톡 도착</div> : null}
          {isPresent(imageUrl) ? (
            <div className="kakao-template-preview-ataImgBox">
              <SourceImg alt="kakaoImg" className="kakao-template-preview-ataImg" src={imageUrl} title="kakaoImg" />
            </div>
          ) : null}
          {!isPresent(imageUrl) && normalizedFileData.length > 0 ? (
            <div className="kakao-template-preview-ataImgBox">
              <SourceImg
                alt="kakaoImg"
                className="kakao-template-preview-ataImg"
                src={`data:image/gif;base64,${normalizedFileData[0]}`}
                title="kakaoImg"
              />
            </div>
          ) : null}
          {!isPresent(imageUrl) && normalizedFileData.length < 1 && isPresent(imageId) ? (
            <div className="kakao-template-preview-ataTmpImgBox">
              <p className="kakao-template-preview-ataTmpImgText">이미지 미리보기</p>
            </div>
          ) : null}
          <div className="kakao-template-preview-text">
            {isPresent(header) ? (
              <>
                <div className="kakao-template-preview-header">
                  <strong>{header}</strong>
                </div>
                <SourceDivider />
              </>
            ) : null}
            {showsHighlight ? (
              <>
                <div className="kakao-template-preview-highlight">
                  <div className="kakao-template-preview-highlightText">
                    <div className="kakao-template-preview-normalText">{highlightTitle}</div>
                    <div className="kakao-template-preview-subText kakao-template-preview-subColor">
                      {highlightDescription}
                    </div>
                  </div>
                  {isPresent(highlightThumbnailImageId) ? (
                    <div className="kakao-template-preview-highlightThumbnailPlaceholder" />
                  ) : null}
                  {isPresent(highlighThumbnailImageUrl) ? (
                    <div className="kakao-template-preview-highlighThumbnailImageWrap">
                      <SourceImg
                        alt="alimtalk_highlight_thumbnail_image"
                        className="kakao-template-preview-highlighThumbnailImage"
                        src={highlighThumbnailImageUrl}
                        title="alimtalk_highlight_thumbnail_image"
                      />
                    </div>
                  ) : null}
                </div>
                <SourceDivider />
              </>
            ) : null}
            {normalizedItems.length > 0 ? (
              <div className="kakao-template-preview-items">
                {normalizedItems.map((item, index) => (
                  <div className="kakao-template-preview-itemRow" key={`${item?.title ?? ''}-${index}`}>
                    <div className="kakao-template-preview-subText kakao-template-preview-subColor">{item?.title}</div>
                    <div className={cx('kakao-template-preview-subText', showsSummary && 'is-right-aligned')}>
                      {item?.description}
                    </div>
                  </div>
                ))}
                {showsSummary ? (
                  <div className="kakao-template-preview-summaryRow">
                    <div className="kakao-template-preview-subText kakao-template-preview-subColor">{summaryTitle}</div>
                    <div className="kakao-template-preview-summaryDescription">
                      <strong>{summaryDescription}</strong>
                    </div>
                  </div>
                ) : null}
                <SourceDivider />
              </div>
            ) : null}
            {showsTextEmphasis ? (
              <div className="kakao-template-preview-textEmphasis">
                <div className="kakao-template-preview-emphasizeSubtitle">{emphasizeSubtitle}</div>
                <div className="kakao-template-preview-emphasizeTitle">
                  <strong>{emphasizeTitle}</strong>
                </div>
                <div className="kakao-template-preview-divider" />
              </div>
            ) : null}
            {renderKakaoEmojiText(text).map((part, index) => (
              <React.Fragment key={`text-${index}`}>{part}</React.Fragment>
            ))}
            {extra ? (
              <div className="kakao-template-preview-extraText kakao-template-preview-subText kakao-template-preview-subColor">
                {extra}
              </div>
            ) : null}
            {isIncludedAcButton ? (
              <div className="kakao-template-preview-adText">
                채널 추가하고 이 채널의 광고와 마케팅 메시지를 카카오톡으로 받기
              </div>
            ) : null}
            {normalizedButtons.length > 0 ? (
              <div className="kakao-template-preview-buttonArea">
                {sortButtons(normalizedButtons).map((button, index) => {
                  const isAddChannel = button?.priority === -1 || button?.buttonName === '채널 추가';

                  return (
                    <button
                      className={cx(
                        'kakao-template-preview-button',
                        isAddChannel && 'kakao-template-preview-addKakaoButton'
                      )}
                      key={`${button?.buttonName ?? ''}-${index}`}
                      type="button"
                    >
                      {button?.buttonName}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {normalizedQuickReplies.length > 0 ? (
        <div className="kakao-template-preview-quickRepliyBtnWrap">
          <div className="kakao-template-preview-quickReplyRow">
            {normalizedQuickReplies.map((reply, index) => (
              <div className="kakao-template-preview-quickRepliyBtnNameBox" key={`${reply?.name ?? ''}-${index}`}>
                <span>{reply?.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {adFlag === true ? <div className="kakao-template-preview-ctaBottomAdText">수신거부 | 홈 → 채널 차단</div> : null}
    </div>
  );
}

export function KakaoTemplatePreview({
  adFlag = false,
  bubbleOnly = false,
  buttons = [],
  className = '',
  dateString,
  emphasizeSubtitle = '',
  emphasizeTitle = '',
  extra = '',
  fileData = [],
  header = '',
  highlightDescription = '',
  highlighThumbnailImageUrl = '',
  highlightThumbnailImageId = '',
  highlightTitle = '',
  imageId = '',
  imageUrl = '',
  isCta = false,
  items = [],
  quickReplies = [],
  summaryDescription = '',
  summaryTitle = '',
  text = '',
  ...props
}) {
  const normalizedButtons = toArray(buttons);
  const normalizedQuickReplies = toArray(quickReplies);
  const hasAcButton = hasButtonType(normalizedButtons, 'AC');
  const hasDsButton = hasButtonType(normalizedButtons, 'DS');
  const previewDate = getDate(dateString);
  const bubble = (
    <KakaoTemplatePreviewBubble
      adFlag={adFlag}
      buttons={normalizedButtons}
      emphasizeSubtitle={emphasizeSubtitle}
      emphasizeTitle={emphasizeTitle}
      extra={extra}
      fileData={fileData}
      header={header}
      highlightDescription={highlightDescription}
      highlighThumbnailImageUrl={highlighThumbnailImageUrl}
      highlightThumbnailImageId={highlightThumbnailImageId}
      highlightTitle={highlightTitle}
      imageId={imageId}
      imageUrl={imageUrl}
      isCta={isCta}
      isIncludedAcButton={hasAcButton}
      items={items}
      quickReplies={normalizedQuickReplies}
      summaryDescription={summaryDescription}
      summaryTitle={summaryTitle}
      text={text}
    />
  );

  if (bubbleOnly) {
    return bubble;
  }

  return (
    <div className={cx('kakao-template-preview-root', className)} {...props}>
      <div className="kakao-template-preview-paper">
        <div className="kakao-template-preview-dateWrap">
          <div className="kakao-template-preview-divider" />
          <div className="kakao-template-preview-date">{formatDateLabel(previewDate)}</div>
          <div className="kakao-template-preview-divider" />
        </div>
        <div className="kakao-template-preview-messageRow">
          <div className="kakao-template-preview-profileImg" />
          <div className="kakao-template-preview-messageContent">
            {bubble}
            <div
              className={cx(
                'kakao-template-preview-timeWrap',
                normalizedQuickReplies.length > 0 && 'hasQuickReplies'
              )}
            >
              <span className="kakao-template-preview-time">{formatTimeLabel(previewDate)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="kakao-template-preview-footerNotes">
        <span>미리보기는 실제 단말기와 차이가 있을 수 있습니다.</span>
        {hasAcButton ? <span>{'"채널추가" 버튼은 이미 채널을 추가한 사용자에게는 보이지 않습니다.'}</span> : null}
        {hasDsButton ? <span>{'"배송조회" 버튼은 내용에 송장번호가 포함되어 있어야 합니다.'}</span> : null}
      </div>
    </div>
  );
}
