import type { ReactNode } from 'react';

export type ApiDrawerSdk =
  | '.NET'
  | 'CLI'
  | 'Go'
  | 'Java'
  | 'Node.js'
  | 'PHP'
  | 'Python'
  | 'Ruby'
  | 'Rust'
  | 'cURL';

export type ApiDrawerCodeMap = Partial<Record<ApiDrawerSdk, string>>;

export type ApiDrawerSectionData = {
  readonly code: ApiDrawerCodeMap;
  readonly description?: ReactNode;
  readonly href?: string;
  readonly title: string;
};
