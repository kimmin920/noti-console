'use client';

import { AutomationSendMessageNode } from './AutomationSendMessageNode.jsx';

export function AutomationSendEmailNode({ title = 'Send email', ...props }) {
  return <AutomationSendMessageNode title={title} {...props} />;
}
