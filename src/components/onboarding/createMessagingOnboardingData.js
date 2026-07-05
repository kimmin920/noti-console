import {
  BookOpen,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  RadioTower,
  Send,
  Settings,
  ShieldCheck,
} from 'lucide-react';

const codeExamples = [
  {
    value: 'node',
    label: 'Node.js',
    language: 'javascript',
    code: `import { Messaging } from '@messaging/sdk';

const messaging = new Messaging('msg_xxxxxxxxx');

messaging.messages.send({
  channel: 'sms',
  from: 'NOTICE',
  to: '+821012345678',
  text: '첫 메시지 발송 테스트입니다.'
});`,
  },
  {
    value: 'php',
    label: 'PHP',
    language: 'php',
    code: `$messaging = Messaging::client('msg_xxxxxxxxx');

$messaging->messages->send([
  'channel' => 'sms',
  'from' => 'NOTICE',
  'to' => '+821012345678',
  'text' => '첫 메시지 발송 테스트입니다.',
]);`,
  },
  {
    value: 'python',
    label: 'Python',
    language: 'python',
    code: `import messaging

messaging.api_key = 'msg_xxxxxxxxx'

messaging.Messages.send({
  'channel': 'sms',
  'from': 'NOTICE',
  'to': '+821012345678',
  'text': '첫 메시지 발송 테스트입니다.'
})`,
  },
  {
    value: 'ruby',
    label: 'Ruby',
    language: 'ruby',
    code: `messaging = Messaging::Client.new('msg_xxxxxxxxx')

messaging.messages.send({
  channel: 'sms',
  from: 'NOTICE',
  to: '+821012345678',
  text: '첫 메시지 발송 테스트입니다.'
})`,
  },
  {
    value: 'go',
    label: 'Go',
    language: 'go',
    code: `client := messaging.NewClient("msg_xxxxxxxxx")

client.Messages.Send(&messaging.SendMessageRequest{
  Channel: "sms",
  From:    "NOTICE",
  To:      "+821012345678",
  Text:    "첫 메시지 발송 테스트입니다.",
})`,
  },
  {
    value: 'rust',
    label: 'Rust',
    language: 'rust',
    code: `let messaging = Messaging::new("msg_xxxxxxxxx");

messaging.messages.send(SendMessageRequest {
  channel: "sms",
  from: "NOTICE",
  to: "+821012345678",
  text: "첫 메시지 발송 테스트입니다.",
}).await?;`,
  },
  {
    value: 'elixir',
    label: 'Elixir',
    language: 'elixir',
    code: `Messaging.Messages.send(%{
  channel: "sms",
  from: "NOTICE",
  to: "+821012345678",
  text: "첫 메시지 발송 테스트입니다."
})`,
  },
  {
    value: 'java',
    label: 'Java',
    language: 'java',
    code: `Messaging messaging = new Messaging("msg_xxxxxxxxx");

messaging.messages().send(SendMessageRequest.builder()
  .channel("sms")
  .from("NOTICE")
  .to("+821012345678")
  .text("첫 메시지 발송 테스트입니다.")
  .build());`,
  },
  {
    value: 'dotnet',
    label: '.NET',
    language: 'csharp',
    code: `var messaging = new MessagingClient("msg_xxxxxxxxx");

await messaging.MessageSendAsync(new Message {
  Channel = "sms",
  From = "NOTICE",
  To = "+821012345678",
  Text = "첫 메시지 발송 테스트입니다."
});`,
  },
  {
    value: 'curl',
    label: 'cURL',
    language: 'bash',
    code: `curl -X POST https://api.example.com/messages \\
  -H '<authorization header>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "channel": "sms",
    "from": "NOTICE",
    "to": "+821012345678",
    "text": "첫 메시지 발송 테스트입니다."
  }'`,
  },
];

const baseData = {
  selectedChannel: 'sms',
  workspace: {
    detail: '초기 설정 체크리스트',
    initials: 'M',
    label: '워크스페이스 선택',
    name: '메시징 콘솔',
  },
  account: {
    detail: '운영자',
    initials: 'OP',
    name: '콘솔 사용자',
  },
  navGroups: [
    {
      id: 'setup',
      label: '설정',
      items: [
        { id: 'overview', label: '개요', href: '#overview', icon: LayoutDashboard, active: true },
        { id: 'sender', label: '발신 리소스', href: '#sender-resources', icon: RadioTower },
        { id: 'templates', label: '템플릿', href: '#templates', icon: FileText },
        { id: 'send', label: '테스트 발송', href: '#send-test', icon: Send },
      ],
    },
    {
      id: 'operate',
      label: '운영',
      items: [
        { id: 'logs', label: '발송 로그', href: '#logs', icon: MessageSquareText },
        { id: 'settings', label: '설정', href: '#settings', icon: Settings },
      ],
    },
  ],
  utilityItems: [
    { id: 'docs', label: '문서', href: '#docs', icon: BookOpen },
  ],
  header: {
    title: '첫 메시지를 발송해 보세요',
    description: '발신 설정부터 테스트 발송까지, 메시지가 실제로 나가는 흐름을 한 번에 확인해 보세요.',
  },
  channelOptions: [
    {
      id: 'sms',
      value: 'sms',
      actionLabel: '자세히 보기',
      badges: ['기본 발송', '승인 필요'],
      description: 'SMS, LMS, MMS 짧은 문자부터 긴 문자까지 원하는 형태의 문자메시지를 자유롭게 이용할 수 있는 상품',
      eyebrow: '가장 넓은 도달',
      icon: MessageSquareText,
      nextStep: '먼저 발신번호 승인 상태를 확인합니다.',
      requirements: ['발신번호 신청', '소유 확인', '운영자 승인'],
      sendStepDescription: '승인된 발신번호로 테스트 문자를 발송해 실제 수신 흐름을 확인합니다.',
      summary: 'SMS, LMS, MMS 중 필요한 형식으로 첫 테스트 메시지를 보냅니다.',
      summaryTitle: '문자로 시작합니다',
      title: '문자',
    },
    {
      id: 'alimtalk',
      value: 'alimtalk',
      actionLabel: '자세히 보기',
      badges: ['정보성', '템플릿 승인'],
      description: '주문, 결제, 배송 등 정보성 메시지를 스팸 걱정 없이 문자보다 더 저렴하게 보낼 수 있는 상품',
      eyebrow: '정해진 안내',
      icon: FileText,
      nextStep: '카카오 채널과 승인된 알림톡 템플릿을 확인합니다.',
      requirements: ['카카오 채널 등록', '발신 프로필 확인', '알림톡 템플릿 승인'],
      sendStepDescription: '승인된 알림톡 템플릿으로 테스트 발송을 진행해 변수 매핑과 수신 화면을 확인합니다.',
      summary: '정보성 메시지를 알림톡 템플릿으로 테스트 발송합니다.',
      summaryTitle: '알림톡으로 시작합니다',
      title: '알림톡',
    },
    {
      id: 'brand-message',
      value: 'brand-message',
      actionLabel: '자세히 보기',
      badges: ['마케팅', '수신 동의'],
      description: '카카오톡 채널로 고객사 마케팅 수신 동의 회원과 채널 친구 모두에게 광고성 메시지를 발송하는 상품',
      eyebrow: '브랜드 캠페인',
      icon: RadioTower,
      nextStep: '마케팅 수신 동의와 광고성 메시지 필수 설정을 확인합니다.',
      requirements: ['카카오 채널 연결', '마케팅 수신 동의', '광고 표기와 무료 수신거부'],
      sendStepDescription: '브랜드메시지 필수 설정을 확인한 뒤 테스트 발송으로 소재와 버튼 동작을 점검합니다.',
      summary: '마케팅성 메시지를 브랜드메시지 형식으로 테스트 발송합니다.',
      summaryTitle: '브랜드메시지로 시작합니다',
      title: '브랜드메시지',
    },
  ],
  tasks: [
    {
      id: 'choose-channel',
      status: 'current',
      description: '처음 발송할 목적과 준비 상태에 맞춰 채널을 선택하세요. 선택한 채널에 필요한 발신번호, 카카오 채널, 템플릿 설정만 이어서 확인합니다.',
      title: '어떤 메시지로 시작할까요?',
    },
    {
      id: 'send-message',
      description: '선택한 채널에 필요한 설정을 확인한 뒤 테스트 발송을 진행합니다.',
      status: 'locked',
      title: '테스트 메시지 보내기',
    },
  ],
  codeExamples,
  resources: [
    {
      id: 'add-domain',
      badge: '추천',
      description: '카카오, 문자, 이메일 등 실제 발송에 사용할 채널을 연결합니다.',
      disabled: true,
      href: '#add-domain',
      icon: RadioTower,
      actionLabel: '채널 연결하기',
      title: '발신 채널 연결',
    },
    {
      id: 'test-messages',
      description: '템플릿, 변수, 수신자 정보를 실제 발송 전 안전하게 점검합니다.',
      disabled: true,
      href: '#test-messages',
      icon: MessageSquareText,
      actionLabel: '자세히 보기',
      title: '테스트 발송',
    },
    {
      id: 'deliverability',
      description: '성공률과 실패 사유를 확인하고 안정적인 발송 기준을 만듭니다.',
      disabled: true,
      href: '#deliverability',
      icon: ShieldCheck,
      actionLabel: '자세히 보기',
      title: '발송 품질 확인',
    },
  ],
};

export function createMessagingOnboardingData(overrides = {}) {
  return {
    ...baseData,
    ...overrides,
    account: { ...baseData.account, ...overrides.account },
    header: { ...baseData.header, ...overrides.header },
    workspace: { ...baseData.workspace, ...overrides.workspace },
    selectedChannel: overrides.selectedChannel ?? baseData.selectedChannel,
    channelOptions: overrides.channelOptions ?? baseData.channelOptions,
    navGroups: overrides.navGroups ?? baseData.navGroups,
    utilityItems: overrides.utilityItems ?? baseData.utilityItems,
    tasks: overrides.tasks ?? baseData.tasks,
    codeExamples: overrides.codeExamples ?? baseData.codeExamples,
    resources: overrides.resources ?? baseData.resources,
  };
}
