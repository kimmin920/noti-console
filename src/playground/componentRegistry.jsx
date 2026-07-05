import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  Bell,
  Braces,
  Check,
  ChevronDown,
  Circle,
  Code2,
  Copy,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CodeGroup,
  DocsCallout,
  DocsCard,
  DocsCardGrid,
  DocsSection,
} from '../components/docs/index.js';
import {
  DomainDetailPage,
  DomainDnsNotice,
  DomainDnsRecordsManualStep,
  DomainDnsRecordsStep,
  DomainsAddPage,
  DomainsPage,
} from '../components/domains/index.js';
import { InspectorSidebar, PageHeader, Toolbar } from '../components/layout/index.js';
import {
  KakaoChannelAddPage,
  SmsSenderNumberAdd,
  smsSenderNumberAddFixtures,
} from '../components/sender-resources/index.js';
import {
  getDeliveryResultToast,
  getStatusCheckingToast,
  getStatusLookupErrorToast,
  getStatusTimeoutToast,
  MESSAGE_STATUS_TOAST_ID,
  showMessageStatusResultToast,
  showMessageStatusSubmitToast,
} from '../features/console/messageSend/statusToast.js';
import { AlimtalkTemplateCreatePage } from '../features/console/alimtalkTemplates/AlimtalkTemplateCreatePage.jsx';
import { AlimtalkTemplateCreatePageNewDesign } from '../features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx';
import {
  AutomationActionList,
  AutomationSendMessageNode,
  AutomationSetVariables,
  AutomationTriggerNode,
  getAutomationActionId,
} from '../features/console/automations/builder/index.js';
import { getAlimtalkSenderProfiles } from '../features/console/messageSend/mappers.js';
import { TemplateCardList } from '../features/console/templates/TemplateCardList.jsx';
import { TemplateListToolbar } from '../features/console/templates/TemplateListToolbar.jsx';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuLabel,
  ActionMenuSeparator,
  ActionMenuTrigger,
  Badge,
  BulkActionBar,
  Button,
  Card,
  CardActions,
  CardCopy,
  CardHeader,
  CardTitle,
  Checkbox,
  CodeBlock,
  CommandPalette,
  ConfirmationDialog,
  CopyButton,
  CopyableSlot,
  DatePickerPresets,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  EmptyState,
  FilterSelect,
  IconButton,
  Kbd,
  AlimtalkSendForm,
  defaultAlimtalkSenderProfiles,
  defaultAlimtalkTemplates,
  EmailSendForm,
  BrandMessageSendForm,
  defaultBrandMessageSenderProfiles,
  defaultBrandMessageSendFormValue,
  defaultBrandMessageTemplates,
  NhnBrandMessagePreview,
  Pagination,
  Panel,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  SearchField,
  SegmentedControl,
  SelectPill,
  InlineEmptyState,
  PropertyRow,
  OverviewFormPanel,
  SectionPanel,
  SplitSection,
  SubscriptionList,
  PreferenceRow,
  SmsSendForm,
  SubscribeTopicSelect,
  TextField,
  TooltipContent,
  TooltipRoot,
  TooltipTrigger,
  useToast,
} from '../components/ui/index.js';
import { BrandButtonEditorSamples } from './BrandButtonEditorSamples.jsx';
import {
  BizgoBrandMessagePreviewPlayground,
  BizgoBrandMessageSendFormPlayground,
  bizgoBrandMessageControls,
  getBizgoBrandMessagePlaygroundProps,
} from './bizgo-brand-message/BizgoBrandMessageHarness.jsx';
import { EmailDataTableV2Demo } from './EmailDataTableV2Demo.jsx';
import { onboardingEntries } from './onboardingEntries.jsx';
import { resendFormPrimitiveEntries } from './resendFormPrimitiveEntries.jsx';

const iconOptions = {
  alert: AlertTriangle,
  bell: Bell,
  none: null,
  plus: Plus,
  more: MoreHorizontal,
  export: ArrowDownToLine,
  code: Code2,
  braces: Braces,
  copy: Copy,
  key: KeyRound,
  search: Search,
  send: Send,
  sparkles: Sparkles,
  trash: Trash2,
};

const dayMs = 24 * 60 * 60 * 1000;

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return new Date(date.getTime() - days * dayMs);
}

function ResendAutomationPreview({ children }) {
  return <div className="playground-resend-automation-preview">{children}</div>;
}

function renderAutomationSendEmailNodeState(state) {
  return (
    <ResendAutomationPreview>
      <AutomationMessageNodePlayground state={state} />
    </ResendAutomationPreview>
  );
}

const automationMessagePlaygroundTemplates = defaultAlimtalkTemplates.map((template, index) => ({
  ...template,
  channel: 'alimtalk',
  id: template.value,
  source: index === 0 ? 'GROUP' : 'SENDER_PROFILE',
  sourceKey: index === 0 ? '2f9e6a06b25c497001400cab5f5f94ca726080b5' : template.ownerKey,
  sourceLabel: index === 0 ? '@비주오' : template.ownerLabel,
  __automationTemplateLookupSenderResourceId: index === 0 ? 'kakao_common_visuo' : 'profile-acme',
  __automationTemplateScopeKeys: [index === 0 ? 'common' : 'sender:profile-acme'],
}));
const automationMessagePlaygroundSenderOptions = defaultAlimtalkSenderProfiles.map((profile) => ({
  ...profile,
  senderResourceId: profile.value,
}));
const automationMessagePlaygroundScopes = [
  {
    label: '모두',
    senderResourceIds: ['kakao_common_visuo', 'profile-acme'],
    type: 'all',
    value: 'all',
  },
  {
    label: '공통 (@비주오 + @publ)',
    senderResourceIds: ['kakao_common_visuo'],
    type: 'common',
    value: 'common',
  },
  {
    label: '@acme 알림톡',
    senderResourceIds: ['profile-acme'],
    type: 'owned',
    value: 'sender:profile-acme',
  },
];
const automationMessagePlaygroundVariableOptions = [
  { alias: 'email', label: 'email' },
  { alias: 'first_name', label: 'first_name' },
  { alias: 'last_name', label: 'last_name' },
  { alias: 'unsubscribed', label: 'unsubscribed' },
  { alias: 'customerName', label: '고객명' },
  { alias: 'productName', label: '상품명' },
  { alias: 'trackingNumber', label: '운송장번호' },
  { alias: 'estimatedArrival', label: '도착예정일' },
  { alias: 'targetPhoneNumber', label: '수신 전화번호' },
];

function AutomationMessageNodePlayground({ state }) {
  const stateTemplate = state === 'preview' || state === 'settings' || state === 'invalid'
    ? automationMessagePlaygroundTemplates[0]
    : null;
  const [selectedTemplate, setSelectedTemplate] = useState(stateTemplate);
  const [variableMapping, setVariableMapping] = useState({});
  const templates = state === 'empty' ? [] : automationMessagePlaygroundTemplates;
  const selectedTemplateForState = stateTemplate ?? selectedTemplate;
  const requiredVariables = selectedTemplateForState?.requiredVariables ?? [];
  const configuration = {
    activeTemplateQuery: {
      error: null,
      isError: false,
      isLoading: state === 'loading',
      isSuccess: state !== 'loading',
      refetch: () => {},
    },
    selectedSender: automationMessagePlaygroundSenderOptions[0],
    selectedTemplate: selectedTemplateForState,
    senderOptions: automationMessagePlaygroundSenderOptions,
    senderResourcesQuery: {
      error: null,
      isError: false,
      isLoading: false,
      isSuccess: true,
      refetch: () => {},
    },
    templateScopes: automationMessagePlaygroundScopes,
    templates,
  };
  const draft = {
    sendChannel: 'alimtalk',
    senderResourceId: 'profile-acme',
    templateCode: selectedTemplateForState?.templateCode ?? '',
    templateSource: selectedTemplateForState?.source ?? '',
  };
  const mappingPolicy = {
    optionalTemplateVariables: [],
    requiredTemplateVariables: requiredVariables,
    selectedEvent: {
      displayName: '주문 배송 이벤트',
      eventKey: 'order.delivery',
    },
    variableMapping,
    variableOptions: automationMessagePlaygroundVariableOptions,
  };

  return (
    <AutomationSendMessageNode
      configuration={configuration}
      draft={draft}
      family="alimtalk"
      mappingPolicy={mappingPolicy}
      onChangeSendAction={() => setSelectedTemplate(null)}
      onSenderResourceChange={() => {}}
      onSmsChannelChange={() => {}}
      onTemplateSelect={setSelectedTemplate}
      onVariableMappingChange={(key, alias) => {
        setVariableMapping((current) => ({ ...current, [key]: alias }));
      }}
      templateSearchPlaceholder="알림톡 템플릿 검색..."
      title="카카오 알림톡 보내기"
      validation={state === 'invalid' ? {
        sender: '',
        template: selectedTemplateForState ? '' : '템플릿을 선택하세요.',
        variables: Object.fromEntries(requiredVariables.slice(0, 1).map((key) => [
          key,
          '필수 템플릿 변수에 이벤트 alias를 매핑하세요.',
        ])),
      } : {}}
    />
  );
}

function AutomationSetVariablesPlayground({ state }) {
  const [variableMapping, setVariableMapping] = useState({});
  const isEmpty = state === 'empty';
  const requiredTemplateVariables = isEmpty ? [] : ['name'];
  const optionalTemplateVariables = isEmpty ? [] : ['coupon_code'];

  return (
    <ResendAutomationPreview>
      <div className="playground-automation-set-variables-panel">
        <AutomationSetVariables
          onVariableMappingChange={(key, alias) => {
            setVariableMapping((current) => ({ ...current, [key]: alias }));
          }}
          optionalTemplateVariables={optionalTemplateVariables}
          requiredTemplateVariables={requiredTemplateVariables}
          selectedEvent={{
            displayName: '주문 배송 이벤트',
            eventKey: 'order.delivery',
          }}
          validation={state === 'invalid' ? {
            name: '필수 템플릿 변수에 이벤트 alias를 매핑하세요.',
          } : {}}
          variableMapping={variableMapping}
          variableOptions={automationMessagePlaygroundVariableOptions}
        />
      </div>
    </ResendAutomationPreview>
  );
}

const templateCardPreviewItems = Object.freeze({
  SMS: [
    createTemplateCardPreviewItem('SMS_ORDER_READY', '주문 접수 안내', 'SMS', '1544-6859', '사용', 'green'),
    createTemplateCardPreviewItem('SMS_DELIVERY_START', '배송 시작 안내', 'SMS', '1544-6859', '사용', 'green'),
    createTemplateCardPreviewItem('SMS_PAYMENT_FAILED', '결제 실패 안내', 'SMS', '1544-6859', '미사용', 'neutral'),
  ],
  알림톡: [
    createTemplateCardPreviewItem('ORDER_01', '주문완료1', '알림톡', '@비주오', '승인', 'green', 'GROUP'),
    createTemplateCardPreviewItem('AT_REVIEW_WAITING', '리뷰 요청 알림톡', '알림톡', '@publ', '검수중', 'blue', 'GROUP'),
    createTemplateCardPreviewItem('AT_COUPON_REJECTED', '쿠폰 안내 알림톡', '알림톡', '@store', '반려', 'red', 'SENDER_PROFILE'),
  ],
  '브랜드 메시지': [
    createTemplateCardPreviewItem('BM_CAROUSEL_COMMERCE', '브랜드 특가 캐러셀', '브랜드 메시지', '@store', '승인', 'green', '', {
      carousel: {
        head: {
          content: '이번 주 브랜드 특가를 확인하세요.',
          header: '기획전',
          imageUrl: 'https://mud-kage.kakao.com/dn/dapKda/dJMcaaTfUHl/LiblYS8xFsDc6xBQUmaDtk/img_l.jpg',
        },
        list: [
          {
            commerce: {
              discountPrice: '29000',
              regularPrice: '42000',
              title: '라이트 크로스백',
            },
            imageUrl: 'https://mud-kage.kakao.com/dn/bLxa7P/dJMcahY7l5f/rtl8gN6VZwYMKhbOamun7K/img_l.jpg',
          },
        ],
      },
      chatBubbleType: 'CAROUSEL_COMMERCE',
    }),
    createTemplateCardPreviewItem('BM_WIDE_LIST', '주간 신상품 리스트', '브랜드 메시지', '@store', '승인', 'green', '', {
      chatBubbleType: 'WIDE_ITEM_LIST',
      header: '이번 주 신상품',
      item: {
        list: [
          { description: '가볍게 입는 바람막이', title: '아우터' },
          { description: '재입고된 인기 컬러', title: '니트' },
          { description: '출근용 데일리 백', title: '가방' },
        ],
      },
    }),
    createTemplateCardPreviewItem('BM_COMMERCE', '브랜드 특가', '브랜드 메시지', '@store', '반려', 'red', '', {
      chatBubbleType: 'COMMERCE',
      commerce: {
        discountPrice: '39000',
        regularPrice: '59000',
        title: '시그니처 백',
      },
    }),
  ],
});

const kakaoTemplatePreviewSenderResources = Object.freeze({
  resources: [
    {
      resource: {
        displayName: '@비주오',
        id: 'preview_common_visuo',
        status: 'active',
        type: 'kakao_sender_key',
        value: '2f9e6a06b25c497001400cab5f5f94ca726080b5',
      },
    },
    {
      resource: {
        displayName: '@publ',
        id: 'preview_common_publ',
        status: 'active',
        type: 'kakao_sender_key',
        value: '954b4486e661a019badabd5ebe15d7ef7e27cb31',
      },
    },
    {
      role: 'sender',
      status: 'active',
      resource: {
        displayName: '@store',
        id: 'preview_sender',
        status: 'active',
        type: 'kakao_sender_key',
        value: 'sender-key-store',
      },
    },
  ],
});

function createTemplateCardPreviewItem(code, name, channel, ownerLabel, status, statusTone, source = '', overrides = {}) {
  const codeMetaLabel = source === 'GROUP' ? '공통' : ownerLabel;

  return {
    body: `${name} 본문입니다.\n#{customerName}님에게 발송되는 ${channel} 템플릿 예시입니다.`,
    buttons: channel === '알림톡'
      ? [{ name: '자세히 보기', ordering: 1, type: 'WL' }]
      : [],
    channel,
    code,
    codeMetaLabel,
    id: `${channel}:${code}`,
    imageUrl: null,
    name,
    ownerLabel,
    quickReplies: [],
    source,
    status,
    statusTone,
    ...overrides,
  };
}

function noop() {
  return undefined;
}

function getTemplatePreviewSenderResourceOptions(channel) {
  if (channel === 'SMS') {
    return [{ label: '1544-6859', value: 'preview_sender' }];
  }

  return getAlimtalkSenderProfiles(kakaoTemplatePreviewSenderResources).map((option) => ({
    label: option.label,
    value: option.value,
  }));
}

function renderIcon(name, size = 15) {
  const Icon = iconOptions[name];
  return Icon ? <Icon size={size} /> : null;
}

function AccordionPreview({ defaultOpen, secondary }) {
  return (
    <Accordion defaultValue={defaultOpen ? 'sending' : undefined}>
      <AccordionItem value="sending">
        <AccordionTrigger>Sending</AccordionTrigger>
        <AccordionContent>
          <a href="#emails">Emails</a>
          <a href="#batch">Batch sending</a>
        </AccordionContent>
      </AccordionItem>
      {secondary ? (
        <AccordionItem value="webhooks">
          <AccordionTrigger>Webhooks</AccordionTrigger>
          <AccordionContent>
            <a href="#events">Event types</a>
            <a href="#verify">Verify requests</a>
          </AccordionContent>
        </AccordionItem>
      ) : null}
    </Accordion>
  );
}

function ActionMenuPreview({ align, destructive, label }) {
  const { showToast } = useToast();

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <Button>
          {label}
          <ChevronDown size={15} />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent align={align}>
        <ActionMenuLabel>Actions</ActionMenuLabel>
        <ActionMenuItem
          description="Create a copy with the same settings."
          leadingVisual={<Copy size={16} />}
          onSelect={() => showToast({ title: 'Duplicated', variant: 'success' })}
        >
          Duplicate
        </ActionMenuItem>
        <ActionMenuItem
          leadingVisual={<KeyRound size={16} />}
          onSelect={() => showToast({ title: 'API key copied', variant: 'success' })}
          trailingVisual={<Kbd>C</Kbd>}
        >
          Copy API key
        </ActionMenuItem>
        <ActionMenuSeparator />
        <ActionMenuItem
          leadingVisual={<Trash2 size={16} />}
          onSelect={() => showToast({ title: destructive ? 'Deleted' : 'Delete disabled', variant: destructive ? 'critical' : 'default' })}
          variant={destructive ? 'danger' : 'default'}
        >
          Delete
        </ActionMenuItem>
      </ActionMenuContent>
    </ActionMenu>
  );
}

function PopoverPreview({ side, title }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button>
          Open popover
          <ChevronDown size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={title} side={side}>
        <div className="popover-heading">
          <strong>{title}</strong>
          <p>Use popovers for lightweight contextual help that follows the trigger in the DOM.</p>
        </div>
        <div className="popover-actions">
          <PopoverClose asChild>
            <Button variant="primary">Got it</Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommandPalettePreview({ title }) {
  const { showToast } = useToast();
  const commands = [
    {
      description: 'Open the message sending surface.',
      icon: Send,
      id: 'send-message',
      label: 'Message send',
      onSelect: () => showToast({ title: 'Message send selected', variant: 'success' }),
      shortcut: 'S',
    },
    {
      description: 'Review API keys and permissions.',
      icon: KeyRound,
      id: 'api-keys',
      label: 'API keys',
      onSelect: () => showToast({ title: 'API keys selected', variant: 'success' }),
      shortcut: 'K',
    },
    {
      description: 'Open product documentation.',
      icon: Braces,
      id: 'docs',
      label: 'Docs',
      onSelect: () => showToast({ title: 'Docs selected', variant: 'success' }),
      shortcut: 'D',
    },
  ];

  return <CommandPalette commands={commands} title={title} />;
}

function EmailSendFormPreview({ optionalFields, recipient, subject }) {
  const defaultValue = {
    body: '',
    previewText: optionalFields ? '수신함 목록에 표시되는 짧은 미리보기입니다.' : '',
    recipient,
    replyTo: optionalFields ? 'replies@example.com' : '',
    scheduledAt: optionalFields ? '2026-05-29T00:00:00.000Z' : '',
    subject,
    topic: 'product-updates',
  };

  return (
    <EmailSendForm
      defaultValue={defaultValue}
      key={`${optionalFields}-${recipient}-${subject}`}
    />
  );
}

function SmsSendFormPreview({ body, hasImage, isAdvertisement, recipient }) {
  const defaultValue = {
    body,
    imageName: hasImage ? 'campaign-image.jpg' : '',
    isAdvertisement,
    recipient,
  };

  return (
    <SmsSendForm
      defaultValue={defaultValue}
      key={`${body}-${hasImage}-${isAdvertisement}-${recipient}`}
    />
  );
}

const brandPreviewChatBubbleTypeOptions = [
  'TEXT',
  'IMAGE',
  'WIDE',
  'WIDE_ITEM_LIST',
  'PREMIUM_VIDEO',
  'COMMERCE',
  'CAROUSEL_FEED',
  'CAROUSEL_COMMERCE',
];

function getBrandPreviewRichTypeData(chatBubbleType) {
  if (chatBubbleType === 'WIDE_ITEM_LIST') {
    return {
      item: {
        listItems: [
          { description: '가볍게 입는 바람막이', imageTone: 'sage', title: '아우터' },
          { description: '재입고된 인기 컬러', imageTone: 'rose', title: '니트' },
          { description: '출근용 데일리 백', imageTone: 'sand', title: '가방' },
        ],
      },
    };
  }

  if (chatBubbleType === 'PREMIUM_VIDEO') {
    return {
      video: {
        title: '시즌 필름',
      },
    };
  }

  if (chatBubbleType === 'COMMERCE') {
    return {
      commerce: {
        discountPrice: '39,000원',
        imageTone: 'sand',
        price: '59,000원',
        title: '브랜드 시그니처 백',
      },
    };
  }

  if (chatBubbleType === 'CAROUSEL_FEED') {
    return {
      carousel: {
        items: [
          { description: '가볍게 걸치는 데일리 셋업', imageTone: 'sage', title: '봄 셋업' },
          { description: '주말 외출을 위한 와이드 팬츠', imageTone: 'blue', title: '와이드 팬츠' },
          { description: '이번 주 베스트 컬러만 모았습니다', imageTone: 'rose', title: '컬러 니트' },
        ],
      },
    };
  }

  if (chatBubbleType === 'CAROUSEL_COMMERCE') {
    return {
      carousel: {
        items: [
          { discountPrice: '39,000원', imageTone: 'sand', price: '59,000원', title: '시그니처 백' },
          { discountPrice: '29,000원', imageTone: 'blue', price: '42,000원', title: '라이트 크로스백' },
        ],
      },
    };
  }

  if (chatBubbleType === 'IMAGE' || chatBubbleType === 'WIDE') {
    return {
      image: {
        imageUrl: 'sample:blue',
      },
    };
  }

  return {};
}

function getBrandPreviewTemplate(values) {
  const templateCode = `brand-preview-${values.chatBubbleType.toLowerCase()}`;

  return {
    buttons: [{ name: '자세히 보기', ordering: 1, type: 'WL' }],
    chatBubbleType: values.chatBubbleType,
    content: values.content,
    label: `${values.chatBubbleType} 샘플`,
    senderProfileId: 'brand-profile-acme',
    templateCode,
    templateName: `${values.chatBubbleType} 샘플`,
    value: templateCode,
    ...getBrandPreviewRichTypeData(values.chatBubbleType),
  };
}

function getNhnBrandPreviewDraft(values) {
  const richTypeData = getBrandPreviewRichTypeData(values.chatBubbleType);

  return {
    additionalContent: '',
    adult: false,
    buttons: [{ name: '자세히 보기', ordering: 1, type: 'WL' }],
    carousel: richTypeData.carousel ?? null,
    chatBubbleType: values.chatBubbleType,
    commerce: richTypeData.commerce ?? null,
    content: values.content,
    coupon: values.coupon ? {
      amount: '5000',
      description: '오늘만 사용 가능',
      linkMo: 'https://example.com/coupon',
      type: 'AMOUNT',
    } : null,
    header: '',
    image: richTypeData.image ?? null,
    imageParameters: {},
    item: richTypeData.item ?? null,
    mode: values.mode,
    pushAlarm: true,
    recipient: [],
    resellerCode: '',
    scheduledAt: '',
    senderProfileId: 'brand-profile-acme',
    statsId: '',
    targeting: '',
    templateCode: values.mode === 'template' ? getBrandPreviewTemplate(values).templateCode : '',
    templateParameter: {},
    unsubscribeAuthNo: '',
    unsubscribeNo: '',
    video: richTypeData.video ?? null,
    videoParameter: null,
  };
}

function getNhnBrandPreviewProps(values) {
  return {
    templates: [getBrandPreviewTemplate(values)],
    value: getNhnBrandPreviewDraft(values),
  };
}

function TooltipPreview({ content, icon, side }) {
  return (
    <div className="tooltip-root">
      <TooltipRoot defaultOpen>
        <TooltipTrigger asChild>
          <IconButton icon={iconOptions[icon]} label={content} title="" />
        </TooltipTrigger>
        <TooltipContent side={side}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </div>
  );
}

function DocsCalloutPreview({ title, variant }) {
  return (
    <div className="docs-shell docs-light playground-docs-preview">
      <section className="docs-mdx-content">
        <DocsCallout title={title} variant={variant}>
          <p>Use callouts for Resend docs notes, tips, warnings, and important implementation details.</p>
        </DocsCallout>
      </section>
    </div>
  );
}

function DocsCardPreview({ count }) {
  const cards = [
    ['Webhooks', 'Review endpoint status and event subscriptions.', '/webhooks'],
    ['Logs', 'Inspect request and delivery activity.', '/logs'],
    ['API keys', 'Create and rotate API credentials.', '/api-keys'],
  ];

  return (
    <div className="docs-shell docs-light playground-docs-preview">
      <section className="docs-mdx-content">
        <DocsCardGrid>
          {cards.slice(0, count).map(([title, copy, href]) => (
            <DocsCard href={href} key={title} meta="Dashboard" title={title}>
              {copy}
            </DocsCard>
          ))}
        </DocsCardGrid>
      </section>
    </div>
  );
}

function CodeGroupPreview({ defaultValue }) {
  return (
    <div className="docs-shell docs-dark playground-docs-preview">
      <section className="docs-mdx-content">
        <CodeGroup
          defaultValue={defaultValue}
          items={[
            {
              code: 'curl -X POST https://api.resend.com/emails',
              label: 'cURL',
              language: 'bash',
              value: 'curl',
            },
            {
              code: 'await resend.emails.send({ subject: "Hello" });',
              label: 'Node.js',
              language: 'javascript',
              value: 'node',
            },
          ]}
        />
      </section>
    </div>
  );
}

const toastAppearanceSamples = [
  { appearance: 'green', title: 'Team avatar updated.', description: 'The image is now visible on your team.' },
  { appearance: 'red', title: 'Upload failed.', description: 'The selected file is larger than the limit.' },
  { appearance: 'yellow', title: 'Usage limit warning.', description: 'You are close to the monthly quota.' },
  { appearance: 'gray', title: 'No changes to save.', description: 'The current settings are already up to date.' },
];

const messageSendToastCases = [
  {
    group: '발송 상태',
    items: [
      { id: 'submitting', label: '전송 중', run: ({ channelLabel, showToast }) => showMessageStatusSubmitToast(showToast, channelLabel) },
      { id: 'checking', label: '상태 확인 중', run: ({ channelLabel, showToast }) => showToast(getStatusCheckingToast(channelLabel)) },
      { id: 'success', label: '전체 성공', run: ({ channelLabel, showToast }) => showToast(getDeliveryResultToast(channelLabel, getMessageSendToastLogs(channelLabel, 'success'))) },
      { id: 'failed', label: '전체 실패', run: ({ channelLabel, showToast }) => showToast(getDeliveryResultToast(channelLabel, getMessageSendToastLogs(channelLabel, 'failed'))) },
      { id: 'mixed', label: '일부 실패', run: ({ channelLabel, showToast }) => showToast(getDeliveryResultToast(channelLabel, getMessageSendToastLogs(channelLabel, 'mixed'))) },
      { id: 'pending-log', label: '처리 중 로그', run: ({ channelLabel, showToast }) => showToast(getDeliveryResultToast(channelLabel, getMessageSendToastLogs(channelLabel, 'pending'))) },
      { id: 'timeout', label: '30초 미확인', run: ({ channelLabel, showToast }) => showToast(getStatusTimeoutToast(channelLabel)) },
      { id: 'lookup-error', label: '상태 조회 실패', run: ({ channelLabel, showToast }) => showToast(getStatusLookupErrorToast(channelLabel)) },
    ],
  },
  {
    group: '제공사 응답',
    items: [
      {
        id: 'provider-rejected',
        label: '제공사 거절',
        run: ({ channelLabel, showToast }) => showMessageStatusResultToast({
          channelLabel,
          result: {
            error: { message: 'NHN 발송 정책으로 요청이 거절되었습니다.' },
            state: 'rejected_by_provider',
          },
          showToast,
        }),
      },
      {
        id: 'accepted-no-lookup',
        label: '접수 / 조회 키 없음',
        run: ({ channelLabel, showToast }) => showMessageStatusResultToast({
          channelLabel,
          result: {
            recipientCount: 3,
            state: 'accepted_by_provider',
          },
          showToast,
        }),
      },
      {
        id: 'unknown-no-lookup',
        label: '불확실 / 조회 키 없음',
        run: ({ channelLabel, showToast }) => showMessageStatusResultToast({
          channelLabel,
          result: {
            state: 'unknown_after_provider_call',
          },
          showToast,
        }),
      },
    ],
  },
  {
    group: '발송 요청 오류',
    items: [
      { id: 'validation-error', label: '입력값 오류', run: ({ showToast }) => showToast({ description: '수신자를 1명 이상 선택해 주세요.', title: '수신자 선택 필요', variant: 'critical' }) },
      { id: 'login-required', label: '로그인 필요', run: ({ showToast }) => showToast({ description: 'Authentication is required.', title: '로그인 필요', variant: 'default' }) },
      { id: 'permission-required', label: '권한 필요', run: ({ showToast }) => showToast({ description: '발송 권한이 없습니다.', title: '발송 권한 필요', variant: 'critical' }) },
      { id: 'send-failed', label: '발송 API 실패', run: ({ channelLabel, showToast }) => showToast({ description: '요청을 처리할 수 없습니다.', id: MESSAGE_STATUS_TOAST_ID, title: `${channelLabel} 발송 실패`, variant: 'critical' }) },
    ],
  },
];

function ToastPreview({ appearance, description, messageChannel, title }) {
  const { showToast } = useToast();
  const channelLabel = messageChannel === '알림톡' ? '알림톡' : 'SMS';

  function runSuccessFlowDemo() {
    showMessageStatusSubmitToast(showToast, channelLabel);
    window.setTimeout(() => showToast(getStatusCheckingToast(channelLabel)), 800);
    window.setTimeout(() => {
      showToast(getDeliveryResultToast(channelLabel, getMessageSendToastLogs(channelLabel, 'success')));
    }, 1600);
  }

  return (
    <div className="playground-toast-preview">
      <section className="playground-toast-panel">
        <div className="playground-toast-panel-header">
          <div>
            <p className="playground-eyebrow">primitive</p>
            <h4>Generic toast</h4>
          </div>
        </div>
        <div className="playground-inline-actions">
          <Button
            onClick={() => showToast({
              appearance,
              description,
              title,
            })}
            variant="primary"
          >
            <Bell size={15} />
            Show toast
          </Button>
          <Button
            onClick={() => {
              toastAppearanceSamples.forEach((sample) => {
                showToast({ ...sample, duration: 7000 });
              });
            }}
            variant="secondary"
          >
            Show all colors
          </Button>
        </div>
      </section>

      <section className="playground-toast-panel">
        <div className="playground-toast-panel-header">
          <div>
            <p className="playground-eyebrow">message send</p>
            <h4>{channelLabel} toast cases</h4>
          </div>
          <Button onClick={runSuccessFlowDemo} variant="secondary">성공 흐름 데모</Button>
        </div>
        <div className="playground-toast-case-groups">
          {messageSendToastCases.map((group) => (
            <div className="playground-toast-case-group" key={group.group}>
              <p>{group.group}</p>
              <div className="playground-toast-case-grid">
                {group.items.map((item) => (
                  <Button
                    key={item.id}
                    onClick={() => item.run({ channelLabel, showToast })}
                    variant="secondary"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="playground-muted">
          상태 조회 API는 호출하지 않고 실제 발송 화면에서 쓰는 토스트 결과만 재생합니다.
        </p>
      </section>
    </div>
  );
}

function getMessageSendToastLogs(channelLabel, state) {
  const channel = channelLabel === '알림톡' ? 'alimtalk' : 'sms';
  const successLog = channel === 'alimtalk'
    ? { channel, resultCode: 'MRC01', status: 'COMPLETED' }
    : { channel, resultCode: 1000, status: 3 };
  const failedLog = channel === 'alimtalk'
    ? { channel, resultCode: 'MRC99', resultMessage: '알림톡 수신 실패', status: 'FAILED' }
    : { channel, resultCode: 2001, resultMessage: '수신번호 형식 오류', status: 4 };
  const pendingLog = channel === 'alimtalk'
    ? { channel, resultCode: '', status: 'PROCESSING' }
    : { channel, resultCode: '', status: 1 };

  if (state === 'success') {
    return [successLog, { ...successLog }];
  }

  if (state === 'failed') {
    return [failedLog];
  }

  if (state === 'mixed') {
    return [successLog, failedLog, pendingLog];
  }

  return [pendingLog];
}

function DialogPreview({ description, size, title }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          Open dialog
          <ChevronDown size={15} />
        </Button>
      </DialogTrigger>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="playground-muted">
            Dialog content stays focused until the user cancels, confirms, presses Escape, or clicks the backdrop.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="primary">Save changes</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmationDialogPreview({ confirmLabel, description, destructive, title }) {
  const { showToast } = useToast();

  return (
    <ConfirmationDialog
      confirmLabel={confirmLabel}
      description={description}
      destructive={destructive}
      onConfirm={() => showToast({
        title: `${confirmLabel} confirmed`,
        variant: destructive ? 'critical' : 'success',
      })}
      title={title}
    >
      <Button variant={destructive ? 'danger' : 'primary'}>
        {destructive ? <Trash2 size={15} /> : null}
        {confirmLabel}
      </Button>
    </ConfirmationDialog>
  );
}

function CheckboxPreview({ caption, checked, disabled, indeterminate, label }) {
  return (
    <Checkbox
      caption={caption}
      defaultChecked={checked}
      disabled={disabled}
      indeterminate={indeterminate}
      key={`${checked}-${disabled}-${indeterminate}-${label}-${caption}`}
      label={label}
    />
  );
}

function BulkActionBarPreview({ count, label }) {
  const { showToast } = useToast();

  return (
    <>
      <p className="playground-muted">Use the fixed bottom bar for selected table rows and bulk actions.</p>
      <BulkActionBar count={Number(count)} label={label}>
        <Button onClick={() => showToast({ title: 'Bulk action applied', variant: 'success' })}>
          Disable
        </Button>
        <Button
          onClick={() => showToast({ title: 'Bulk delete queued', variant: 'critical' })}
          variant="danger"
        >
          <Trash2 size={15} />
          Delete
        </Button>
      </BulkActionBar>
    </>
  );
}

function SectionPanelPreview({ disabled, title }) {
  return (
    <SectionPanel
      description="Invoices will be sent to the following email address."
      footer={<Button disabled={disabled} variant="primary">Save</Button>}
      title={title}
    >
      <TextField.Root>
        <TextField.Input
          aria-label="Billing email"
          defaultValue="billing@example.com"
          placeholder="you@example.com"
          type="email"
        />
      </TextField.Root>
    </SectionPanel>
  );
}

function OverviewFormPanelPreview({ avatarHelpText, nameValue, saveDisabled }) {
  const [teamName, setTeamName] = useState(nameValue);
  const [avatarSrc, setAvatarSrc] = useState('/settings-team-avatar.jpeg');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const { showToast } = useToast();

  function handleAvatarFileChange(file) {
    setAvatarUploading(true);

    window.setTimeout(() => {
      setAvatarSrc('/settings-team-avatar.jpeg');
      setAvatarUploading(false);
      showToast({
        appearance: 'green',
        description: `${file.name || 'Image'} uploaded successfully.`,
        title: 'Team avatar updated.',
      });
    }, 900);
  }

  return (
    <OverviewFormPanel
      avatarAlt="Team avatar"
      avatarFallback="V"
      avatarHelpText={avatarHelpText}
      avatarSrc={avatarSrc}
      avatarUploading={avatarUploading}
      nameValue={teamName}
      onAvatarFileChange={handleAvatarFileChange}
      onAvatarRemove={() => {
        setAvatarSrc('');
        showToast({ appearance: 'green', title: 'Team avatar has been removed.' });
      }}
      onNameChange={setTeamName}
      onSubmit={() => showToast({ appearance: 'green', title: 'Overview saved' })}
      saveDisabled={saveDisabled}
    />
  );
}

function SplitSectionPreview({ disabled, rows, title }) {
  const labels = rows === 'marketing'
    ? ['연락처 한도', '세그먼트 한도', '캠페인 한도']
    : ['월간 한도', '일일 한도'];

  return (
    <SplitSection
      action={<Button variant={disabled ? 'secondary' : 'primary'}>업그레이드</Button>}
      copy="제품 콘솔 설정에서 반복되는 설명 영역과 quota 행을 하나의 section으로 묶습니다."
      disabled={disabled}
      tableLabel="무료"
      title={title}
    >
      {labels.map((label, index) => (
        <PropertyRow
          icon={<Circle size={18} />}
          key={label}
          label={label}
          trailing={<ChevronDown size={15} />}
          value={index === labels.length - 1 && disabled ? '무제한' : '0 / 3,000'}
        />
      ))}
    </SplitSection>
  );
}

function PropertyRowPreview({ detail, value }) {
  return (
    <PropertyRow
      detail={detail}
      icon={<Circle size={18} />}
      label="프로덕션 발신번호"
      trailing={<Badge tone="green">기본</Badge>}
      value={value}
    />
  );
}

function SubscriptionListPreview({ plan }) {
  const isPaid = plan === 'paid';

  return (
    <SubscriptionList
      action={<Button variant="primary">Upgrade</Button>}
      items={[
        {
          action: <IconButton icon={MoreHorizontal} label="Transactional subscription actions" />,
          cadence: isPaid ? '/ mo' : '/ mo',
          id: 'transactional',
          name: 'Transactional',
          price: isPaid ? '$20' : '$0',
          quota: isPaid ? '50,000 emails' : '3,000 emails',
        },
        {
          action: <IconButton icon={MoreHorizontal} label="Marketing subscription actions" />,
          cadence: '/ mo',
          id: 'marketing',
          name: 'Marketing',
          price: isPaid ? '$10' : '$0',
          quota: isPaid ? '10,000 contacts' : '1,000 contacts',
        },
      ]}
    />
  );
}

function InlineEmptyStatePreview({ action, title }) {
  return (
    <SectionPanel
      footer={action ? <Button variant="primary">{action}</Button> : null}
      title="Payment methods"
    >
      <InlineEmptyState
        copy="Upgrade to a paid plan to add a new one."
        title={title}
      />
    </SectionPanel>
  );
}

function PreferenceRowPreview({ checked, disabled, title }) {
  const [enabled, setEnabled] = useState(Boolean(checked));

  return (
    <SectionPanel title="Pay-as-you-go">
      <PreferenceRow
        checked={enabled}
        copy="Continue sending transactional messages beyond your quota and charge each additional bucket."
        disabled={disabled}
        id="playground-preference-row"
        onCheckedChange={setEnabled}
        price="$1.00 / per 1,000 messages"
        title={title}
      />
    </SectionPanel>
  );
}

const sampleDomainRows = [
  {
    id: 'resend.dev',
    created: 'Jun 3, 2026',
    name: 'resend.dev',
    region: 'US East',
    status: 'Verified',
  },
  {
    id: 'example.com',
    created: 'Jun 2, 2026',
    name: 'example.com',
    region: 'Europe',
    status: 'Pending',
  },
];

function DomainsPagePreview({ state }) {
  return (
    <DomainsPage
      domains={state === 'filled' ? sampleDomainRows : []}
      isLoading={state === 'loading'}
    />
  );
}

function DomainsAddPagePreview({ state }) {
  if (state === 'created') {
    return (
      <DomainsAddPage
        initialCreatedDomain={{
          name: 'updates.example.com',
          regionId: 'ap-northeast-1',
        }}
      />
    );
  }

  if (state === 'dns-locked') {
    return <DomainDnsRecordsStep />;
  }

  if (state === 'dns-manual') {
    return <DomainDnsRecordsManualStep domainName="updates.example.com" />;
  }

  return <DomainsAddPage defaultAdvancedOpen={state === 'advanced'} />;
}

function DomainDetailPagePreview() {
  return (
    <div className="playground-domain-detail-preview">
      <DomainDetailPage />
    </div>
  );
}

function DomainDnsNoticePreview() {
  return (
    <div className="playground-domain-dns-notice-preview">
      <DomainDnsNotice />
    </div>
  );
}

function KakaoChannelAddPagePreview({ state }) {
  return <KakaoChannelAddPage initialStatus={state} key={state} />;
}

function SmsSenderNumberAddPreview({ state }) {
  const fixture = smsSenderNumberAddFixtures[state] ?? smsSenderNumberAddFixtures.default;

  return (
    <SmsSenderNumberAdd
      key={state}
      onBack={noop}
      onSubmit={noop}
      {...fixture}
    />
  );
}

function keepAlimtalkTemplatePreviewRoute() {
  window.history.replaceState(null, '', '/playground/ui/alimtalk-template-create-page');
}

function AlimtalkTemplateCreatePagePreview() {
  return <AlimtalkTemplateCreatePage onBack={keepAlimtalkTemplatePreviewRoute} />;
}

function keepAlimtalkTemplateNewDesignPreviewRoute() {
  window.history.replaceState(null, '', '/playground/ui/alimtalk-template-create-page-new-design');
}

function AlimtalkTemplateCreatePageNewDesignPreview() {
  return <AlimtalkTemplateCreatePageNewDesign onBack={keepAlimtalkTemplateNewDesignPreviewRoute} />;
}

function TemplateCardListPreview({ channel, state }) {
  const [searchValue, setSearchValue] = useState('');
  const previewItems = templateCardPreviewItems[channel] ?? templateCardPreviewItems.SMS;
  const isLoading = state === 'loading';
  const templates = state === 'empty' || isLoading
    ? []
    : previewItems.slice(0, state === 'two' ? 2 : previewItems.length);
  const isAlimtalk = channel === '알림톡';
  const senderResourceOptions = getTemplatePreviewSenderResourceOptions(channel);

  return (
    <div className="playground-template-card-list">
      <TemplateListToolbar
        onSearchChange={setSearchValue}
        onSenderResourceChange={noop}
        onStatusChange={noop}
        searchValue={searchValue}
        senderResourceOptions={senderResourceOptions}
        senderResourceValue={senderResourceOptions[0]?.value ?? ''}
        showStatusFilter={isAlimtalk}
        statusOptions={[
          { label: '승인', value: 'TSC03', tone: 'green' },
          { label: '검수중', value: 'TSC02', tone: 'blue' },
          { label: '반려', value: 'TSC04', tone: 'red' },
          { label: '요청', value: 'TSC01', tone: 'yellow' },
        ]}
        statusValue="TSC03"
      />
      <TemplateCardList
        activeTab={channel}
        emptyCopy={`${channel} 템플릿이 없습니다.`}
        emptyTitle={`${channel} 템플릿 없음`}
        isLoading={isLoading}
        templates={templates}
      />
    </div>
  );
}

function NhnBrandMessageSendFormPlayground() {
  const [variablePanelRoot, setVariablePanelRoot] = useState(null);
  const [carouselPreviewTarget, setCarouselPreviewTarget] = useState(null);
  const [draft, setDraft] = useState(() => ({
    ...defaultBrandMessageSendFormValue,
    carousel: {
      list: [
        {
          buttons: [{ id: 'playground-card-1-button', linkMo: 'https://example.com/feed-1', name: '보기', ordering: 1, type: 'WL' }],
          content: '신규 컬렉션 대표 상품을 소개합니다.',
          imageTone: 'sage',
          title: '봄 셋업',
        },
        {
          buttons: [{ id: 'playground-card-2-button', linkMo: 'https://example.com/feed-2', name: '보기', ordering: 1, type: 'WL' }],
          content: '주말 외출을 위한 편안한 실루엣입니다.',
          imageTone: 'blue',
          title: '와이드 팬츠',
        },
      ],
    },
    chatBubbleType: 'CAROUSEL_FEED',
    content: '',
    senderProfileId: defaultBrandMessageSenderProfiles[0]?.value ?? '',
  }));

  return (
    <Panel className="message-send-compose-panel message-send-brand-panel" padded={false}>
      <div className="message-send-compose-layout message-send-brand-layout">
        <div className="message-send-brand-form-column">
          <BrandMessageSendForm
            onChange={setDraft}
            onCarouselPreviewTargetChange={setCarouselPreviewTarget}
            senderProfiles={defaultBrandMessageSenderProfiles}
            templates={defaultBrandMessageTemplates}
            value={draft}
            variablePanelRoot={variablePanelRoot}
          />
        </div>
        <div className="message-variable-panel-root" ref={setVariablePanelRoot} />
        <div className="message-send-brand-preview-column">
          <NhnBrandMessagePreview
            carouselTarget={carouselPreviewTarget}
            senderProfiles={defaultBrandMessageSenderProfiles}
            templates={defaultBrandMessageTemplates}
            value={draft}
          />
        </div>
      </div>
    </Panel>
  );
}

export const playgroundSections = [
  {
    id: 'resend-form-primitives',
    title: 'Resend Form Primitives',
    description: 'Copied form primitives from resends-clone for visual and API comparison before replacing call sites.',
    components: resendFormPrimitiveEntries,
  },
  {
    id: 'onboarding',
    title: 'Onboarding',
    description: 'Composable source-backed onboarding primitives ported from the Resend onboarding main content.',
    components: onboardingEntries,
  },
  {
    id: 'ui',
    title: 'UI',
    description: 'Small primitives that should look identical wherever they are used.',
    components: [
      {
        id: 'button',
        name: 'Button',
        path: 'src/components/ui/Button.jsx',
        description: 'Command button used for primary and secondary actions.',
        controls: [
          { id: 'variant', label: 'variant', type: 'select', options: ['primary', 'secondary'], defaultValue: 'primary' },
          { id: 'label', label: 'children', type: 'text', defaultValue: 'Create broadcast' },
          { id: 'icon', label: 'icon', type: 'select', options: ['none', 'plus', 'export'], defaultValue: 'plus' },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <Button disabled={values.disabled} variant={values.variant}>
              {renderIcon(values.icon)}
              {values.label}
            </Button>
          );
        },
      },
      {
        id: 'icon-button',
        name: 'IconButton',
        path: 'src/components/ui/IconButton.jsx',
        description: 'Square icon-only action button with accessible label.',
        controls: [
          { id: 'icon', label: 'icon', type: 'select', options: ['more', 'export', 'code'], defaultValue: 'more' },
          { id: 'label', label: 'label', type: 'text', defaultValue: 'More actions' },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return <IconButton disabled={values.disabled} icon={iconOptions[values.icon]} label={values.label} />;
        },
      },
      {
        id: 'accordion',
        name: 'Accordion',
        path: 'src/components/ui/Accordion.jsx',
        description: 'Disclosure list used by Resend docs sidebars for grouped navigation.',
        controls: [
          { id: 'defaultOpen', label: 'default open', type: 'boolean', defaultValue: true },
          { id: 'secondary', label: 'second group', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return <AccordionPreview defaultOpen={values.defaultOpen} secondary={values.secondary} />;
        },
      },
      {
        id: 'action-menu',
        name: 'ActionMenu',
        path: 'src/components/ui/ActionMenu.jsx',
        description: 'Anchored action list for row actions, quick operations, and compact command groups.',
        controls: [
          { id: 'label', label: 'trigger label', type: 'text', defaultValue: 'More actions' },
          { id: 'align', label: 'align', type: 'select', options: ['start', 'end'], defaultValue: 'start' },
          { id: 'destructive', label: 'destructive item', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return <ActionMenuPreview align={values.align} destructive={values.destructive} label={values.label} />;
        },
      },
      {
        id: 'popover',
        name: 'Popover',
        path: 'src/components/ui/Popover.jsx',
        description: 'Contextual complementary panel that follows its related trigger and returns focus when closed.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Help panel' },
          { id: 'side', label: 'side', type: 'select', options: ['bottom', 'top', 'left', 'right'], defaultValue: 'bottom' },
        ],
        render(values) {
          return <PopoverPreview side={values.side} title={values.title} />;
        },
      },
      {
        id: 'command-palette',
        name: 'CommandPalette',
        path: 'src/components/ui/CommandPalette.jsx',
        description: 'Dialog-based command menu with search, arrow-key selection, and Cmd/Ctrl+K trigger.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Command menu' },
        ],
        render(values) {
          return <CommandPalettePreview title={values.title} />;
        },
      },
      {
        id: 'toast',
        name: 'Toast',
        path: 'src/components/ui/Toast.jsx',
        description: 'Live-region feedback notification with Resend-style colored appearances.',
        controls: [
          { id: 'appearance', label: 'appearance', type: 'select', options: ['green', 'red', 'yellow', 'gray'], defaultValue: 'green' },
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Team avatar updated.' },
          { id: 'description', label: 'description', type: 'text', defaultValue: 'The image is now visible on your team.' },
          { id: 'messageChannel', label: 'message channel', type: 'select', options: ['SMS', '알림톡'], defaultValue: 'SMS' },
        ],
        render(values) {
          return (
            <ToastPreview
              appearance={values.appearance}
              description={values.description}
              messageChannel={values.messageChannel}
              title={values.title}
            />
          );
        },
      },
      {
        id: 'dialog',
        name: 'Dialog',
        path: 'src/components/ui/Dialog.jsx',
        description: 'Centered modal primitive with title, description, focus trap, backdrop, and close controls.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Rename automation' },
          { id: 'description', label: 'description', type: 'text', defaultValue: 'Update the display name used in the automation table.' },
          { id: 'size', label: 'size', type: 'select', options: ['small', 'medium', 'large'], defaultValue: 'medium' },
        ],
        render(values) {
          return <DialogPreview description={values.description} size={values.size} title={values.title} />;
        },
      },
      {
        id: 'confirmation-dialog',
        name: 'ConfirmationDialog',
        path: 'src/components/ui/ConfirmationDialog.jsx',
        description: 'Action-specific confirmation flow for destructive or high-impact operations.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Delete webhook?' },
          { id: 'description', label: 'description', type: 'text', defaultValue: 'This will permanently delete the webhook endpoint. This action cannot be undone.' },
          { id: 'confirmLabel', label: 'confirmLabel', type: 'text', defaultValue: 'Delete webhook' },
          { id: 'destructive', label: 'destructive', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return (
            <ConfirmationDialogPreview
              confirmLabel={values.confirmLabel}
              description={values.description}
              destructive={values.destructive}
              title={values.title}
            />
          );
        },
      },
      {
        id: 'checkbox',
        name: 'Checkbox',
        path: 'src/components/ui/Checkbox.jsx',
        description: 'Native checkbox control with visible label, caption, disabled, and mixed states.',
        controls: [
          { id: 'label', label: 'label', type: 'text', defaultValue: 'Include inactive contacts' },
          { id: 'caption', label: 'caption', type: 'text', defaultValue: 'Inactive contacts stay visible in filtered table views.' },
          { id: 'checked', label: 'defaultChecked', type: 'boolean', defaultValue: true },
          { id: 'indeterminate', label: 'indeterminate', type: 'boolean', defaultValue: false },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <CheckboxPreview
              caption={values.caption}
              checked={values.checked}
              disabled={values.disabled}
              indeterminate={values.indeterminate}
              label={values.label}
            />
          );
        },
      },
      {
        id: 'bulk-action-bar',
        name: 'BulkActionBar',
        path: 'src/components/ui/BulkActionBar.jsx',
        description: 'Fixed bottom action bar that appears while table rows are selected.',
        controls: [
          { id: 'count', label: 'count', type: 'select', options: ['0', '1', '3'], defaultValue: '3' },
          { id: 'label', label: 'label', type: 'text', defaultValue: 'selected' },
        ],
        render(values) {
          return <BulkActionBarPreview count={values.count} label={values.label} />;
        },
      },
      {
        id: 'tooltip',
        name: 'Tooltip',
        path: 'src/components/ui/Tooltip.jsx',
        description: 'Portal-rendered hover and focus label with collision-aware positioning.',
        controls: [
          { id: 'content', label: 'content', type: 'text', defaultValue: 'Copy API key' },
          { id: 'side', label: 'side', type: 'select', options: ['top', 'right', 'bottom', 'left'], defaultValue: 'top' },
          { id: 'icon', label: 'trigger icon', type: 'select', options: ['copy', 'key', 'send'], defaultValue: 'copy' },
        ],
        render(values) {
          return (
            <TooltipPreview
              content={values.content}
              icon={values.icon}
              side={values.side}
            />
          );
        },
      },
      {
        id: 'kbd',
        name: 'Kbd',
        path: 'src/components/ui/Kbd.jsx',
        description: 'Compact keyboard hint used in tooltips, command menus, and helper text.',
        controls: [
          { id: 'label', label: 'children', type: 'text', defaultValue: 'A' },
        ],
        render(values) {
          return <Kbd>{values.label}</Kbd>;
        },
      },
      {
        id: 'copy-button',
        name: 'CopyButton',
        path: 'src/components/ui/CopyButton.jsx',
        description: 'Icon-only copy affordance with copied state.',
        controls: [
          { id: 'value', label: 'value', type: 'text', defaultValue: 're_1234567890' },
          { id: 'label', label: 'label', type: 'text', defaultValue: 'Copy value' },
        ],
        render(values) {
          return <CopyButton label={values.label} value={values.value} />;
        },
      },
      {
        id: 'copyable-slot',
        name: 'CopyableSlot',
        path: 'src/components/ui/CopyableSlot.jsx',
        description: 'Inline read-only value with a copy action for keys, endpoints, and IDs.',
        controls: [
          { id: 'label', label: 'label', type: 'text', defaultValue: 'Endpoint' },
          { id: 'value', label: 'value', type: 'text', defaultValue: 'https://api.example.com/messages' },
        ],
        render(values) {
          return <CopyableSlot label={values.label} value={values.value} />;
        },
      },
      {
        id: 'badge',
        name: 'Badge',
        path: 'src/components/ui/Badge.jsx',
        description: 'Compact status indicator for table rows and metadata.',
        controls: [
          { id: 'tone', label: 'tone', type: 'select', options: ['neutral', 'green'], defaultValue: 'neutral' },
          { id: 'label', label: 'children', type: 'text', defaultValue: 'Draft' },
        ],
        render(values) {
          return <Badge tone={values.tone}>{values.label}</Badge>;
        },
      },
      {
        id: 'text-field',
        name: 'TextField',
        path: 'src/components/ui/TextField.jsx',
        description: 'Composable input root with optional leading slot for forms and toolbar controls.',
        controls: [
          { id: 'placeholder', label: 'placeholder', type: 'text', defaultValue: 'Search messages...' },
          { id: 'value', label: 'defaultValue', type: 'text', defaultValue: '' },
          { id: 'icon', label: 'slot icon', type: 'select', options: ['search', 'sparkles', 'none'], defaultValue: 'search' },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <TextField.Root>
              {values.icon !== 'none' ? (
                <TextField.Slot>{renderIcon(values.icon, 16)}</TextField.Slot>
              ) : null}
              <TextField.Input
                aria-label="Playground text field"
                defaultValue={values.value}
                disabled={values.disabled}
                placeholder={values.placeholder}
              />
            </TextField.Root>
          );
        },
      },
      {
        id: 'search-field',
        name: 'SearchField',
        path: 'src/components/ui/SearchField.jsx',
        description: 'Toolbar search input with fixed icon and control height.',
        controls: [
          { id: 'placeholder', label: 'placeholder', type: 'text', defaultValue: 'Search...' },
          { id: 'value', label: 'defaultValue', type: 'text', defaultValue: '' },
        ],
        render(values) {
          return <SearchField defaultValue={values.value} placeholder={values.placeholder} />;
        },
      },
      {
        id: 'filter-select',
        name: 'FilterSelect',
        path: 'src/components/ui/FilterSelect.jsx',
        description: 'Toolbar filter dropdown with single-select and multi-select states.',
        controls: [
          { id: 'label', label: 'label', type: 'text', defaultValue: 'Statuses' },
          { id: 'options', label: 'options', type: 'select', options: ['statuses', 'apiKeys', 'levels'], defaultValue: 'statuses' },
          { id: 'multiple', label: 'multiple', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          const optionSets = {
            statuses: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Successes', value: 'successes', tone: 'green' },
              { label: 'Errors', value: 'errors', tone: 'red' },
              { label: 'Queued', value: 'queued', tone: 'neutral' },
            ],
            apiKeys: [
              { label: 'All API keys', value: 'all' },
              { label: 'Production', value: 'production' },
              { label: 'Staging', value: 'staging' },
              { label: 'Development', value: 'development' },
            ],
            levels: [
              { label: 'All levels', value: 'all' },
              { label: 'Info', value: 'info', tone: 'green' },
              { label: 'Warning', value: 'warning', tone: 'yellow' },
              { label: 'Error', value: 'error', tone: 'red' },
            ],
          };

          return (
            <FilterSelect
              defaultValue={values.multiple ? ['all'] : 'all'}
              key={`${values.options}-${values.multiple}`}
              label={values.label}
              multiple={values.multiple}
              options={optionSets[values.options]}
            />
          );
        },
      },
      {
        id: 'email-send-form',
        name: 'EmailSendForm',
        path: 'src/components/ui/EmailSendForm.jsx',
        description: '답장 주소, 예약, 미리보기, 수신자, 주제, 템플릿 선택이 연결된 메시지 작성 화면입니다.',
        controls: [
          { id: 'recipient', label: '수신자', type: 'select', options: ['all', 'product-updates', 'lifecycle-users'], defaultValue: 'all' },
          { id: 'subject', label: '제목', type: 'text', defaultValue: '제목 없는 발송' },
          { id: 'optionalFields', label: '선택 필드', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <EmailSendFormPreview
              optionalFields={values.optionalFields}
              recipient={values.recipient}
              subject={values.subject}
            />
          );
        },
      },
      {
        id: 'sms-send-form',
        name: 'SmsSendForm',
        path: 'src/components/ui/SmsSendForm.jsx',
        description: 'SMS/LMS/MMS 유형 자동 전환, 발신번호, 수신자, 광고성 여부, 080 번호, 이미지 첨부가 연결된 문자 발송 화면입니다.',
        controls: [
          { id: 'recipient', label: '수신자', type: 'select', options: ['all', 'product-updates', 'lifecycle-users'], defaultValue: 'all' },
          { id: 'body', label: '본문', type: 'text', defaultValue: '안녕하세요. 주문하신 상품 배송이 시작되었습니다.' },
          { id: 'isAdvertisement', label: '광고성', type: 'boolean', defaultValue: false },
          { id: 'hasImage', label: '이미지', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <SmsSendFormPreview
              body={values.body}
              hasImage={values.hasImage}
              isAdvertisement={values.isAdvertisement}
              recipient={values.recipient}
            />
          );
        },
      },
      {
        id: 'alimtalk-send-form',
        name: 'AlimtalkSendForm',
        path: 'src/components/ui/AlimtalkSendForm.jsx',
        description: 'Kakao AlimTalk send form with sender profile, recipient, SMS fallback, and template picker modal.',
        render() {
          return (
            <Panel className="message-send-compose-panel message-send-alimtalk-panel" padded={false}>
              <div className="message-send-compose-layout message-send-alimtalk-layout">
                <AlimtalkSendForm />
              </div>
            </Panel>
          );
        },
      },
      {
        id: 'brand-message-preview',
        name: 'NhnBrandMessagePreview',
        path: 'src/components/ui/BrandMessagePreview.jsx',
        description: '브랜드 메시지 말풍선 타입, 템플릿, 쿠폰, 버튼 상태를 보여주는 미리보기입니다.',
        controls: [
          { id: 'mode', label: 'mode', type: 'select', options: ['freestyle', 'template'], defaultValue: 'freestyle' },
          { id: 'chatBubbleType', label: 'chatBubbleType', type: 'select', options: brandPreviewChatBubbleTypeOptions, defaultValue: 'TEXT' },
          { id: 'content', label: 'content', type: 'text', defaultValue: '신규 컬렉션이 공개되었습니다. 이번 주 혜택을 확인해 보세요.' },
          { id: 'coupon', label: 'coupon', type: 'boolean', defaultValue: false },
        ],
        getCurrentProps: getNhnBrandPreviewProps,
        render(values) {
          const previewProps = getNhnBrandPreviewProps(values);

          return (
            <NhnBrandMessagePreview {...previewProps} />
          );
        },
      },
      {
        id: 'bizgo-brand-message-preview',
        name: 'BizgoBrandMessagePreview',
        path: 'src/playground/bizgo-brand-message/BizgoBrandMessageHarness.jsx',
        description: 'Bizgo omni-front-sdk brand message preview harness using the source wrapper, type mapping, mockup renderers, and validation constraints.',
        controls: bizgoBrandMessageControls,
        getProps: getBizgoBrandMessagePlaygroundProps,
        render(values) {
          return <BizgoBrandMessagePreviewPlayground {...values} />;
        },
      },
      {
        id: 'brand-message-send-form',
        name: 'BizgoBrandMessageSendForm',
        path: 'src/playground/bizgo-brand-message/BizgoBrandMessageHarness.jsx',
        description: 'Bizgo brand-message send form harness covering template payload, send payload, recipient, reservation, alternative SMS, and bridge events.',
        controls: bizgoBrandMessageControls,
        getProps: getBizgoBrandMessagePlaygroundProps,
        render(values) {
          return <BizgoBrandMessageSendFormPlayground {...values} />;
        },
      },
      {
        id: 'nhn-brand-message-send-form',
        name: 'NhnBrandMessageSendForm',
        path: 'src/components/ui/BrandMessageSendForm.jsx',
        description: 'NHN brand-message send form with live preview and right-side inspector panels.',
        render() {
          return <NhnBrandMessageSendFormPlayground />;
        },
      },
      {
        id: 'alimtalk-template-create-page',
        name: 'AlimtalkTemplateCreatePage',
        path: 'src/features/console/alimtalkTemplates/AlimtalkTemplateCreatePage.jsx',
        description: 'Source-backed AlimTalk template registration form shell with live preview and validation.',
        render() {
          return <AlimtalkTemplateCreatePagePreview />;
        },
      },
      {
        id: 'alimtalk-template-create-page-new-design',
        name: 'AlimtalkTemplateCreatePageNewDesign',
        path: 'src/features/console/alimtalkTemplates/AlimtalkTemplateCreatePageNewDesign.jsx',
        description: 'Playground-only AlimTalk template registration assembly using the new dense form, upload, checklist, notice, and choice-card primitives.',
        tags: ['alimtalk', 'new-design'],
        render() {
          return <AlimtalkTemplateCreatePageNewDesignPreview />;
        },
      },
      {
        id: 'date-picker-presets',
        name: 'DatePickerPresets',
        path: 'src/components/ui/DatePickerPresets.jsx',
        description: 'Date range dropdown with presets, native date inputs, calendar grid, and apply/cancel actions.',
        controls: [
          { id: 'defaultRange', label: 'defaultRange', type: 'select', options: ['last-15-days', 'last-7-days', 'today'], defaultValue: 'last-15-days' },
          { id: 'window', label: 'min window', type: 'select', options: ['30', '90', '180'], defaultValue: '90' },
        ],
        render(values) {
          const rangeMap = {
            today: { from: daysAgo(0), to: daysAgo(0) },
            'last-7-days': { from: daysAgo(6), to: daysAgo(0) },
            'last-15-days': { from: daysAgo(14), to: daysAgo(0) },
          };

          return (
            <DatePickerPresets
              defaultRange={rangeMap[values.defaultRange]}
              key={`${values.defaultRange}-${values.window}`}
              minDate={daysAgo(Number(values.window))}
            />
          );
        },
      },
      {
        id: 'select-pill',
        name: 'SelectPill',
        path: 'src/components/ui/SelectPill.jsx',
        description: 'Filter dropdown trigger used in console toolbars.',
        controls: [
          { id: 'label', label: 'children', type: 'text', defaultValue: 'Last 15 days' },
          { id: 'options', label: 'options', type: 'select', options: ['dates', 'statuses', 'apiKeys', 'none'], defaultValue: 'dates' },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          const optionSets = {
            dates: ['Today', 'Yesterday', 'Last 3 days', 'Last 7 days', 'Last 15 days', 'Last 30 days'],
            statuses: [
              { label: 'All Statuses', value: 'All Statuses' },
              { label: 'Successes', value: 'Successes', tone: 'green' },
              { label: 'Errors', value: 'Errors', tone: 'red' },
              { label: 'Queued', value: 'Queued', tone: 'neutral' },
            ],
            apiKeys: ['All API keys', 'Production', 'Staging', 'Development'],
            none: undefined,
          };

          return (
            <SelectPill
              defaultValue={values.label}
              disabled={values.disabled}
              options={optionSets[values.options]}
            >
              {values.label}
            </SelectPill>
          );
        },
      },
      {
        id: 'dropdown-menu',
        name: 'DropdownMenu',
        path: 'src/components/ui/DropdownMenu.jsx',
        description: 'Composable anchored menu primitive with trigger, content, item, checkbox item, label, and separator exports.',
        controls: [
          { id: 'label', label: 'trigger label', type: 'text', defaultValue: 'Open menu' },
          { id: 'align', label: 'align', type: 'select', options: ['start', 'end'], defaultValue: 'start' },
          { id: 'checked', label: 'checked item', type: 'boolean', defaultValue: true },
          { id: 'disabledItem', label: 'disabled item', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  {values.label}
                  <ChevronDown size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={values.align}>
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                <DropdownMenuItem>
                  Last 15 days
                  <Check aria-hidden="true" size={14} />
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={values.checked}
                  onSelect={(event) => event.preventDefault()}
                >
                  Include drafts
                  {values.checked ? <Check aria-hidden="true" size={14} /> : null}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={values.disabledItem}>Disabled action</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
      {
        id: 'drawer',
        name: 'Drawer',
        path: 'src/components/ui/Drawer.jsx',
        description: 'Accessible side-sheet dialog with trigger, header, body, footer, focus return, and Escape close.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'API code' },
          { id: 'side', label: 'side', type: 'select', options: ['right', 'left'], defaultValue: 'right' },
          { id: 'description', label: 'description', type: 'text', defaultValue: 'Send a test message with your API key.' },
        ],
        render(values) {
          return (
            <Drawer>
              <DrawerTrigger asChild>
                <Button>
                  Open drawer
                  <ChevronDown size={15} />
                </Button>
              </DrawerTrigger>
              <DrawerContent side={values.side}>
                <DrawerHeader>
                  <DrawerTitle>{values.title}</DrawerTitle>
                  <DrawerDescription>{values.description}</DrawerDescription>
                </DrawerHeader>
                <DrawerBody>
                  <CopyableSlot label="Environment" value="RESEND_API_KEY" />
                  <CodeBlock
                    code={'curl -X POST https://api.resend.com/emails \\\n  -H "Authorization: Bearer $RESEND_API_KEY"'}
                    language="bash"
                    title="cURL"
                  />
                </DrawerBody>
                <DrawerFooter>
                  <Button>Cancel</Button>
                  <Button variant="primary">Run request</Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          );
        },
      },
      {
        id: 'code-block',
        name: 'CodeBlock',
        path: 'src/components/ui/CodeBlock.jsx',
        description: 'Copyable monospace snippet frame used by API drawers and docs surfaces.',
        controls: [
          { id: 'language', label: 'language', type: 'select', options: ['javascript', 'bash', 'python'], defaultValue: 'javascript' },
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Node.js' },
          { id: 'showCopy', label: 'showCopy', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          const snippets = {
            bash: 'curl -X POST https://api.example.com/messages \\\n  -H "Authorization: Bearer $API_KEY"',
            javascript: "await client.messages.send({\n  to: '+821012345678',\n  text: 'Hello from messaging-app'\n});",
            python: "client.messages.send({\n  'to': '+821012345678',\n  'text': 'Hello from messaging-app'\n})",
          };

          return (
            <CodeBlock
              code={snippets[values.language]}
              language={values.language}
              showCopy={values.showCopy}
              title={values.title}
            />
          );
        },
      },
      {
        id: 'segmented-control',
        name: 'SegmentedControl',
        path: 'src/components/ui/SegmentedControl.jsx',
        description: 'Two or more tab-like options with local selected state.',
        controls: [
          { id: 'items', label: 'items', type: 'select', options: ['Sending,Receiving', 'Usage,Billing,Team'], defaultValue: 'Sending,Receiving' },
          { id: 'defaultValue', label: 'defaultValue', type: 'select', options: ['Sending', 'Receiving', 'Usage', 'Billing', 'Team'], defaultValue: 'Sending' },
        ],
        render(values) {
          const items = values.items.split(',');
          const defaultValue = items.includes(values.defaultValue) ? values.defaultValue : items[0];
          return <SegmentedControl defaultValue={defaultValue} items={items} />;
        },
      },
      {
        id: 'subscribe-topic-select',
        name: 'SubscribeTopicSelect',
        path: 'src/components/ui/SubscribeTopicSelect.jsx',
        description: 'Resend-style Subscribe to topic picker with selected state, helper copy, and create action.',
        controls: [
          { id: 'defaultOpen', label: 'defaultOpen', type: 'boolean', defaultValue: true },
          { id: 'topicSet', label: 'topics', type: 'select', options: ['empty', 'with topics'], defaultValue: 'empty' },
          { id: 'value', label: 'value', type: 'select', options: ['none', 'product-updates', 'transactional-notices'], defaultValue: 'none' },
          { id: 'placeholder', label: 'placeholder', type: 'text', defaultValue: 'Select a topic' },
          { id: 'createLabel', label: 'createLabel', type: 'text', defaultValue: 'Create a topic' },
        ],
        render(values) {
          const topicOptions = values.topicSet === 'empty'
            ? [{ label: 'No topic', value: 'none' }]
            : [
                { label: 'No topic', value: 'none' },
                { label: 'Product updates', value: 'product-updates' },
                { label: 'Transactional notices', value: 'transactional-notices' },
              ];

          return (
            <SubscribeTopicSelect
              createLabel={values.createLabel}
              defaultOpen={values.defaultOpen}
              key={`${values.defaultOpen}-${values.topicSet}-${values.value}-${values.placeholder}-${values.createLabel}`}
              options={topicOptions}
              placeholder={values.placeholder}
              value={values.value}
            />
          );
        },
      },
      {
        id: 'card',
        name: 'Card',
        path: 'src/components/ui/Card.jsx',
        description: 'Profile/settings card frame with header, copy, and actions slots.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Your email' },
          { id: 'copy', label: 'copy', type: 'text', defaultValue: 'Use this frame for profile and settings surfaces.' },
          { id: 'primaryAction', label: 'primary action', type: 'text', defaultValue: 'Update email' },
          { id: 'secondaryAction', label: 'secondary action', type: 'text', defaultValue: 'Cancel' },
        ],
        render(values) {
          return (
            <Card aria-labelledby="playground-card-title" className="profile-email-card">
              <CardHeader>
                <CardTitle id="playground-card-title">{values.title}</CardTitle>
              </CardHeader>
              <CardCopy>
                <p>{values.copy}</p>
              </CardCopy>
              <CardActions>
                <Button variant="primary">{values.primaryAction}</Button>
                <Button>{values.secondaryAction}</Button>
              </CardActions>
            </Card>
          );
        },
      },
      {
        id: 'panel',
        name: 'Panel',
        path: 'src/components/ui/Panel.jsx',
        description: 'Static inspector-style frame that accepts any child components.',
        controls: [
          { id: 'padded', label: 'padded', type: 'boolean', defaultValue: true },
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Panel content' },
          { id: 'copy', label: 'copy', type: 'text', defaultValue: 'Drop any UI component into this inspector-style frame.' },
        ],
        render(values) {
          return (
            <Panel className="playground-panel-preview" padded={values.padded}>
              <div className="playground-panel-content">
                <Badge tone="neutral">Panel</Badge>
                <h3>{values.title}</h3>
                <p>{values.copy}</p>
                <Button variant="secondary">Child action</Button>
              </div>
            </Panel>
          );
        },
      },
      {
        id: 'data-table-v2',
        name: 'DataTableV2',
        path: 'src/components/ui/DataTableV2.jsx',
        description: 'Generic TanStack-backed DataTableV2 renderer with Resend edge checkboxes, bulk actions, row menu, and pagination mock.',
        controls: [
          { id: 'loading', label: 'loading', type: 'boolean', defaultValue: false },
          { id: 'totalRows', label: 'total rows', type: 'select', options: ['40', '80', '128', '240'], defaultValue: '128' },
        ],
        render(values) {
          return (
            <EmailDataTableV2Demo
              key={values.totalRows}
              loading={values.loading}
              totalRows={Number(values.totalRows)}
            />
          );
        },
      },
      {
        id: 'pagination',
        name: 'Pagination',
        path: 'src/components/ui/Pagination.jsx',
        description: 'Table pagination footer with range summary, page-size selector, and previous/next controls.',
        controls: [
          { id: 'total', label: 'total', type: 'select', options: ['0', '12', '86', '242'], defaultValue: '86' },
          { id: 'pageSize', label: 'pageSize', type: 'select', options: ['15', '40', '80', '120'], defaultValue: '15' },
          { id: 'label', label: 'label', type: 'text', defaultValue: 'messages' },
        ],
        render(values) {
          return (
            <Pagination
              defaultPageSize={Number(values.pageSize)}
              key={`${values.total}-${values.pageSize}`}
              label={values.label}
              total={Number(values.total)}
            />
          );
        },
      },
      {
        id: 'empty-state',
        name: 'EmptyState',
        path: 'src/components/ui/EmptyState.jsx',
        description: 'Centered empty surface used by console pages without records.',
        controls: [
          { id: 'icon', label: 'icon', type: 'select', options: ['braces', 'sparkles'], defaultValue: 'braces' },
          { id: 'title', label: 'title', type: 'text', defaultValue: 'No sent emails yet' },
          { id: 'copy', label: 'copy', type: 'text', defaultValue: 'Start sending emails to see insights and previews for every message.' },
          { id: 'action', label: 'action', type: 'text', defaultValue: 'Go to docs' },
        ],
        render(values) {
          return (
            <EmptyState
              action={values.action}
              copy={values.copy}
              icon={iconOptions[values.icon]}
              title={values.title}
            />
          );
        },
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Shared components extracted from Resend settings usage and billing surfaces.',
    components: [
      {
        id: 'section-panel',
        name: 'SectionPanel',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Billing-style settings card with title, copy, body, and footer action slots.',
        tags: ['setting'],
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Billing email' },
          { id: 'disabled', label: 'disabled action', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return <SectionPanelPreview disabled={values.disabled} title={values.title} />;
        },
      },
      {
        id: 'overview-form-panel',
        name: 'OverviewFormPanel',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Team overview settings card with avatar actions, editable team name, and save footer.',
        tags: ['setting'],
        controls: [
          { id: 'nameValue', label: 'team name', type: 'text', defaultValue: 'vvee1253' },
          { id: 'avatarHelpText', label: 'avatar help', type: 'text', defaultValue: 'Maximum file size is 1MB.' },
          { id: 'saveDisabled', label: 'save disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <OverviewFormPanelPreview
              avatarHelpText={values.avatarHelpText}
              key={`${values.nameValue}-${values.avatarHelpText}-${values.saveDisabled}`}
              nameValue={values.nameValue}
              saveDisabled={values.saveDisabled}
            />
          );
        },
      },
      {
        id: 'split-section',
        name: 'SplitSection',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Two-column settings section for usage quotas, sender resources, and add-on lists.',
        tags: ['setting'],
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: '트랜잭션' },
          { id: 'rows', label: 'rows', type: 'select', options: ['transactional', 'marketing'], defaultValue: 'transactional' },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <SplitSectionPreview
              disabled={values.disabled}
              rows={values.rows}
              title={values.title}
            />
          );
        },
      },
      {
        id: 'property-row',
        name: 'PropertyRow',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Reusable quota/resource row with leading icon, label, detail, value, and trailing status.',
        tags: ['setting'],
        controls: [
          { id: 'detail', label: 'detail', type: 'text', defaultValue: '사용 가능 · 승인됨' },
          { id: 'value', label: 'value', type: 'text', defaultValue: '10,000' },
        ],
        render(values) {
          return <PropertyRowPreview detail={values.detail} value={values.value} />;
        },
      },
      {
        id: 'subscription-list',
        name: 'SubscriptionList',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Billing subscription product list with quota, price, row action, and footer action slots.',
        tags: ['setting'],
        controls: [
          { id: 'plan', label: 'plan', type: 'select', options: ['free', 'paid'], defaultValue: 'free' },
        ],
        render(values) {
          return <SubscriptionListPreview plan={values.plan} />;
        },
      },
      {
        id: 'inline-empty-state',
        name: 'InlineEmptyState',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Compact empty state for settings cards such as payment methods and invoices.',
        tags: ['setting'],
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'There are no payment methods yet.' },
          { id: 'action', label: 'action', type: 'text', defaultValue: 'Add new card' },
        ],
        render(values) {
          return <InlineEmptyStatePreview action={values.action} title={values.title} />;
        },
      },
      {
        id: 'preference-row',
        name: 'PreferenceRow',
        path: 'src/components/ui/SectionPanel.jsx',
        description: 'Native checkbox row for pay-as-you-go, add-on, and enabled/disabled billing options.',
        tags: ['setting'],
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Transactional' },
          { id: 'checked', label: 'checked', type: 'boolean', defaultValue: false },
          { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
        ],
        render(values) {
          return (
            <PreferenceRowPreview
              checked={values.checked}
              disabled={values.disabled}
              title={values.title}
            />
          );
        },
      },
    ],
  },
  {
    id: 'studies',
    title: 'Studies',
    description: 'Focused product UI explorations before they are promoted into shared components.',
    components: [
      {
        id: 'template-card-list',
        name: 'TemplateCardList',
        path: 'src/features/console/templates/TemplateCardList.jsx',
        description: 'Template grid with NHN template body previews, status badges, search, status filter, and sender resource filter.',
        tags: ['template'],
        controls: [
          { id: 'channel', label: 'channel', type: 'select', options: ['SMS', '알림톡', '브랜드 메시지'], defaultValue: 'SMS' },
          { id: 'state', label: 'state', type: 'select', options: ['loading', 'empty', 'two', 'nine'], defaultValue: 'two' },
        ],
        render(values) {
          return <TemplateCardListPreview channel={values.channel} state={values.state} />;
        },
      },
      {
        id: 'domains-page',
        name: 'DomainsPage',
        path: 'src/components/domains/Domains.jsx',
        description: 'Domains dashboard surface extracted from refs/resend/domain with source-matched header, toolbar, table, skeleton, and empty state.',
        tags: ['domain'],
        controls: [
          { id: 'state', label: 'state', type: 'select', options: ['empty', 'loading', 'filled'], defaultValue: 'empty' },
        ],
        render(values) {
          return <DomainsPagePreview state={values.state} />;
        },
      },
      {
        id: 'domains-add-page',
        name: 'DomainsAddPage',
        path: 'src/components/domains/DomainsAdd.jsx',
        description: 'Domains add flow extracted from live resend.com/domains/add with the source step rail, Domain step, advanced options, email preview, and DNS Records step.',
        tags: ['domain'],
        controls: [
          { id: 'state', label: 'state', type: 'select', options: ['default', 'advanced', 'created', 'dns-locked', 'dns-manual'], defaultValue: 'default' },
        ],
        render(values) {
          return <DomainsAddPagePreview state={values.state} />;
        },
      },
      {
        id: 'domain-detail-page',
        name: 'DomainDetailPage',
        path: 'src/components/domains/DomainDetail.jsx',
        description: 'Single-page reproduction of refs/resend/domain-detail for new.vizuo.work, including sidebar, domain header, DNS record tables, and receiving toggle.',
        tags: ['domain', 'page'],
        render() {
          return <DomainDetailPagePreview />;
        },
      },
      {
        id: 'domain-dns-notice',
        name: 'DomainDnsNotice',
        path: 'src/components/domains/DomainDetailRecords.jsx',
        description: 'Source-matched blue DNS instruction alert from refs/resend/domain-detail, including icon, Cloudflare link, gradient fade, border, and selection styling.',
        tags: ['domain', 'notice'],
        render() {
          return <DomainDnsNoticePreview />;
        },
      },
      {
        id: 'add-kakao-channel',
        name: 'KakaoChannelAddPage',
        path: 'src/components/sender-resources/KakaoChannelAdd.jsx',
        description: '카카오 채널 추가 flow study using the add-domain step rail motif, with channel info, token verification, and activation states.',
        tags: ['sender-resource', 'kakao'],
        controls: [
          { id: 'state', label: 'state', type: 'select', options: ['default', 'prefilled', 'requested', 'verified', 'rejected'], defaultValue: 'default' },
        ],
        render(values) {
          return <KakaoChannelAddPagePreview state={values.state} />;
        },
      },
      {
        id: 'sms-sender-number-add',
        name: 'SmsSenderNumberAdd',
        path: 'src/components/sender-resources/SmsSenderNumberAdd.jsx',
        description: '발신번호 신청 scaffold using the add-domain step rail, with number entry, evidence upload shell, rejected resubmission, and submitted review state.',
        tags: ['sender-resource', 'sms'],
        controls: [
          {
            id: 'state',
            label: 'state',
            type: 'select',
            options: ['default', 'numberCompleted', 'partialEvidence', 'rejectedResubmission', 'submittedCompleted'],
            defaultValue: 'default',
          },
        ],
        render(values) {
          return <SmsSenderNumberAddPreview state={values.state} />;
        },
      },
      {
        id: 'brand-button-editor-samples',
        name: 'BrandButtonEditorSamples',
        path: 'src/playground/BrandButtonEditorSamples.jsx',
        description: '브랜드 메시지 버튼을 캔버스 아래에 쌓지 않고 별도 편집면으로 다루는 5가지 후보입니다.',
        controls: [
          { id: 'option', label: 'option', type: 'select', options: ['all', 'drawer', 'popover', 'split', 'manager', 'modal'], defaultValue: 'all' },
        ],
        render(values) {
          return <BrandButtonEditorSamples option={values.option} />;
        },
      },
    ],
  },
  {
    id: 'automation-builder',
    title: 'Automation Builder',
    description: 'Source-backed automation builder nodes ported from resends-clone.',
    components: [
      {
        id: 'automation-action-list',
        name: 'AutomationActionList',
        path: 'src/features/console/automations/builder/AutomationActionList.jsx',
        description: 'Grouped automation action picker with source listbox semantics and selected state.',
        tags: ['automation', 'source-backed'],
        controls: [
          {
            id: 'selectedActionId',
            label: 'selected action',
            type: 'select',
            options: [
              'ai-generate',
              'send_email',
              'true_false_branch',
              'delay',
              'wait_for_event',
              'contact_update',
              'contact_delete',
              'add_to_segment',
            ],
            defaultValue: 'delay',
          },
        ],
        render(values) {
          return (
            <ResendAutomationPreview>
              <AutomationActionList
                selectedActionId={getAutomationActionId(values.selectedActionId)}
              />
            </ResendAutomationPreview>
          );
        },
      },
      {
        id: 'automation-send-email-node',
        name: 'AutomationSendMessageNode',
        path: 'src/features/console/automations/builder/AutomationSendMessageNode.jsx',
        description: 'Send message automation node with template modal, inline settings, preview column, and source-captured dimensions.',
        tags: ['automation', 'source-backed'],
        controls: [
          {
            id: 'state',
            label: 'state',
            type: 'select',
            options: ['picker', 'preview', 'settings', 'loading', 'empty', 'invalid'],
            defaultValue: 'picker',
          },
        ],
        render(values) {
          return renderAutomationSendEmailNodeState(values.state);
        },
      },
      {
        id: 'automation-set-variables',
        name: 'AutomationSetVariables',
        path: 'src/features/console/automations/builder/AutomationSetVariables.jsx',
        description: 'Source-backed Set variables combobox with Contact and event alias groups.',
        tags: ['automation', 'source-backed', 'form'],
        controls: [
          {
            id: 'state',
            label: 'state',
            type: 'select',
            options: ['default', 'invalid', 'empty'],
            defaultValue: 'default',
          },
        ],
        render(values) {
          return <AutomationSetVariablesPlayground state={values.state} />;
        },
      },
      {
        id: 'automation-trigger-node',
        name: 'AutomationTriggerNode',
        path: 'src/features/console/automations/builder/AutomationTriggerNode.jsx',
        description: 'Custom event trigger node without React Flow, preserving source header, field, actions, and connector.',
        tags: ['automation', 'source-backed'],
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Custom event' },
          { id: 'eventName', label: 'event name', type: 'text', defaultValue: 'event' },
          { id: 'showApiButton', label: 'show API button', type: 'boolean', defaultValue: true },
          { id: 'showConnector', label: 'show connector', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return (
            <ResendAutomationPreview>
              <AutomationTriggerNode
                eventName={values.eventName}
                showApiButton={values.showApiButton}
                showConnector={values.showConnector}
                title={values.title}
              />
            </ResendAutomationPreview>
          );
        },
      },
    ],
  },
  {
    id: 'layout',
    title: 'Layout',
    description: 'Composed controls used to assemble console pages.',
    components: [
      {
        id: 'page-header',
        name: 'PageHeader',
        path: 'src/components/layout/PageHeader.jsx',
        description: 'Page title row with optional primary action.',
        controls: [
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Templates' },
          { id: 'action', label: 'action', type: 'text', defaultValue: 'Create template' },
          { id: 'showAction', label: 'show action', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return <PageHeader action={values.showAction ? values.action : undefined} title={values.title} />;
        },
      },
      {
        id: 'toolbar',
        name: 'Toolbar',
        path: 'src/components/layout/Toolbar.jsx',
        description: 'Console toolbar with search, filters, code, and export actions.',
        controls: [
          { id: 'filters', label: 'filters', type: 'select', options: ['emails', 'logs', 'none'], defaultValue: 'emails' },
          { id: 'showCode', label: 'showCode', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          const filters = {
            emails: ['Last 15 days', 'All Statuses', 'All API keys'],
            logs: ['Last hour', 'All levels'],
            none: [],
          }[values.filters];
          return <Toolbar filters={filters} showCode={values.showCode} />;
        },
      },
      {
        id: 'inspector-sidebar',
        name: 'InspectorSidebar',
        path: 'src/components/layout/InspectorSidebar.jsx',
        description: 'Hover-revealed inspector shell with source-matched pin toggle and scrollbar behavior.',
        controls: [
          { id: 'defaultOpen', label: 'defaultOpen', type: 'boolean', defaultValue: false },
          { id: 'defaultPinned', label: 'defaultPinned', type: 'boolean', defaultValue: false },
          { id: 'handleColor', label: 'handleColor', type: 'text', defaultValue: '#191919' },
          { id: 'panelSize', label: 'panelSize', type: 'select', options: ['193', '240', '320'], defaultValue: '320' },
          { id: 'side', label: 'side', type: 'select', options: ['right', 'left', 'top', 'bottom'], defaultValue: 'right' },
          { id: 'topbarHeight', label: 'topbarHeight', type: 'select', options: ['0px', '59px'], defaultValue: '0px' },
        ],
        render(values) {
          const rows = Array.from({ length: 28 }, (_, index) => `Custom content row ${index + 1}`);

          return (
            <InspectorSidebar
              defaultOpen={values.defaultOpen}
              defaultPinned={values.defaultPinned}
              handleColor={values.handleColor}
              key={`${values.defaultOpen}-${values.defaultPinned}-${values.handleColor}-${values.panelSize}-${values.side}-${values.topbarHeight}`}
              panelSize={Number(values.panelSize)}
              side={values.side}
              topbarHeight={values.topbarHeight}
            >
              <div className="inspector-demo-content">
                <h4>Custom panel content</h4>
                {rows.map((row) => (
                  <div className="inspector-demo-row" key={row}>{row}</div>
                ))}
              </div>
            </InspectorSidebar>
          );
        },
      },
    ],
  },
  {
    id: 'docs',
    title: 'Docs',
    description: 'Docs primitives and content styling used by the Resend/Mintlify-like docs page.',
    components: [
      {
        id: 'docs-section',
        name: 'DocsSection',
        path: 'src/components/docs/DocsSection.jsx',
        description: 'MDX-like section block with hover anchor and prose content.',
        controls: [
          { id: 'theme', label: 'theme', type: 'select', options: ['light', 'dark'], defaultValue: 'light' },
          { id: 'title', label: 'title', type: 'text', defaultValue: '브랜드 메시지 발송' },
          { id: 'body', label: 'body', type: 'text', defaultValue: '발신 프로필을 설정하고 내용을 입력해 브랜드 메시지를 발송할 수 있습니다.' },
          { id: 'showCode', label: 'show code block', type: 'boolean', defaultValue: true },
        ],
        render(values) {
          return (
            <div className={`docs-shell docs-${values.theme} playground-docs-preview`}>
              <section className="docs-mdx-content">
                <DocsSection id="playground-docs-section" title={values.title}>
                  <p>{values.body}</p>
                  {values.showCode ? <pre><code>{'(광고)내용[무료 수신거부]080XXXXXXX'}</code></pre> : null}
                </DocsSection>
              </section>
            </div>
          );
        },
      },
      {
        id: 'docs-callout',
        name: 'DocsCallout',
        path: 'src/components/docs/DocsCallout.jsx',
        description: 'Mintlify-style docs callout for Info, Note, Tip, and Warning content.',
        controls: [
          { id: 'variant', label: 'variant', type: 'select', options: ['info', 'note', 'tip', 'warning'], defaultValue: 'info' },
          { id: 'title', label: 'title', type: 'text', defaultValue: 'Sender required' },
        ],
        render(values) {
          return <DocsCalloutPreview title={values.title} variant={values.variant} />;
        },
      },
      {
        id: 'docs-card',
        name: 'DocsCard',
        path: 'src/components/docs/DocsCard.jsx',
        description: 'Linked documentation card grid used in Resend docs resource collections.',
        controls: [
          { id: 'count', label: 'cards', type: 'select', options: ['1', '2', '3'], defaultValue: '2' },
        ],
        render(values) {
          return <DocsCardPreview count={Number(values.count)} />;
        },
      },
      {
        id: 'code-group',
        name: 'CodeGroup',
        path: 'src/components/docs/CodeGroup.jsx',
        description: 'Tabbed code example group for language-specific docs snippets.',
        controls: [
          { id: 'defaultValue', label: 'default tab', type: 'select', options: ['curl', 'node'], defaultValue: 'curl' },
        ],
        render(values) {
          return <CodeGroupPreview defaultValue={values.defaultValue} />;
        },
      },
    ],
  },
];

export function getFirstComponentRoute() {
  const section = playgroundSections[0];
  const component = section.components[0];
  return `/playground/${section.id}/${component.id}`;
}

export function findPlaygroundComponent(sectionId, componentId) {
  const fallbackSection = playgroundSections[0];
  const fallbackComponent = fallbackSection.components[0];
  const section = playgroundSections.find((item) => item.id === sectionId) ?? fallbackSection;
  const component = section.components.find((item) => item.id === componentId) ?? section.components[0] ?? fallbackComponent;
  return { section, component };
}
