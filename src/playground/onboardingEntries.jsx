import { useState } from 'react';
import { ChevronRight, Lock, MessageSquareText, RadioTower, Send, ShieldCheck } from 'lucide-react';

import {
  OnboardingActionButton,
  OnboardingChannelSelector,
  OnboardingChannelSummary,
  OnboardingCodePanel,
  OnboardingResourceCard,
  OnboardingShell,
  OnboardingSidebar,
  OnboardingStepActions,
  OnboardingStepCard,
  OnboardingTabs,
  OnboardingTaskList,
  OnboardingTopbar,
  createMessagingOnboardingData,
} from '../components/onboarding/index.js';

function asBoolean(values, key) {
  return values[key] === true;
}

function asString(values, key, fallback = '') {
  const value = values[key];
  return typeof value === 'string' ? value : fallback;
}

function OnboardingPreviewFrame({ children, width = 760 }) {
  return (
    <div style={{ width: `min(${width}px, 100%)` }}>
      {children}
    </div>
  );
}

function OnboardingSurface({ children, width = 760 }) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 18,
        color: 'var(--text)',
        minHeight: 220,
        overflow: 'hidden',
        width: `min(${width}px, 100%)`,
      }}
    >
      {children}
    </div>
  );
}

function renderStepAction(values) {
  if (!asBoolean(values, 'showAction')) return null;

  return (
    <OnboardingActionButton icon={ChevronRight} variant="primary">
      {asString(values, 'actionLabel', '이 채널로 시작하기')}
    </OnboardingActionButton>
  );
}

function findChannelOption(data, value) {
  return data.channelOptions.find((option) => option.value === value) ?? data.channelOptions[0];
}

function OnboardingChannelSelectorPreview({ initialValue = 'sms', showActions = true, showSummary = true }) {
  const data = createMessagingOnboardingData({ selectedChannel: initialValue });
  const [selectedChannel, setSelectedChannel] = useState(initialValue);
  const selectedChannelOption = findChannelOption(data, selectedChannel);

  return (
    <OnboardingPreviewFrame width={900}>
      <OnboardingChannelSelector
        onValueChange={setSelectedChannel}
        options={data.channelOptions}
        value={selectedChannel}
      />
      {showSummary ? <OnboardingChannelSummary option={selectedChannelOption} /> : null}
      {showActions ? (
        <OnboardingStepActions
          primaryIcon={ChevronRight}
          primaryLabel="이 채널로 시작하기"
          secondaryLabel="나중에 선택하기"
        />
      ) : null}
    </OnboardingPreviewFrame>
  );
}

function OnboardingTaskListPreview({ values }) {
  const initialValue = asString(values, 'selectedChannel', 'sms');
  const [selectedChannel, setSelectedChannel] = useState(initialValue);
  const data = createMessagingOnboardingData({ selectedChannel });
  const selectedChannelOption = findChannelOption(data, selectedChannel);
  const tasks = data.tasks.map((task) => {
    if (task.id === 'choose-channel') {
      return {
        ...task,
        children: (
          <>
            <OnboardingChannelSelector
              onValueChange={setSelectedChannel}
              options={data.channelOptions}
              value={selectedChannel}
            />
            <OnboardingChannelSummary option={selectedChannelOption} />
            <OnboardingStepActions
              primaryIcon={ChevronRight}
              primaryLabel="이 채널로 시작하기"
              secondaryLabel="나중에 선택하기"
            />
          </>
        ),
      };
    }

    if (task.id !== 'send-message') {
      return task;
    }

    return {
      ...task,
      description: selectedChannelOption?.sendStepDescription ?? task.description,
      children: asBoolean(values, 'showCode') ? (
        <OnboardingCodePanel
          examples={data.codeExamples}
          footer={renderCodePanelFooter({ footer: true })}
        />
      ) : null,
    };
  });

  return (
    <OnboardingSurface width={980}>
      <div style={{ padding: 40 }}>
        <OnboardingTaskList
          description={asString(values, 'description')}
          tasks={tasks}
          title={asString(values, 'title', '첫 메시지를 발송해 보세요')}
        />
      </div>
    </OnboardingSurface>
  );
}

function renderCodePanelFooter(values) {
  if (!asBoolean(values, 'footer')) return null;

  return (
    <OnboardingActionButton icon={Send} variant="primary">
      메시지 보내기
    </OnboardingActionButton>
  );
}

const tabsItems = [
  { label: 'Node.js', value: 'node' },
  { label: 'PHP', value: 'php' },
  { label: 'Python', value: 'python' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Go', value: 'go' },
];

const resourceIconMap = {
  domain: RadioTower,
  message: MessageSquareText,
  shield: ShieldCheck,
};

export const onboardingEntries = [
  {
    id: 'topbar',
    name: 'OnboardingTopbar',
    path: 'src/components/onboarding/OnboardingTopbar.jsx',
    description: 'Source-visible onboarding support bar with docs and help actions.',
    controls: [
      { id: 'helpLabel', label: 'helpLabel', type: 'text', defaultValue: '도움이 필요하신가요?' },
      { id: 'shortcut', label: 'shortcut', type: 'text', defaultValue: 'H' },
    ],
    render(values) {
      return (
        <OnboardingSurface width={860}>
          <OnboardingTopbar
            helpLabel={asString(values, 'helpLabel', '도움이 필요하신가요?')}
            shortcut={asString(values, 'shortcut', 'H')}
          />
        </OnboardingSurface>
      );
    },
  },
  {
    id: 'action-button',
    name: 'OnboardingActionButton',
    path: 'src/components/onboarding/OnboardingActionButton.jsx',
    description: 'Small source-style pill action used by onboarding steps and code panel footer.',
    controls: [
      { id: 'label', label: 'children', type: 'text', defaultValue: '이 채널로 시작하기' },
      { id: 'variant', label: 'variant', type: 'select', options: ['primary', 'secondary'], defaultValue: 'primary' },
      { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: false },
      { id: 'icon', label: 'icon', type: 'select', options: ['chevron', 'send', 'lock', 'none'], defaultValue: 'chevron' },
    ],
    render(values) {
      const icon = values.icon === 'send'
        ? Send
        : values.icon === 'lock'
          ? Lock
          : values.icon === 'chevron'
            ? ChevronRight
            : null;

      return (
        <OnboardingActionButton
          disabled={asBoolean(values, 'disabled')}
          icon={icon}
          variant={asString(values, 'variant', 'primary')}
        >
          {asString(values, 'label', '이 채널로 시작하기')}
        </OnboardingActionButton>
      );
    },
  },
  {
    id: 'tabs',
    name: 'OnboardingTabs',
    path: 'src/components/onboarding/OnboardingTabs.jsx',
    description: 'Keyboardable source-style language tabs with roving focus.',
    controls: [
      { id: 'selectedValue', label: 'selectedValue', type: 'select', options: ['node', 'php', 'python', 'ruby', 'go'], defaultValue: 'node' },
    ],
    render(values) {
      return (
        <OnboardingPreviewFrame width={560}>
          <OnboardingTabs
            items={tabsItems}
            label="Code language"
            selectedValue={asString(values, 'selectedValue', 'node')}
          />
        </OnboardingPreviewFrame>
      );
    },
  },
  {
    id: 'code-panel',
    name: 'OnboardingCodePanel',
    path: 'src/components/onboarding/OnboardingCodePanel.jsx',
    description: 'Composable code panel with language tabs, copy feedback, and optional footer action slot.',
    controls: [
      { id: 'defaultValue', label: 'defaultValue', type: 'select', options: ['node', 'php', 'python', 'ruby', 'go', 'curl'], defaultValue: 'node' },
      { id: 'footer', label: 'footer', type: 'boolean', defaultValue: true },
    ],
    render(values) {
      const data = createMessagingOnboardingData();

      return (
        <OnboardingPreviewFrame width={900}>
          <OnboardingCodePanel
            defaultValue={asString(values, 'defaultValue', 'node')}
            examples={data.codeExamples}
            footer={renderCodePanelFooter(values)}
          />
        </OnboardingPreviewFrame>
      );
    },
  },
  {
    id: 'channel-selector',
    name: 'OnboardingChannelSelector',
    path: 'src/components/onboarding/OnboardingChannelSelector.jsx',
    description: '첫 발송 채널을 고르는 라디오 카드 묶음입니다. 선택 카드, 요약, 단계 액션을 분리해 조합할 수 있습니다.',
    controls: [
      { id: 'selectedChannel', label: 'initial channel', type: 'select', options: ['sms', 'alimtalk', 'brand-message'], defaultValue: 'sms' },
      { id: 'showSummary', label: 'show summary', type: 'boolean', defaultValue: true },
      { id: 'showActions', label: 'show actions', type: 'boolean', defaultValue: true },
    ],
    render(values) {
      const selectedChannel = asString(values, 'selectedChannel', 'sms');

      return (
        <OnboardingChannelSelectorPreview
          key={selectedChannel}
          initialValue={selectedChannel}
          showActions={asBoolean(values, 'showActions')}
          showSummary={asBoolean(values, 'showSummary')}
        />
      );
    },
  },
  {
    id: 'step-card',
    name: 'OnboardingStepCard',
    path: 'src/components/onboarding/OnboardingStepCard.jsx',
    description: 'Timeline step frame with current, locked, completed, and pending status markers.',
    controls: [
      { id: 'status', label: 'status', type: 'select', options: ['current', 'locked', 'completed', 'pending'], defaultValue: 'current' },
      { id: 'title', label: 'title', type: 'text', defaultValue: '어떤 메시지로 시작할까요?' },
      { id: 'description', label: 'description', type: 'text', defaultValue: '처음 발송할 목적과 준비 상태에 맞춰 채널을 선택하세요.' },
      { id: 'showAction', label: 'show action', type: 'boolean', defaultValue: true },
      { id: 'actionLabel', label: 'action label', type: 'text', defaultValue: '이 채널로 시작하기' },
    ],
    render(values) {
      return (
        <OnboardingSurface width={760}>
          <div style={{ padding: '28px 40px' }}>
            <OnboardingStepCard
              action={renderStepAction(values)}
              description={asString(values, 'description')}
              status={asString(values, 'status', 'current')}
              title={asString(values, 'title', '어떤 메시지로 시작할까요?')}
            />
          </div>
        </OnboardingSurface>
      );
    },
  },
  {
    id: 'resource-card',
    name: 'OnboardingResourceCard',
    path: 'src/components/onboarding/OnboardingResourceCard.jsx',
    description: '다음 설정 영역에 쓰는 카드입니다. 배지, 설명, 하단 액션, 비활성 상태를 함께 확인합니다.',
    controls: [
      { id: 'title', label: 'title', type: 'text', defaultValue: '발신 채널 연결' },
      { id: 'description', label: 'description', type: 'text', defaultValue: '카카오, 문자, 이메일 등 실제 발송에 사용할 채널을 연결합니다.' },
      { id: 'badge', label: 'badge', type: 'text', defaultValue: '추천' },
      { id: 'actionLabel', label: 'actionLabel', type: 'text', defaultValue: '채널 연결하기' },
      { id: 'disabled', label: 'disabled', type: 'boolean', defaultValue: true },
      { id: 'icon', label: 'icon', type: 'select', options: ['domain', 'message', 'shield'], defaultValue: 'domain' },
    ],
    render(values) {
      return (
        <OnboardingPreviewFrame width={320}>
          <OnboardingResourceCard
            actionLabel={asString(values, 'actionLabel', '채널 연결하기')}
            badge={asString(values, 'badge')}
            description={asString(values, 'description')}
            disabled={asBoolean(values, 'disabled')}
            href="#resource"
            icon={resourceIconMap[values.icon] ?? RadioTower}
            title={asString(values, 'title', '발신 채널 연결')}
          />
        </OnboardingPreviewFrame>
      );
    },
  },
  {
    id: 'task-list',
    name: 'OnboardingTaskList',
    path: 'src/components/onboarding/OnboardingTaskList.jsx',
    description: '메시징 온보딩 타이틀, 타임라인, 현재 단계, 잠긴 테스트 발송 단계를 함께 보여줍니다.',
    controls: [
      { id: 'title', label: 'title', type: 'text', defaultValue: '첫 메시지를 발송해 보세요' },
      { id: 'description', label: 'description', type: 'text', defaultValue: '발신 설정부터 테스트 발송까지, 메시지가 실제로 나가는 흐름을 한 번에 확인해 보세요.' },
      { id: 'selectedChannel', label: 'initial channel', type: 'select', options: ['sms', 'alimtalk', 'brand-message'], defaultValue: 'sms' },
      { id: 'showCode', label: 'show code panel', type: 'boolean', defaultValue: true },
    ],
    render(values) {
      return <OnboardingTaskListPreview key={asString(values, 'selectedChannel', 'sms')} values={values} />;
    },
  },
  {
    id: 'sidebar',
    name: 'OnboardingSidebar',
    path: 'src/components/onboarding/OnboardingSidebar.jsx',
    description: 'Optional source-shell sidebar component. It is exported but not used by the corrected onboarding preview.',
    controls: [
      { id: 'active', label: 'active item', type: 'select', options: ['overview', 'sender', 'templates', 'send'], defaultValue: 'overview' },
    ],
    render(values) {
      const data = createMessagingOnboardingData();
      const navGroups = data.navGroups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          active: item.id === values.active,
        })),
      }));

      return (
        <OnboardingSurface width={300}>
          <div style={{ height: 560, position: 'relative' }}>
            <OnboardingSidebar
              account={data.account}
              navGroups={navGroups}
              utilityItems={data.utilityItems}
              workspace={data.workspace}
            />
          </div>
        </OnboardingSurface>
      );
    },
  },
  {
    id: 'shell',
    name: 'OnboardingShell',
    path: 'src/components/onboarding/OnboardingShell.jsx',
    description: 'Slot-based shell that composes topbar and onboarding content. Sidebar is previewed separately to avoid fixed-position stage overlap.',
    controls: [
      { id: 'topbar', label: 'topbar', type: 'boolean', defaultValue: true },
    ],
    render(values) {
      const data = createMessagingOnboardingData();

      return (
        <OnboardingSurface width={980}>
          <OnboardingShell
            topbar={asBoolean(values, 'topbar') ? <OnboardingTopbar /> : null}
          >
            <OnboardingTaskList
              description={data.header.description}
              tasks={data.tasks}
              title={data.header.title}
            />
          </OnboardingShell>
        </OnboardingSurface>
      );
    },
  },
];
