import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createApiFixtureState,
  installApiFixtures,
  installStandaloneSentinel,
} from './fixtures/api-fixtures.js';
import { createSdkInitScript } from './fixtures/sdk-init.js';

const EVIDENCE_DIR = '.omo/evidence/task-8-publ-client-boundary-routing-hardening';
const APPROVED_PARENT = 'http://127.0.0.1:3411';
const DENIED_PARENT = 'http://127.0.0.1:3412';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(createSdkInitScript());
});

test('approved parent renders prefixed Publ console without overflow', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installApiFixtures(page, apiState);

  await page.goto(`${APPROVED_PARENT}/frame?path=/publ-client/logs?channel=sms&from=2026-07-01&to=2026-07-10`);
  const frame = await getPublFrame(page);

  await expect(frame.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect(frame.getByRole('link', { name: '발송기록' })).toHaveAttribute('href', '/publ-client/logs');
  await expect(frame.getByRole('link', { name: '예약' })).toHaveAttribute('href', '/publ-client/reservations');
  await expect(frame.getByRole('link', { name: '템플릿' })).toHaveAttribute('href', '/publ-client/templates');
  await expect(frame.getByRole('button', { name: 'CSV 내보내기' })).toHaveCount(0);
  await expect(frame.getByText('내 프로필')).toHaveCount(0);
  await expect(frame.getByText('관리', { exact: true })).toHaveCount(0);
  await assertNoHorizontalOverflow(frame);

  await evidence.capture({ apiState, frame, label: 'approved-console' });
});

test('unapproved parent cannot frame the Publ client', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  await installApiFixtures(page, createApiFixtureState());

  await page.goto(`${DENIED_PARENT}/frame?path=/publ-client/message-send`);

  await expect(page.locator('iframe[data-testid="publ-frame"]')).toBeVisible();
  await expect.poll(() => page.frames().some((frame) => isPublClientFrameUrl(frame.url()))).toBeFalsy();

  await evidence.capture({ frame: page, label: 'denied-parent' });
});

test('top-level Publ paths strip valid prefixes and keep invalid paths local', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const standaloneAssertions = [];
  await installApiFixtures(page, createApiFixtureState());
  await installStandaloneSentinel(page, standaloneAssertions);

  await page.goto('http://127.0.0.1:3410/publ-client/logs?channel=sms&page=2');
  await expect(page.getByTestId('standalone-sentinel')).toHaveText('/logs?channel=sms&page=2');

  await page.goto('http://127.0.0.1:3410/publ-client/not-a-route?keep=1');
  await expect(page.getByRole('heading', { name: '열 수 없는 경로입니다' })).toBeVisible();
  await expect(page).toHaveURL(/\/publ-client\/not-a-route\?keep=1$/u);

  expect(standaloneAssertions).toContainEqual({ pathname: '/logs', search: '?channel=sms&page=2' });
  await evidence.capture({
    extra: { standaloneAssertions },
    frame: page,
    label: 'top-level-routing',
  });
});

test('fresh reload exchanges again, same-document navigation preserves session, and detail links keep params', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installApiFixtures(page, apiState);

  await page.goto(`${APPROVED_PARENT}/frame?path=/publ-client/logs?channel=sms&from=2026-07-01&to=2026-07-10`);
  let frame = await getPublFrame(page);
  await expect(frame.getByText('E2E log')).toBeVisible();
  await expect(frame.getByRole('link', { name: '설정' })).toHaveAttribute('href', '/publ-client/settings');
  const initialCounters = await getSdkCounters(frame);
  await activateFrameLink(frame, '예약');
  await expectFrameUrl(frame, /\/publ-client\/reservations/u);
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: initialCounters.exchangeCount });

  await activateFrameLink(frame, '발송기록');
  await expectFrameUrl(frame, /\/publ-client\/logs/u);
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: initialCounters.exchangeCount });

  await activateFrameLink(frame, '템플릿');
  await expectFrameUrl(frame, /\/publ-client\/templates/u);
  await activateFrameLink(frame, '자동화');
  await expectFrameUrl(frame, /\/publ-client\/automations/u);

  await frame.goto('http://127.0.0.1:3410/publ-client/logs/log-1?channel=sms&from=2026-07-01&to=2026-07-10');
  await expectFrameUrl(frame, /\/publ-client\/logs\/log-1\?channel=sms&from=2026-07-01&to=2026-07-10/u);
  await expect(frame.getByText('E2E log')).toBeVisible();

  await frame.goto('http://127.0.0.1:3410/publ-client/reservations/reservation-1?channel=sms&from=2026-07-01&to=2026-07-10');
  await expectFrameUrl(frame, /\/publ-client\/reservations\/reservation-1\?channel=sms&from=2026-07-01&to=2026-07-10/u);

  await frame.goto('http://127.0.0.1:3410/publ-client/templates/sms/TPL-1?senderResourceId=sender-1');
  await expectFrameUrl(frame, /\/publ-client\/templates\/sms\/TPL-1\?senderResourceId=sender-1/u);

  await frame.goto('http://127.0.0.1:3410/publ-client/automations/rule-1?tab=history');
  await expectFrameUrl(frame, /\/publ-client\/automations\/rule-1\?tab=history/u);

  await page.reload();
  frame = await getPublFrame(page);
  await expect.poll(async () => {
    const counters = await getSdkCounters(frame);
    return counters.exchangeCount > initialCounters.exchangeCount;
  }).toBe(true);
  await assertNoHorizontalOverflow(frame);

  await evidence.capture({ apiState, frame, label: 'route-preservation' });
});

test('stale standalone iframe sends no Publ auth and simultaneous 401s refresh once', async ({ context, page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installApiFixtures(page, apiState);

  const standalonePage = await context.newPage();
  await installApiFixtures(standalonePage, apiState);
  await installStandaloneSentinel(standalonePage, []);
  await standalonePage.setContent('<iframe data-testid="standalone" src="http://127.0.0.1:3410/message-send"></iframe>');
  const standalone = standalonePage.frameLocator('iframe[data-testid="standalone"]');
  await expect(standalone.getByTestId('standalone-sentinel')).toHaveText('/message-send');
  await standalonePage.frame({ url: /\/message-send/u }).evaluate(() => {
    sessionStorage.setItem('vizuo:publPapp:accessToken', 'stale-token');
    sessionStorage.setItem('vizuo:publPapp:refreshToken', 'stale-refresh');
  });
  await standalonePage.frame({ url: /\/message-send/u }).evaluate(async () => {
    await fetch('/api/me');
  });
  await standalonePage.close();
  expect(apiState.requestHeaders.some((entry) => entry.authorization)).toBeFalsy();

  await page.goto(`${APPROVED_PARENT}/frame?path=/publ-client/message-send`);
  const frame = await getPublFrame(page);
  await expect(frame.getByRole('heading', { name: '메시지 발송' })).toBeVisible();
  await expect.poll(() => frame.evaluate(() => typeof window.__VIZUO_E2E_RELAY_GET__)).toBe('function');
  apiState.unauthorizedBudget = 2;
  await frame.evaluate(async () => {
    await Promise.allSettled([
      window.__VIZUO_E2E_RELAY_GET__('/api/me'),
      window.__VIZUO_E2E_RELAY_GET__('/api/sender-resources'),
    ]);
  });
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ refreshCount: 1 });
  expect(apiState.unauthorizedHits).toBe(2);

  await evidence.capture({ apiState, frame, label: 'stale-and-refresh' });
});

test('permission denial renders recipient capability state without CSV access', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installApiFixtures(page, apiState);
  await page.addInitScript(() => {
    window.__VIZUO_PUBL_DENY_CONTACTS_ON_LOAD__ = true;
    const interval = window.setInterval(() => {
      if (window.__VIZUO_PUBL_E2E__) {
        window.__VIZUO_PUBL_E2E__.denyContacts = true;
        window.clearInterval(interval);
      }
    }, 0);
  });

  await page.goto(`${APPROVED_PARENT}/frame?path=/publ-client/audience`);
  const frame = await getPublFrame(page);

  await expect(frame.getByText('Publ 수신자 조회 권한이 없습니다')).toBeVisible();
  await activateFrameLink(frame, '발송기록');
  await expect(frame.getByRole('button', { name: 'CSV 내보내기' })).toHaveCount(0);
  await assertNoHorizontalOverflow(frame);

  await evidence.capture({ apiState, frame, label: 'permission-denied' });
});

async function getPublFrame(page) {
  await expect(page.locator('iframe[data-testid="publ-frame"]')).toBeVisible();
  await expect.poll(() => page.frames().find((candidate) => isPublClientFrameUrl(candidate.url()))?.url()).toContain('/publ-client');
  return page.frames().find((candidate) => isPublClientFrameUrl(candidate.url()));
}

function isPublClientFrameUrl(value) {
  try {
    return new URL(value).pathname.startsWith('/publ-client');
  } catch {
    return false;
  }
}

async function getSdkCounters(frame) {
  return frame.evaluate(() => ({
    exchangeCount: window.__VIZUO_PUBL_E2E__?.exchangeCount ?? 0,
    refreshCount: window.__VIZUO_PUBL_E2E__?.refreshCount ?? 0,
  }));
}

async function assertNoHorizontalOverflow(frame) {
  const overflow = await frame.evaluate(() => {
    const root = document.documentElement;
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
    };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

async function activateFrameLink(frame, name) {
  await frame.getByRole('link', { name }).evaluate((element) => element.click());
}

async function expectFrameUrl(frame, pattern) {
  await expect.poll(() => frame.url()).toMatch(pattern);
}

function createEvidenceRecorder(page, testInfo) {
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(redact(message.text()));
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      failure: redact(request.failure()?.errorText ?? ''),
      method: request.method(),
      url: redactUrl(request.url()),
    });
  });

  return {
    async capture({ apiState = null, extra = {}, frame, label }) {
      await mkdir(projectEvidencePath(testInfo.project.name), { recursive: true });
      const screenshotPath = path.join(projectEvidencePath(testInfo.project.name), `${label}.png`);
      await captureScreenshot(frame, screenshotPath);
      const counters = frame.evaluate ? await getSdkCounters(frame).catch(() => ({})) : {};
      const finalUrl = frame.url ? frame.url() : page.url();
      await writeJson(testInfo.project.name, `${label}.json`, {
        apiRequestHeaders: apiState?.requestHeaders ?? [],
        consoleErrors,
        counters,
        extra,
        failedRequests,
        finalUrl: redactUrl(finalUrl),
        screenshotPath,
      });
    },
  };
}

async function captureScreenshot(frameOrPage, screenshotPath) {
  if (typeof frameOrPage.locator === 'function') {
    await frameOrPage.locator('body').screenshot({ path: screenshotPath });
    return;
  }

  await frameOrPage.screenshot({ fullPage: true, path: screenshotPath });
}

async function writeJson(projectName, fileName, payload) {
  await writeFile(
    path.join(projectEvidencePath(projectName), fileName),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8'
  );
}

function projectEvidencePath(projectName) {
  return path.join(EVIDENCE_DIR, projectName);
}

function redact(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gu, 'Bearer <redacted>')
    .replace(/vizuo:publPapp:[A-Za-z]+/gu, 'vizuo:publPapp:<redacted>');
}

function redactUrl(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}${url.search}`;
}
