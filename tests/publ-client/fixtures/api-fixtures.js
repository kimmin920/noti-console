const JSON_HEADERS = {
  'access-control-allow-origin': '*',
  'content-type': 'application/json; charset=utf-8',
};

const apiResponses = [
  [/^\/api\/me$/u, { actor: { id: 'publ-user-e2e', source: 'publ' }, isOperator: false }],
  [/^\/api\/sender-resources$/u, { applications: [], resources: [] }],
  [/^\/api\/metrics\/summary/u, { cards: [], points: [] }],
  [/^\/api\/message-log-groups\/log-1/u, {
    group: {
      channel: 'sms',
      id: 'log-1',
      managementTitle: 'E2E log',
      totalRecipientCount: 1,
    },
    requests: [],
  }],
  [/^\/api\/message-log-groups/u, {
    channel: 'sms',
    groups: [
      {
        actions: { detailHref: '/logs/log-1?channel=sms&from=2026-07-01&to=2026-07-10' },
        channel: 'sms',
        id: 'log-1',
        managementTitle: 'E2E log',
        totalRecipientCount: 1,
      },
    ],
    hasNextPage: false,
    page: 1,
    pageSize: 20,
    total: 1,
  }],
  [/^\/api\/message-reservation-groups\/reservation-1/u, {
    group: {
      channel: 'sms',
      id: 'reservation-1',
      managementTitle: 'E2E reservation',
    },
    recipients: [],
  }],
  [/^\/api\/message-reservations/u, {
    channel: 'sms',
    groups: [
      {
        channel: 'sms',
        id: 'reservation-1',
        managementTitle: 'E2E reservation',
        requestDate: '2026-07-10 10:00:00',
      },
    ],
    hasNextPage: false,
    total: 1,
  }],
  [/^\/api\/templates\/sms/u, { channel: 'sms', templates: [] }],
  [/^\/api\/templates\/alimtalk/u, { channel: 'alimtalk', templates: [] }],
  [/^\/api\/templates\/brand/u, { channel: 'brand-message', templates: [] }],
  [/^\/api\/templates\/[^/]+\/[^/]+/u, {
    channel: 'sms',
    template: {
      body: 'Template body',
      channel: 'sms',
      templateCode: 'TPL-1',
    },
  }],
  [/^\/api\/automations\/rules\/rule-1/u, {
    rule: {
      id: 'rule-1',
      name: 'E2E automation',
      status: 'disabled',
    },
    revisions: [],
  }],
  [/^\/api\/automations\/rules/u, {
    rules: [
      {
        eventKey: 'ORDER_READY',
        id: 'rule-1',
        name: 'E2E automation',
        status: 'disabled',
      },
    ],
  }],
  [/^\/api\/automations\/unsent/u, { deliveries: [] }],
  [/^\/api\/publ-events\/ORDER_READY/u, {
    event: {
      displayName: 'Order ready',
      eventKey: 'ORDER_READY',
      id: 'event-1',
      variableOptions: [],
    },
  }],
  [/^\/api\/publ-events/u, {
    events: [
      {
        displayName: 'Order ready',
        eventKey: 'ORDER_READY',
        id: 'event-1',
        variableOptions: [],
      },
    ],
  }],
  [/^\/api\/admin\/sender-resource-applications/u, { applications: [], operatorUserId: 'operator-e2e' }],
  [/^\/api\/limit-increase-requests/u, { requests: [] }],
];

export async function installApiFixtures(page, state) {
  await page.route('**/api/**', async (route, request) => {
    const url = new URL(request.url());
    const authorization = request.headers().authorization ?? '';
    state.requestHeaders.push({
      authorization: redactAuthorization(authorization),
      method: request.method(),
      pathname: url.pathname,
    });

    if (state.unauthorizedBudget > 0 && url.pathname.startsWith('/api/')) {
      state.unauthorizedHits += 1;
      state.unauthorizedBudget -= 1;
      await delay(50);
      await route.fulfill({
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'refresh required',
            retryable: true,
            source: 'relay',
          },
          ok: false,
        }),
        headers: JSON_HEADERS,
        status: 401,
      });
      return;
    }

    const match = apiResponses.find(([pattern]) => pattern.test(url.pathname));
    await route.fulfill({
      body: JSON.stringify({ data: match?.[1] ?? {}, ok: true }),
      headers: JSON_HEADERS,
      status: 200,
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function installStandaloneSentinel(page, assertions) {
  await page.route(/^http:\/\/127\.0\.0\.1:3410\/(message-send|logs|reservations|templates|automations|settings|admin)(\/.*)?(\?.*)?$/u, async (route) => {
    const url = new URL(route.request().url());
    assertions.push({ pathname: url.pathname, search: url.search });
    await route.fulfill({
      body: `<!doctype html><title>standalone sentinel</title><main data-testid="standalone-sentinel">${url.pathname}${url.search}</main>`,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      status: 200,
    });
  });
}

export function createApiFixtureState() {
  return {
    requestHeaders: [],
    unauthorizedBudget: 0,
    unauthorizedHits: 0,
  };
}

function redactAuthorization(value) {
  if (!value) return '';
  return value.startsWith('Bearer ') ? 'Bearer <redacted>' : '<redacted>';
}
