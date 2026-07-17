import { DEFAULT_CONSOLE_PAGE_ID } from './routing.js';

export const sidebarPanelSize = 193;
export const sidebarPushSize = sidebarPanelSize + 32;

export const navItems = [
  { id: DEFAULT_CONSOLE_PAGE_ID, label: '메시지 발송' },
  { id: 'automations', label: '자동화' },
  { id: 'templates', label: '템플릿' },
  { id: 'audience', label: '수신자' },
  { id: 'metrics', label: '발송 현황' },
  { id: 'reservations', label: '예약' },
  { id: 'logs', label: '발송기록' },
  { id: 'settings', label: '설정' },
  { id: 'admin', label: '관리', adminOnly: true },
];

const mockAudienceNames = [
  '김민준',
  '이서연',
  '박지훈',
  '최하윤',
  '정도윤',
  '강서아',
  '조하준',
  '윤지우',
  '장시우',
  '임하린',
];

const mockAudienceStatuses = ['활성', '활성', '활성', '대기', '수신거부'];
const mockAudienceSegments = ['전체 연락처', '제품 업데이트 대상', '라이프사이클 사용자', 'VIP 고객'];

const mockAudienceRecipientRows = Array.from({ length: 100 }, (_, index) => {
  const sequence = index + 1;
  const name = `${mockAudienceNames[index % mockAudienceNames.length]} ${String(sequence).padStart(2, '0')}`;
  const emailName = `recipient${String(sequence).padStart(3, '0')}`;
  const day = (index % 28) + 1;

  return [
    name,
    `010-${String(2000 + index).padStart(4, '0')}-${String(3000 + index).padStart(4, '0')}`,
    `${emailName}@example.com`,
    mockAudienceStatuses[index % mockAudienceStatuses.length],
    mockAudienceSegments[index % mockAudienceSegments.length],
    index === 0 ? '오늘' : index === 1 ? '어제' : `5월 ${day}일`,
  ];
});

export const pageMeta = {
  [DEFAULT_CONSOLE_PAGE_ID]: {
    title: '메시지 발송',
    tabs: ['SMS', '알림톡', '브랜드 메시지'],
    filters: ['최근 15일', '모든 상태', '모든 발신 수단'],
    emptyTitle: '아직 보낸 메시지가 없습니다',
    emptyCopy: '메시지 발송을 시작하면 모든 메시지의 인사이트와 미리보기가 표시됩니다.',
    emptyButton: '문서 보기',
  },
  automations: {
    title: '자동화',
    variant: 'automations',
    tabs: ['자동화', '미발송', 'publ이벤트'],
    action: '자동화 생성',
    tabViews: {
      자동화: {
        filters: [],
        table: {
          variant: 'automations',
          columns: ['이름', '상태', '이벤트', '템플릿'],
        },
      },
      미발송: {
        action: null,
        filters: [],
        table: {
          variant: 'automation-unsent',
          columns: ['이벤트', '채널 코드', '발송 채널', '수신자', '사유', '수신 시각'],
        },
      },
      publ이벤트: {
        action: '이벤트 생성',
        filters: [],
        table: {
          variant: 'publ-events',
          columns: ['이벤트', 'location', '사용중 변수', '자동화'],
        },
      },
    },
  },
  'automations-detail': { title: '자동화 상세' },
  'automations-edit': { title: '자동화 편집' },
  'automations-new': { title: '자동화 생성' },
  'publ-event-detail': { title: 'PUBL 이벤트 상세' },
  'publ-event-new': { title: 'PUBL 이벤트 생성' },
  templates: {
    title: '템플릿',
    tabs: ['SMS', '알림톡', '브랜드 메시지'],
    action: '템플릿 생성',
    emptyTitle: '아직 템플릿이 없습니다',
    emptyCopy: '발송 워크플로우에 사용할 재사용 가능한 메시지 템플릿을 저장하세요.',
    emptyButton: '템플릿 생성',
    emptyStates: {
      SMS: {
        emptyTitle: '아직 SMS 템플릿이 없습니다',
        emptyCopy: 'SMS, LMS, MMS 발송에 반복해서 사용할 문구와 변수를 템플릿으로 관리하세요.',
      },
      알림톡: {
        emptyTitle: '아직 알림톡 템플릿이 없습니다',
        emptyCopy: '승인된 카카오 알림톡 템플릿을 채널별로 확인하고 발송 전에 내용을 점검하세요.',
      },
      '브랜드 메시지': {
        emptyTitle: '아직 브랜드 메시지 템플릿이 없습니다',
        emptyCopy: '브랜드 메시지 이미지, 버튼, 쿠폰 구성을 재사용 가능한 템플릿으로 준비하세요.',
      },
    },
  },
  'templates-detail': { title: '템플릿 상세' },
  'templates-sms-new': { title: 'SMS 템플릿 등록' },
  'templates-alimtalk-new': { title: '템플릿 등록' },
  'templates-brand-new': { title: '브랜드 메시지 템플릿 등록' },
  audience: {
    title: '수신자',
    tabs: ['연락처', '세그먼트'],
    action: '연락처 추가',
    table: {
      columns: ['수신자', '휴대폰', '이메일', '상태', '세그먼트', '업데이트'],
      rows: mockAudienceRecipientRows,
    },
    emptyTitle: '아직 연락처가 없습니다',
    emptyCopy: '목록을 만들려면 구독자를 가져오거나 연락처를 직접 추가하세요.',
    emptyButton: '연락처 추가',
  },
  metrics: { title: '발송 현황' },
  logs: {
    title: '발송기록',
    emptyTitle: '아직 발송기록이 없습니다',
    emptyCopy: 'SMS, LMS, MMS, 알림톡 발송 결과가 여기에 표시됩니다.',
  },
  'log-detail': { title: '발송 묶음 상세' },
  reservations: {
    title: '예약',
    emptyTitle: '아직 예약이 없습니다',
    emptyCopy: '예약된 SMS, LMS, MMS 발송 현황이 여기에 표시됩니다.',
  },
  'reservation-detail': { title: '예약 상세' },
  settings: { title: '설정' },
  'settings-sender-sms-new': { title: '발신번호 추가' },
  'settings-sender-kakao-new': { title: '카카오 채널 추가' },
  admin: { title: '신청 관리' },
  'admin-sender-resource-applications': { title: '신청 관리' },
  docs: {
    title: '브랜드 메시지 콘솔 사용 가이드',
    emptyTitle: '브랜드 메시지 콘솔 사용 가이드',
    emptyCopy: '브랜드 메시지 발송, 조회, 이미지, 템플릿, 080 수신거부, 대체 발송을 확인합니다.',
  },
};
