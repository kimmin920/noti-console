export const kakaoConnectCategories = [
  {
    children: [
      {
        children: [
          { children: [], code: '00100010001', label: '온라인 쇼핑몰' },
          { children: [], code: '00100010002', label: '오프라인 매장' },
        ],
        code: '0010001',
        label: '판매/유통',
      },
      {
        children: [
          { children: [], code: '00100020001', label: '예약/배송' },
          { children: [], code: '00100020002', label: '고객 상담' },
        ],
        code: '0010002',
        label: '고객 서비스',
      },
    ],
    code: '001',
    label: '비즈니스',
  },
  {
    children: [
      {
        children: [
          { children: [], code: '00200010001', label: '병원/의료' },
          { children: [], code: '00200010002', label: '교육/강의' },
        ],
        code: '0020001',
        label: '전문 서비스',
      },
    ],
    code: '002',
    label: '서비스',
  },
];

export const defaultKakaoConnectForm = {
  largeCategoryCode: '001',
  middleCategoryCode: '0010001',
  phoneNo: '01012345678',
  plusFriendId: '@daily_market',
  smallCategoryCode: '00100010001',
  token: '',
};

export const kakaoExistingChannels = [
  {
    createdAt: '2026-05-28',
    id: 'sender-profile-acme',
    isDefault: true,
    plusFriendId: '@acme_store',
    senderKey: 'sender-key-acme-001',
    senderProfileType: 'alimtalk',
    status: 'ACTIVE',
  },
];
