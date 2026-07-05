'use client';

import { useState } from 'react';
import { ArrowDownToLine, Code2 } from 'lucide-react';
import {
  CodeBlock,
  CopyableSlot,
  DatePickerPresets,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  FilterSelect,
  IconButton,
  Kbd,
  SearchField,
  SegmentedControl,
  Tooltip,
} from '../ui/index.js';

const statusOptions = [
  { label: '모든 상태', value: 'all' },
  { label: '성공', value: 'success', tone: 'green' },
  { label: '대기', value: 'queued', tone: 'neutral' },
  { label: '실패', value: 'failed', tone: 'red' },
  { label: '초안', value: 'draft', tone: 'neutral' },
];

const levelOptions = [
  { label: '모든 레벨', value: 'all' },
  { label: '정보', value: 'info', tone: 'green' },
  { label: '경고', value: 'warning', tone: 'yellow' },
  { label: '오류', value: 'error', tone: 'red' },
];

const sdkOptions = ['Node.js', 'Python', 'cURL'];

const apiSnippets = {
  'Node.js': `import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['user@example.com'],
  subject: 'Hello from messaging-app',
  html: '<strong>It works.</strong>',
});`,
  Python: `from resend import Resend

resend = Resend(api_key=os.environ["RESEND_API_KEY"])

resend.emails.send({
  "from": "Acme <onboarding@resend.dev>",
  "to": ["user@example.com"],
  "subject": "Hello from messaging-app",
  "html": "<strong>It works.</strong>",
})`,
  cURL: `curl -X POST 'https://api.resend.com/emails' \\
  -H 'Authorization: Bearer $RESEND_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "from": "Acme <onboarding@resend.dev>",
    "to": ["user@example.com"],
    "subject": "Hello from messaging-app",
    "html": "<strong>It works.</strong>"
  }'`,
};

const filterDefinitions = {
  '최근 15일': { type: 'date' },
  '최근 1시간': {
    defaultValue: 'last-hour',
    label: '기간',
    options: [
      { label: '최근 15분', value: 'last-15-minutes' },
      { label: '최근 1시간', value: 'last-hour' },
      { label: '최근 6시간', value: 'last-6-hours' },
      { label: '최근 24시간', value: 'last-24-hours' },
      { label: '최근 7일', value: 'last-7-days' },
    ],
    type: 'single',
  },
  '모든 상태': {
    defaultValue: ['all'],
    label: '상태',
    multiple: true,
    options: statusOptions,
    type: 'select',
  },
  '모든 레벨': {
    defaultValue: ['all'],
    label: '레벨',
    multiple: true,
    options: levelOptions,
    type: 'select',
  },
  '모든 API 키': {
    defaultValue: 'all',
    label: 'API 키',
    options: [
      { label: '모든 API 키', value: 'all' },
      { label: '프로덕션', value: 'production' },
      { label: '스테이징', value: 'staging' },
      { label: '개발', value: 'development' },
    ],
    type: 'single',
  },
  '모든 도메인': {
    defaultValue: 'all',
    label: '도메인',
    options: [
      { label: '모든 도메인', value: 'all' },
      { label: 'example.com', value: 'example.com' },
      { label: 'staging.example.com', value: 'staging.example.com' },
    ],
    type: 'single',
  },
  'Last 15 days': { type: 'date' },
  'Last hour': {
    defaultValue: 'last-hour',
    label: 'Time range',
    options: [
      { label: 'Last 15 minutes', value: 'last-15-minutes' },
      { label: 'Last hour', value: 'last-hour' },
      { label: 'Last 6 hours', value: 'last-6-hours' },
      { label: 'Last 24 hours', value: 'last-24-hours' },
      { label: 'Last 7 days', value: 'last-7-days' },
    ],
    type: 'single',
  },
  'All Statuses': {
    defaultValue: ['all'],
    label: 'Statuses',
    multiple: true,
    options: [
      { label: 'All Statuses', value: 'all' },
      { label: 'Successes', value: 'successes', tone: 'green' },
      { label: 'Errors', value: 'errors', tone: 'red' },
      { label: 'Queued', value: 'queued', tone: 'neutral' },
    ],
    type: 'select',
  },
  'All API keys': {
    defaultValue: 'all',
    label: 'API key',
    options: [
      { label: 'All API keys', value: 'all' },
      { label: 'Production', value: 'production' },
      { label: 'Staging', value: 'staging' },
      { label: 'Development', value: 'development' },
    ],
    type: 'single',
  },
  'All levels': {
    defaultValue: ['all'],
    label: 'Levels',
    multiple: true,
    options: [
      { label: 'All levels', value: 'all' },
      { label: 'Info', value: 'info', tone: 'green' },
      { label: 'Warning', value: 'warning', tone: 'yellow' },
      { label: 'Error', value: 'error', tone: 'red' },
    ],
    type: 'select',
  },
};

function normalizeFilter(filter) {
  if (typeof filter === 'string') {
    return {
      id: filter,
      label: filter,
      ...(filterDefinitions[filter] ?? {
        defaultValue: filter,
        options: [{ label: filter, value: filter }],
        type: 'single',
      }),
    };
  }

  return {
    id: filter.id ?? filter.label,
    label: filter.label,
    ...(filterDefinitions[filter.label] ?? {}),
    ...filter,
  };
}

function ToolbarFilter({ filter }) {
  if (filter.type === 'date') {
    return <DatePickerPresets />;
  }

  return (
    <FilterSelect
      className={filter.className}
      defaultValue={filter.defaultValue}
      label={filter.label}
      multiple={filter.multiple}
      options={filter.options}
    />
  );
}

export function ApiCodeDrawer() {
  const [sdk, setSdk] = useState(sdkOptions[0]);

  return (
    <Drawer>
      <Tooltip content="API 코드" side="bottom">
        <DrawerTrigger asChild>
          <IconButton icon={Code2} label="API 코드" title="" />
        </DrawerTrigger>
      </Tooltip>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>API 코드</DrawerTitle>
          <DrawerDescription>
            현재 메시지 발송 흐름을 API로 연결할 때 사용할 기본 예시입니다.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <div className="api-drawer-stack">
            <SegmentedControl items={sdkOptions} onValueChange={setSdk} value={sdk} />
            <div className="api-drawer-meta">
              <CopyableSlot label="환경 변수" value="RESEND_API_KEY" />
              <CopyableSlot label="엔드포인트" value="https://api.resend.com/emails" />
            </div>
            <CodeBlock code={apiSnippets[sdk]} language={sdk.toLowerCase()} title={sdk} />
            <p className="api-drawer-help">
              단축키 <Kbd>A</Kbd> 로 열리는 Resend 원본의 API drawer 흐름을 기준으로, 여기서는 toolbar 코드 버튼에서 같은 작업을 시작하게 했습니다.
            </p>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

export function Toolbar({ className = '', filters = [], showCode = false, showExport = true }) {
  const normalizedFilters = filters.map(normalizeFilter);

  return (
    <div className={['toolbar', className].filter(Boolean).join(' ')}>
      <SearchField />
      {normalizedFilters.map((filter) => (
        <ToolbarFilter filter={filter} key={filter.id} />
      ))}
      <div className="toolbar-spacer" />
      {showCode ? <ApiCodeDrawer /> : null}
      {showExport ? (
        <Tooltip content="내보내기" side="bottom">
          <IconButton icon={ArrowDownToLine} label="내보내기" title="" />
        </Tooltip>
      ) : null}
    </div>
  );
}
