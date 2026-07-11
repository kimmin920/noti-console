export const SMS_SENDER_RESOURCE_TYPE = 'sms_send_no';
export const KAKAO_SENDER_RESOURCE_TYPE = 'kakao_sender_key';

export const PERSONAL_SENDER_EVIDENCE_FILES = [
  {
    helpLines: [
      '통신사에 따라 가입사실확인서, 서비스 이용증명서 등 다른 이름으로 발급될 수 있습니다.',
      '등록하려는 번호의 이용 사실과 가입자 정보가 확인되는 문서를 준비해 주세요.',
      '숨김 처리된 정보가 없어야 하며, 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    ],
    description: '최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    helpTitle: '어떤 문서인가요?',
    id: 'telecom_certificate',
    label: '통신서비스 이용증명원',
  },
  {
    helpLines: [
      '번호 사용에 대한 동의를 확인하는 문서입니다.',
      '번호 명의자와 실제 이용 주체가 다를 때 특히 중요합니다.',
      '서명 또는 날인이 필요한 양식을 사용 중이라면 서명 완료본을 업로드해 주세요.',
    ],
    description: '발신번호 사용에 대한 동의 내용을 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'consent_document',
    label: '이용승낙서',
  },
  {
    helpLines: [
      '개인 번호는 본인 확인을 위해 번호 소유자의 신분증 사본이 필요합니다.',
      '주민등록번호 뒷자리는 반드시 마스킹된 상태여야 합니다.',
      '이름과 생년월일 앞자리 등 필요한 정보만 보이도록 편집한 뒤 제출해 주세요.',
    ],
    description: '번호 소유자의 신분증 사본을 업로드하세요. 주민등록번호 뒷자리는 반드시 가려 주세요.',
    helpTitle: '제출 시 주의사항',
    id: 'id_card_copy',
    label: '신분증 사본',
  },
];
export const COMPANY_SENDER_EVIDENCE_FILES = [
  {
    helpLines: [
      '통신사에 따라 가입사실확인서, 서비스 이용증명서 등 다른 이름으로 발급될 수 있습니다.',
      '등록하려는 번호의 이용 사실과 가입자 정보가 확인되는 문서를 준비해 주세요.',
      '숨김 처리된 정보가 없어야 하며, 최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    ],
    description: '최근 3개월 이내 발급된 서류만 등록할 수 있습니다.',
    helpTitle: '어떤 문서인가요?',
    id: 'telecom_certificate',
    label: '통신서비스 이용증명원',
  },
  {
    helpLines: [
      '번호 사용에 대한 동의를 확인하는 문서입니다.',
      '번호 명의자와 실제 이용 주체가 다를 때 특히 중요합니다.',
      '서명 또는 날인이 필요한 양식을 사용 중이라면 서명 완료본을 업로드해 주세요.',
    ],
    description: '발신번호 사용에 대한 동의 내용을 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'consent_document',
    label: '이용승낙서',
  },
  {
    helpLines: [
      '발신번호 명의 사업자의 정보를 확인하는 문서입니다.',
      '사업자명과 사업자등록번호가 확인되는 사본을 준비해 주세요.',
    ],
    description: '번호 명의자의 사업자등록증을 업로드하세요.',
    helpTitle: '무엇을 확인하나요?',
    id: 'business_registration',
    label: '번호 명의 사업자등록증',
  },
  {
    helpLines: [
      '번호 명의 사업자와 신청 사업자 간의 관계를 확인하는 문서입니다.',
      '계약서, 위임장, 관계 확인 공문처럼 번호 사용 권한을 설명할 수 있는 문서를 준비해 주세요.',
    ],
    description: '번호 명의 사업자와 신청 사업자 간의 관계를 확인할 수 있는 문서를 업로드하세요.',
    helpTitle: '어떤 문서인가요?',
    id: 'relationship_proof',
    label: '사업자와 타사 간 관계 확인 문서',
  },
];
export const ADDITIONAL_SENDER_EVIDENCE_FILE = {
  helpLines: [
    '운영자가 보완을 요청한 추가 자료를 제출할 때 사용합니다.',
    '기존 필수 서류는 유지되며, 필요한 서류만 변경하거나 보완 자료를 더 올릴 수 있습니다.',
  ],
  description: '보완 요청을 받은 추가 자료가 있다면 업로드하세요.',
  helpTitle: '언제 사용하나요?',
  id: 'additional_document',
  label: '기타서류',
};
export const ADMIN_APPLICATION_STATUS_OPTIONS = [
  { label: '검수 대기', value: 'submitted' },
  { label: '전체', value: 'all' },
  { label: '승인됨', value: 'approved' },
  { label: '반려됨', value: 'rejected' },
];
export const EVIDENCE_DOCUMENT_LABELS = {
  telecom_certificate: '통신서비스 이용증명원',
  consent_document: '이용승낙서',
  id_card_copy: '신분증 사본',
  business_registration: '번호 명의 사업자등록증',
  relationship_proof: '사업자와 타사 간 관계 확인 문서',
  additional_document: '추가서류',
};
