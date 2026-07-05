import { describe, expect, it } from 'vitest';

import {
  countPublEventCatalogSource,
  parsePublEventCatalogSource,
} from '../publEvents/importer.js';

describe('PUBL event legacy source parser', () => {
  it('extracts counts from nested events[].props without treating source JSON as a DB sync target', () => {
    const counts = countPublEventCatalogSource({
      props: [{ alias: 'topLevelShouldNotCount' }],
      events: [
        createSourceEvent({ eventKey: 'EVENT_A', props: [createProp({ alias: 'one' })] }),
        createSourceEvent({
          eventKey: 'EVENT_B',
          props: [
            createProp({ alias: 'two', enabled: true, sortOrder: 0 }),
            createProp({ alias: 'three', parserPipeline: [{ type: 'join', separator: ', ' }], sortOrder: 1 }),
          ],
        }),
      ],
    });

    expect(counts).toEqual({
      events: 2,
      props: 3,
      enabledProps: 1,
      requiredProps: 3,
      parserSteps: 1,
    });
  });

  it('preserves sample, boolean, and object prop metadata for parity checks', () => {
    const parsed = parsePublEventCatalogSource({
      events: [
        createSourceEvent({
          eventKey: 'EVENT_WITH_STRUCTURED_TYPES',
          props: [
            createProp({ alias: 'isMember', sample: 'true', type: 'boolean' }),
            createProp({ alias: 'metadata', label: 'Metadata', rawPath: 'metadata', sortOrder: 1, type: 'object' }),
          ],
        }),
      ],
    });

    expect(parsed.events[0].props.map((prop) => [prop.alias, prop.type, prop.sample])).toEqual([
      ['isMember', 'boolean', 'true'],
      ['metadata', 'object', null],
    ]);
  });

  it('does not expose removed category metadata from the legacy source shape', () => {
    const parsed = parsePublEventCatalogSource({
      events: [createSourceEvent({ category: 'REMOVED_CATEGORY' })],
    });

    expect(parsed.events[0]).not.toHaveProperty('category');
  });

  it('ignores rules and default template/provider template metadata', () => {
    const parsed = parsePublEventCatalogSource({
      events: [
        createSourceEvent({
          eventKey: 'EVENT_WITH_RULES',
          defaultTemplate: {
            templateCode: 'TEMPLATE_SHOULD_NOT_IMPORT',
            matches: [{ providerTemplateId: 'provider_template_1' }],
          },
          rules: [
            {
              providerTemplateId: 'provider_template_2',
              senderProfile: { plusFriendId: '@provider-profile' },
            },
          ],
        }),
      ],
    });

    expect(parsed.events[0]).not.toHaveProperty('rules');
    expect(parsed.events[0]).not.toHaveProperty('defaultTemplate');
    expect(JSON.stringify(parsed.events)).not.toContain('TEMPLATE_SHOULD_NOT_IMPORT');
    expect(JSON.stringify(parsed.events)).not.toContain('provider_template_1');
    expect(JSON.stringify(parsed.events)).not.toContain('provider_template_2');
    expect(JSON.stringify(parsed.events)).not.toContain('@provider-profile');
  });
});

function createSourceEvent(overrides = {}) {
  return {
    eventKey: 'EVENT_KEY',
    displayName: 'Event display',
    category: 'Legacy category',
    locationType: 'GENERAL',
    locationId: 'CHANNEL',
    sourceType: 'ACCOUNT',
    actionType: 'REGISTER',
    serviceStatus: 'ACTIVE',
    defaultTemplate: {
      templateCode: 'IGNORED_TEMPLATE',
    },
    rules: [{ providerTemplateId: 'IGNORED_PROVIDER_TEMPLATE' }],
    props: [createProp()],
    ...overrides,
  };
}

function createProp(overrides = {}) {
  return {
    sortOrder: 0,
    rawPath: 'targetName',
    alias: 'targetName',
    label: 'Target name',
    type: 'text',
    required: true,
    enabled: false,
    fallback: null,
    parserPipeline: null,
    sample: undefined,
    description: null,
    ...overrides,
  };
}
