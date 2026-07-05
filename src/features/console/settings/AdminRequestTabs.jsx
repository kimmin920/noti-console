'use client';

import { SegmentedControl } from '../../../components/ui/index.js';

export const ADMIN_REQUEST_TAB_VALUES = {
  LIMIT_REQUESTS: 'limit-requests',
  SENDER_APPLICATIONS: 'sender-applications',
};

const ADMIN_REQUEST_TABS = [
  { label: '한도 상향 신청', value: ADMIN_REQUEST_TAB_VALUES.LIMIT_REQUESTS },
  { label: '발신번호 신청', value: ADMIN_REQUEST_TAB_VALUES.SENDER_APPLICATIONS },
];

export function AdminRequestTabs({ onValueChange, value }) {
  return (
    <SegmentedControl
      className="admin-request-tabs"
      items={ADMIN_REQUEST_TABS}
      onValueChange={onValueChange}
      value={value}
    />
  );
}
