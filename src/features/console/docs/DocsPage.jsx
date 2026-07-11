'use client';

import { X } from 'lucide-react';
import { CodeGroup, DocsCallout, DocsCard, DocsCardGrid, DocsSection } from '../../../components/docs/index.js';
import { PageHeader } from '../../../components/layout/index.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../components/ui/index.js';

export function DocsPage({ meta }) {
  const snippets = [
    {
      code: `curl -X POST https://api.resend.com/emails \\
  -H "Authorization: Bearer $RESEND_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"from":"onboarding@example.com","to":"user@example.com","subject":"Hello","html":"<p>Welcome</p>"}'`,
      label: 'cURL',
      language: 'bash',
      value: 'curl',
    },
    {
      code: `await resend.emails.send({
  from: 'onboarding@example.com',
  to: 'user@example.com',
  subject: 'Hello',
  html: '<p>Welcome</p>',
});`,
      label: 'Node.js',
      language: 'javascript',
      value: 'node',
    },
  ];

  return (
    <section className="page-frame docs-page">
      <PageHeader title={meta.title} />
      <div className="docs-shell docs-light">
        <aside className="docs-page-sidebar" aria-label="문서 탐색">
          <Accordion defaultValue="sending">
            <AccordionItem value="sending">
              <AccordionTrigger>Sending</AccordionTrigger>
              <AccordionContent>
                <a href="#send-message">Send message</a>
                <a href="#events">Events</a>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="resources">
              <AccordionTrigger>Resources</AccordionTrigger>
              <AccordionContent>
                <a href="#next-steps">Next steps</a>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>

        <article className="docs-mdx-content docs-page-content">
          <DocsSection id="send-message" title="Send message">
            <p>Use a verified sender, recipient, subject, and body to create a transactional message.</p>
            <DocsCallout title="Sender required" variant="info">
              <p>Messages need a verified sender before production traffic is accepted.</p>
            </DocsCallout>
            <CodeGroup defaultValue="curl" items={snippets} />
          </DocsSection>

          <DocsSection id="events" title="Events">
            <p>Webhook events describe delivery changes such as sent, delivered, opened, bounced, and complained.</p>
            <DocsCallout title="Retries" variant="tip">
              <p>Keep webhook handlers idempotent so repeated delivery attempts can be processed safely.</p>
            </DocsCallout>
          </DocsSection>

          <DocsSection id="next-steps" title="Next steps">
            <DocsCardGrid>
              <DocsCard href="/message-send" meta="Console" title="메시지 발송">
                문자와 카카오 메시지 발송 화면으로 이동합니다.
              </DocsCard>
              <DocsCard href="/logs" meta="Dashboard" title="발송기록">
                발송 요청과 전달 결과를 확인합니다.
              </DocsCard>
            </DocsCardGrid>
          </DocsSection>
        </article>

        <aside className="docs-page-toc" aria-label="On this page">
          <strong>On this page</strong>
          <a href="#send-message">Send message</a>
          <a href="#events">Events</a>
          <a href="#next-steps">Next steps</a>
        </aside>
      </div>
    </section>
  );
}
