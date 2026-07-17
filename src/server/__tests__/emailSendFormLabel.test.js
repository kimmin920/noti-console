import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EmailSendFormLabel } from '../../components/ui/EmailSendForm.jsx';

describe('EmailSendFormLabel', () => {
  it('renders an accessible description tooltip trigger when description is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        EmailSendFormLabel,
        { description: '승인 완료된 발신번호 중 하나를 선택합니다.' },
        '발신번호'
      )
    );

    expect(html).toContain('email-send-form-label-description-tooltip');
    expect(html).toContain('email-send-form-label-description-icon');
    expect(html).toContain('aria-label="승인 완료된 발신번호 중 하나를 선택합니다."');
    expect(html).toContain('tabindex="0"');
  });

  it('does not render a description icon when description is omitted', () => {
    const html = renderToStaticMarkup(
      React.createElement(EmailSendFormLabel, null, '발신번호')
    );

    expect(html).not.toContain('email-send-form-label-description-icon');
  });
});
