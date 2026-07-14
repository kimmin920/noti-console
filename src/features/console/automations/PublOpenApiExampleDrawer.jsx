'use client';

import { useMemo } from 'react';

import { CodeGroup } from '../../../components/docs/index.js';
import {
  CopyableSlot,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../../../components/ui/index.js';
import { buildPublOpenApiExample } from './openApiCodeExampleModel.js';

export function PublOpenApiExampleDrawer({
  event,
  eventKey,
  onOpenChange,
  open,
  trigger = null,
}) {
  const example = useMemo(() => buildPublOpenApiExample({ event, eventKey }), [event, eventKey]);
  const snippets = useMemo(() => [
    {
      code: example.snippets.curl,
      label: 'cURL',
      language: 'bash',
      value: 'curl',
    },
    {
      code: example.snippets.fetch,
      label: 'fetch',
      language: 'javascript',
      value: 'fetch',
    },
  ], [example.snippets.curl, example.snippets.fetch]);

  return (
    <Drawer onOpenChange={onOpenChange} open={open}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent className="publ-open-api-example-drawer" title="PUBL Open API 예시">
        <DrawerHeader>
          <DrawerTitle>PUBL Open API 예시</DrawerTitle>
          <DrawerDescription>
            {example.requestEnvelope.eventKey}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <div className="publ-open-api-example-stack">
            <section className="publ-open-api-example-section" aria-label="Open API 요청 정보">
              <div className="publ-open-api-example-meta">
                <CopyableSlot label="Method" value={example.method} />
                <CopyableSlot label="Endpoint" value={example.endpointPath} />
                <CopyableSlot label="Secret env" value={example.secretEnvVar} />
                <CopyableSlot label="Event key" value={example.requestEnvelope.eventKey} />
              </div>
            </section>

            <section className="publ-open-api-example-section" aria-label="Open API 헤더">
              <h3>Headers</h3>
              <div className="publ-open-api-example-meta">
                {Object.entries(example.headers).map(([header, value]) => (
                  <CopyableSlot key={header} label={header} value={value} />
                ))}
              </div>
            </section>

            <section className="publ-open-api-example-section" aria-label="Open API 코드 예시">
              <h3>Code</h3>
              <CodeGroup defaultValue="curl" items={snippets} label="PUBL Open API code examples" />
            </section>

            <p className="publ-open-api-example-guardrail">
              예시는 placeholder 값만 사용합니다. 실제 secret, 원본 payload, 수신번호, provider 본문은 브라우저에 표시하지 않습니다.
            </p>
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
