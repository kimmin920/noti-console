import { describe, expect, it } from 'vitest';

import {
  getMessageSendTabFromQuery,
  getMessageSendTabQueryValue,
  getSettingsTabFromQuery,
  getSettingsTabQueryValue,
  getTemplateTabFromQuery,
  getTemplateTabQueryValue,
} from '../../features/console/tabQuery.js';

describe('console tab query helpers', () => {
  it('maps message send tabs to stable query values and back', () => {
    const tabs = ['SMS', '알림톡', '브랜드 메시지'];

    expect(getMessageSendTabQueryValue('SMS')).toBe('sms');
    expect(getMessageSendTabQueryValue('알림톡')).toBe('alimtalk');
    expect(getMessageSendTabQueryValue('브랜드 메시지')).toBe('brand');
    expect(getMessageSendTabFromQuery(new URLSearchParams('tab=sms'), tabs)).toBe('SMS');
    expect(getMessageSendTabFromQuery(new URLSearchParams('tab=alimtalk'), tabs)).toBe('알림톡');
    expect(getMessageSendTabFromQuery(new URLSearchParams('tab=brand'), tabs)).toBe('브랜드 메시지');
    expect(getMessageSendTabFromQuery(new URLSearchParams('tab=unknown'), tabs)).toBe('SMS');
  });

  it('maps template tabs to the same stable query values as message send tabs', () => {
    const tabs = ['SMS', '알림톡', '브랜드 메시지'];

    expect(getTemplateTabQueryValue('SMS')).toBe('sms');
    expect(getTemplateTabQueryValue('알림톡')).toBe('alimtalk');
    expect(getTemplateTabQueryValue('브랜드 메시지')).toBe('brand');
    expect(getTemplateTabFromQuery(new URLSearchParams('tab=sms'), tabs)).toBe('SMS');
    expect(getTemplateTabFromQuery(new URLSearchParams('tab=alimtalk'), tabs)).toBe('알림톡');
    expect(getTemplateTabFromQuery(new URLSearchParams('tab=brand'), tabs)).toBe('브랜드 메시지');
    expect(getTemplateTabFromQuery(new URLSearchParams('tab=unknown'), tabs)).toBe('SMS');
  });

  it('maps settings tabs to stable query values and back', () => {
    const tabs = ['사용량', '발신 수단 관리', '청구', '연동', '프로필'];

    expect(getSettingsTabQueryValue('사용량')).toBe('usage');
    expect(getSettingsTabQueryValue('발신 수단 관리')).toBe('sender-resources');
    expect(getSettingsTabQueryValue('청구')).toBe('billing');
    expect(getSettingsTabQueryValue('연동')).toBe('integrations');
    expect(getSettingsTabQueryValue('프로필')).toBe('profile');
    expect(getSettingsTabQueryValue('수신거부 페이지')).toBe('');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=usage'), tabs)).toBe('사용량');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=sender-resources'), tabs)).toBe('발신 수단 관리');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=billing'), tabs)).toBe('청구');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=integrations'), tabs)).toBe('연동');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=profile'), tabs)).toBe('프로필');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=unsubscribe'), tabs)).toBe('사용량');
    expect(getSettingsTabFromQuery(new URLSearchParams('tab=unknown'), tabs)).toBe('사용량');
  });
});
