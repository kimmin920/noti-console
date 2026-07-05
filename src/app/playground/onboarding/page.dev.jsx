'use client';

import {
  OnboardingActionButton,
  OnboardingChannelSelector,
  OnboardingChannelSummary,
  OnboardingCodePanel,
  OnboardingResourceCard,
  OnboardingShell,
  OnboardingStepActions,
  OnboardingTaskList,
  OnboardingTopbar,
  createMessagingOnboardingData,
} from '@/components/onboarding/index.js';
import { ChevronRight, Send } from 'lucide-react';
import { useState } from 'react';

const sectionStyle = {
  display: 'grid',
  gap: 'calc(var(--spacing) * 6)',
  margin: '48px 0 0 0',
  opacity: .5,
  pointerEvents: 'none',
  userSelect: 'none',
};

const sectionHeaderStyle = {
  display: 'grid',
  gap: 'var(--spacing)',
};

const sectionTitleStyle = {
  color: 'var(--text)',
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: '26px',
  margin: 0,
};

const sectionCopyStyle = {
  color: 'var(--text-soft)',
  fontSize: '14px',
  lineHeight: '20px',
  margin: 0,
};

const resourceGridStyle = {
  display: 'grid',
  gap: 'calc(var(--spacing) * 6)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
};

export default function OnboardingPlaygroundPreviewRoute() {
  const [selectedChannel, setSelectedChannel] = useState('sms');
  const data = createMessagingOnboardingData({ selectedChannel });
  const selectedChannelOption = data.channelOptions.find((option) => option.value === selectedChannel) ?? data.channelOptions[0];
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
      children: (
        <>
          <OnboardingCodePanel
            examples={data.codeExamples}
            footer={(
              <OnboardingActionButton icon={Send} variant="primary">
                메시지 보내기
              </OnboardingActionButton>
            )}
          />
        </>
      ),
    };
  });

  return (
    <OnboardingShell topbar={<OnboardingTopbar />}>
      <OnboardingTaskList
        description={data.header.description}
        tasks={tasks}
        title={data.header.title}
      />

      <section aria-labelledby="onboarding-preview-resources" style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 id="onboarding-preview-resources" style={sectionTitleStyle}>다음 설정 살펴보기</h2>
          <p style={sectionCopyStyle}>
            발신 채널, 테스트 발송, 품질 점검까지 차례대로 열어보세요.
          </p>
        </div>

        <div style={resourceGridStyle}>
          {data.resources.map((resource) => (
            <OnboardingResourceCard
              badge={resource.badge}
              description={resource.description}
              disabled={resource.disabled}
              href={resource.href}
              icon={resource.icon}
              key={resource.id}
              actionLabel={resource.actionLabel}
              title={resource.title}
            />
          ))}
        </div>
      </section>
    </OnboardingShell>
  );
}
