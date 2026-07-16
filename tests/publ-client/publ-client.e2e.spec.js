import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  armUnauthorizedResponses,
  createApiFixtureState,
  installApiFixtures,
  installStandaloneSentinel,
} from './fixtures/api-fixtures.js';
import { createSdkInitScript } from './fixtures/sdk-init.js';

const EVIDENCE_DIR = '.omo/evidence/task-8-publ-client-boundary-routing-hardening';
const APPROVED_PARENT = 'http://127.0.0.1:3411';
const DENIED_PARENT = 'http://127.0.0.1:3412';
const SYNTHETIC_MANUAL_PHONE = '010-5555-0199';
const SYNTHETIC_MANUAL_PHONE_DIGITS = '01055550199';
const PHONE_PATTERN = /(?<!\d)0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/gu;

test('standalone sidebar survives repeated client navigation', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop fixed-sidebar regression coverage.');

  const apiState = createApiFixtureState();
  const runtimeErrors = [];
  await context.addCookies([{
    name: '__dev_auth_user_id',
    url: 'http://127.0.0.1:3410',
    value: 'e2e-user',
  }]);
  await installApiFixtures(page, apiState);
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/message-send');
  const targets = [
    { heading: '메시지 발송', href: '/message-send', name: '메시지 발송' },
    { heading: '자동화', href: '/automations', name: '자동화' },
    { heading: '템플릿', href: '/templates', name: '템플릿' },
  ];

  for (let cycle = 0; cycle < 6; cycle += 1) {
    for (const target of targets) {
      await page.getByRole('link', { name: target.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${target.href.replaceAll('/', '\\/')}$`, 'u'));
      await expect(page.getByRole('heading', { name: target.heading, exact: true })).toBeVisible();
    }
  }

  expect(runtimeErrors).toEqual([]);
});

test('message composer fields do not retain focus rings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop composer focus regression coverage.');

  for (const { path: playgroundPath, senderLabel } of [
    { path: '/playground/ui/sms-send-form', senderLabel: '발신번호 선택' },
    { path: '/playground/ui/alimtalk-send-form', senderLabel: '발신 채널 선택' },
    { path: '/playground/ui/nhn-brand-message-send-form', senderLabel: '발신 채널 선택' },
  ]) {
    await page.goto(playgroundPath);
    const senderField = page.getByRole('button', { name: senderLabel, exact: true });

    await senderField.click();
    await page.keyboard.press('Escape');
    await expect(senderField).toBeFocused();
    await expect(senderField).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('.email-send-form-recipient-control')).toHaveCSS('box-shadow', 'none');
  }
});

test('standalone embed tabs keep the canonical route and mounted sidebar', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Desktop fixed-sidebar regression coverage.');

  const apiState = createApiFixtureState();
  const runtimeErrors = [];
  await context.addCookies([{
    name: '__dev_auth_user_id',
    url: 'http://127.0.0.1:3410',
    value: 'e2e-user',
  }]);
  await installApiFixtures(page, apiState);
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/templates?mode=embed');
  const sidebar = page.locator('.inspector-sidebar-root');
  await expect(sidebar).toHaveCount(1);
  await sidebar.evaluate((element) => {
    element.dataset.navigationSentinel = 'mounted';
  });

  for (const tab of ['알림톡', '브랜드 메시지', 'SMS', '알림톡']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(page).toHaveURL(/\/templates\?(?=.*mode=embed)(?=.*tab=)/u);
    await expect(sidebar).toHaveAttribute('data-navigation-sentinel', 'mounted');
    await expect(page.locator('.app-shell')).toHaveClass(/embed-mode/u);
  }

  expect(runtimeErrors).toEqual([]);
});

test('approved parent renders prefixed Publ console without overflow', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installPublSdk(page);
  await installApiFixtures(page, apiState);

  await page.goto(getParentFrameUrl(APPROVED_PARENT, '/publ-client/logs?channel=sms&from=2026-07-01&to=2026-07-10'));
  const frame = await getPublFrame(page);

  await expect(frame.getByRole('navigation', { name: '주 메뉴' })).toBeVisible();
  await expect(frame.getByRole('link', { name: '발송기록' })).toHaveAttribute('href', '/publ-client/logs');
  await expect(frame.getByRole('link', { name: '예약' })).toHaveAttribute('href', '/publ-client/reservations');
  await expect(frame.getByRole('link', { name: '템플릿' })).toHaveAttribute('href', '/publ-client/templates');
  await expect(frame.getByRole('button', { name: 'CSV 내보내기' })).toHaveCount(0);
  await expect(frame.getByText('내 프로필')).toHaveCount(0);
  await expect(frame.getByText('관리', { exact: true })).toHaveCount(0);
  expect(hasCsvExportRequest(apiState)).toBe(false);
  await assertNoHorizontalOverflow(frame);
  await assertMobileResultContainment(frame, testInfo);
  evidence.assertNoPublAuthBoundaryTraffic();

  await evidence.capture({ apiState, frame, label: 'approved-console' });
});

test('manual phone recipient submits through the provider-neutral SMS request path', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installPublSdk(page);
  await installApiFixtures(page, apiState);

  await page.goto(getParentFrameUrl(APPROVED_PARENT, '/publ-client/message-send'));
  const frame = await getPublFrame(page);
  await expect(frame.getByRole('heading', { name: '메시지 발송' })).toBeVisible();

  const recipientField = frame.getByRole('combobox', { name: '수신자 선택' });
  await recipientField.locator('input').fill(SYNTHETIC_MANUAL_PHONE);
  await frame.getByRole('option', { name: `${SYNTHETIC_MANUAL_PHONE} 선택` }).click();
  await expect(recipientField.getByText(SYNTHETIC_MANUAL_PHONE)).toBeVisible();
  await frame.getByRole('textbox', { name: '문자 메시지 본문' }).fill('Phase 54 synthetic browser send');
  await frame.getByRole('button', { name: '발송하기' }).click();

  await expect.poll(() => getSmsSendRequest(apiState)).toMatchObject({
    body: {
      recipients: [{ recipientNo: SYNTHETIC_MANUAL_PHONE_DIGITS }],
    },
    method: 'POST',
    pathname: '/api/messages/sms/send',
  });
  await expect(frame.getByRole('button', { name: 'CSV 내보내기' })).toHaveCount(0);
  expect(hasCsvExportRequest(apiState)).toBe(false);
  evidence.assertNoPublAuthBoundaryTraffic();
  await redactLocatorText(recipientField, SYNTHETIC_MANUAL_PHONE, '<redacted-phone>');

  await evidence.capture({
    apiState,
    extra: {
      manualRecipientRequestPath: '/recipients/0/recipientNo',
      manualRecipientValue: '<redacted-phone>',
    },
    frame,
    label: 'direct-phone',
  });
});

test('Publ contact recipient loads from the SDK and submits through the SMS request path', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installPublSdk(page);
  await installApiFixtures(page, apiState);

  await page.goto(getParentFrameUrl(APPROVED_PARENT, '/publ-client/message-send'));
  const frame = await getPublFrame(page);
  const recipientField = frame.getByRole('combobox', { name: '수신자 선택' });

  await recipientField.locator('input').click();
  await frame.getByRole('option', { name: 'Publ recipient 선택' }).click();
  await expect(recipientField.getByText('Publ recipient')).toBeVisible();
  await frame.getByRole('textbox', { name: '문자 메시지 본문' }).fill('Phase 54 Publ contact browser send');
  await frame.getByRole('button', { name: '발송하기' }).click();

  await expect.poll(() => getSmsSendRequest(apiState)).toMatchObject({
    body: {
      recipients: [{ recipientNo: '01000000000' }],
    },
    method: 'POST',
    pathname: '/api/messages/sms/send',
  });
  evidence.assertNoPublAuthBoundaryTraffic();
  await redactLocatorText(recipientField, '01000000000', '<redacted-phone>');
  await evidence.capture({
    apiState,
    extra: {
      recipientSource: 'publ-contact',
      recipientValue: '<redacted-phone>',
    },
    frame,
    label: 'publ-contact-send',
  });
});

test('unapproved parent cannot frame the Publ client', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  await installApiFixtures(page, createApiFixtureState());

  await page.goto(getParentFrameUrl(DENIED_PARENT, '/publ-client/message-send'));

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
  await installPublSdk(page);
  await installApiFixtures(page, apiState);

  await page.goto(getParentFrameUrl(APPROVED_PARENT, '/publ-client/logs?channel=sms&from=2026-07-01&to=2026-07-10'));
  let frame = await getPublFrame(page);
  await expect(frame.getByText('E2E log')).toBeVisible();
  await expect(frame.getByRole('link', { name: '설정' })).toHaveAttribute('href', '/publ-client/settings');
  const initialCounters = await getSdkCounters(frame);
  expect(initialCounters).toMatchObject({ exchangeCount: 1, refreshCount: 0 });
  await frame.getByRole('link', { name: '발송 묶음 상세 보기' }).click();
  await expectFrameUrl(frame, /\/publ-client\/logs\/log-1\?channel=sms&from=2026-07-01&to=2026-07-10/u);
  await expect(frame.getByRole('heading', { name: 'E2E log' })).toBeVisible();
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: 1 });

  await activateFrameLink(frame, '예약');
  await expectFrameUrl(frame, /\/publ-client\/reservations/u);
  await expect(frame.getByText('E2E reservation')).toBeVisible();
  await frame.getByRole('button', { name: '예약 작업' }).click();
  await frame.getByRole('menuitem', { name: '상세보기' }).click();
  await expectFrameUrl(frame, /\/publ-client\/reservations\/reservation-1\?/u);
  await expect(frame.getByRole('button', { name: '예약 목록' })).toBeVisible();
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: 1 });

  await activateFrameLink(frame, '템플릿');
  await expectFrameUrl(frame, /\/publ-client\/templates/u);
  await frame.getByRole('tab', { name: '알림톡', exact: true }).click();
  await expectFrameUrl(frame, /\/publ-client\/templates\?tab=alimtalk/u);
  await frame.getByRole('tab', { name: 'SMS', exact: true }).click();
  await expectFrameUrl(frame, /\/publ-client\/templates\?tab=sms/u);
  await expect(frame.getByText('E2E SMS template')).toBeVisible();
  await frame.getByRole('button', { name: 'E2E SMS template 작업 더보기' }).click();
  await frame.getByRole('menuitem', { name: '상세 보기' }).click();
  await expectFrameUrl(frame, /\/publ-client\/templates\/sms\/TPL-1\?senderResourceId=sender-1/u);
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: 1 });

  await activateFrameLink(frame, '자동화');
  await expectFrameUrl(frame, /\/publ-client\/automations/u);
  const automationDetailLink = frame.getByRole('link', { name: 'E2E automation 자동화 상세 보기' });
  await expect(automationDetailLink).toBeVisible();
  await automationDetailLink.click();
  await expectFrameUrl(frame, /\/publ-client\/automations\/rule-1/u);
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: 1 });

  await activateFrameLink(frame, '발송기록');
  await expectFrameUrl(frame, /\/publ-client\/logs/u);
  await expect(frame.getByText('E2E log')).toBeVisible();

  await page.reload();
  frame = await getPublFrame(page);
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ exchangeCount: 2, refreshCount: 0 });
  await assertNoHorizontalOverflow(frame);
  await assertMobileResultContainment(frame, testInfo);
  evidence.assertNoPublAuthBoundaryTraffic();

  await evidence.capture({ apiState, frame, label: 'route-preservation' });
});

test('stale standalone iframe sends no Publ auth and simultaneous 401s refresh once', async ({ context, page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installPublSdk(page);
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

  await page.goto(getParentFrameUrl(APPROVED_PARENT, '/publ-client/message-send'));
  const frame = await getPublFrame(page);
  await expect(frame.getByRole('heading', { name: '메시지 발송' })).toBeVisible();
  await expect.poll(() => frame.evaluate(() => typeof window.__VIZUO_E2E_RELAY_GET__)).toBe('function');
  armUnauthorizedResponses(apiState, 2);
  await frame.evaluate(async () => {
    await Promise.allSettled([
      window.__VIZUO_E2E_RELAY_GET__('/api/me'),
      window.__VIZUO_E2E_RELAY_GET__('/api/sender-resources'),
    ]);
  });
  await expect.poll(() => getSdkCounters(frame)).toMatchObject({ refreshCount: 1 });
  expect(apiState.unauthorizedHits).toBe(2);
  evidence.assertNoPublAuthBoundaryTraffic();

  await evidence.capture({ apiState, frame, label: 'stale-and-refresh' });
});

test('permission denial renders recipient capability state without CSV access', async ({ page }, testInfo) => {
  const evidence = createEvidenceRecorder(page, testInfo);
  const apiState = createApiFixtureState();
  await installPublSdk(page, { denyContacts: true });
  await installApiFixtures(page, apiState);

  await page.goto(getParentFrameUrl(APPROVED_PARENT, '/publ-client/audience'));
  const frame = await getPublFrame(page);

  await expect(frame.getByRole('tab', { name: 'Publ 수신자', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(frame.getByRole('tab', { name: 'Publ 세그먼트', exact: true })).toHaveAttribute('aria-selected', 'false');
  const permissionDeniedState = frame.getByText('Publ 수신자 조회 권한이 없습니다');
  await expect(permissionDeniedState).toBeVisible();
  await centerInHorizontalScrollport(permissionDeniedState);
  await expect.poll(() => getHorizontalContainment(permissionDeniedState)).toEqual({ contained: true });
  await expect(frame.getByRole('button', { name: 'CSV 내보내기' })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Export contacts' })).toHaveCount(0);
  expect(hasCsvExportRequest(apiState)).toBe(false);
  evidence.assertNoPublAuthBoundaryTraffic();
  await evidence.capture({ apiState, frame, label: 'permission-denied' });

  await frame.getByRole('tab', { name: 'Publ 세그먼트', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Publ 세그먼트 연동 준비 중' })).toBeVisible();

  await activateFrameLink(frame, '발송기록');
  await expectFrameUrl(frame, /\/publ-client\/logs/u);
  await expect(frame.getByText('E2E log')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'CSV 내보내기' })).toHaveCount(0);
  expect(hasCsvExportRequest(apiState)).toBe(false);
  await assertNoHorizontalOverflow(frame);
  evidence.assertNoPublAuthBoundaryTraffic();

  await evidence.capture({ apiState, frame, label: 'permission-denied-route-continuity' });
});

async function getPublFrame(page) {
  await expect(page.locator('iframe[data-testid="publ-frame"]')).toBeVisible();
  await expect.poll(() => page.frames().find((candidate) => isPublClientFrameUrl(candidate.url()))?.url()).toContain('/publ-client');
  const frame = page.frames().find((candidate) => isPublClientFrameUrl(candidate.url()));
  await expect.poll(() => frame.evaluate(() => ({
    documentReady: document.readyState === 'complete',
    sdkReady: window.__VIZUO_PUBL_E2E__?.ready === true,
  }))).toEqual({ documentReady: true, sdkReady: true });
  return frame;
}

async function installPublSdk(page, options = {}) {
  await page.addInitScript(createSdkInitScript(options));
}

function getParentFrameUrl(parentOrigin, targetPath) {
  const url = new URL('/frame', parentOrigin);
  url.searchParams.set('path', targetPath);
  return url.toString();
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

async function assertMobileResultContainment(frame, testInfo) {
  if (testInfo.project.name !== 'chromium-mobile') {
    return;
  }

  expect(await frame.evaluate(() => window.innerWidth)).toBe(390);
  const tableScrollport = frame.locator('.message-logs-table-shell .resend-email-table-scroll');
  const resultText = tableScrollport.locator('.resend-data-table-row .message-log-result-summary').first();
  await expect(tableScrollport).toBeVisible();
  await expect(resultText).toBeVisible();
  await expect(resultText).toHaveText(/^성공 \d+ · 실패 \d+ · 미확인 \d+$/u);
  await expect.poll(() => tableScrollport.evaluate((scrollport) => {
    const result = scrollport.querySelector('.resend-data-table-row .message-log-result-summary');
    return {
      rendered: Boolean(result?.isConnected && result.getBoundingClientRect().width > 0),
      scrollable: scrollport.scrollWidth > scrollport.clientWidth,
    };
  })).toEqual({ rendered: true, scrollable: true });

  await expect.poll(() => tableScrollport.evaluate(async (scrollport) => {
    const maxScrollLeft = scrollport.scrollWidth - scrollport.clientWidth;
    scrollport.scrollLeft = maxScrollLeft;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    return {
      atEnd: Math.abs(scrollport.scrollLeft - maxScrollLeft) <= 1,
      maxScrollLeftPositive: maxScrollLeft > 0,
    };
  })).toEqual({ atEnd: true, maxScrollLeftPositive: true });

  await expect.poll(() => tableScrollport.evaluate((scrollport) => {
    const result = scrollport.querySelector('.resend-data-table-row .message-log-result-summary');
    const resultCell = result?.closest('td');
    const stickyActionCell = resultCell?.parentElement?.lastElementChild;
    if (!result || !resultCell || !stickyActionCell) return null;

    const scrollportRect = scrollport.getBoundingClientRect();
    const resultRect = result.getBoundingClientRect();
    const resultCellRect = resultCell.getBoundingClientRect();
    const stickyActionRect = stickyActionCell.getBoundingClientRect();
    return {
      resultInsideCell: resultRect.left >= resultCellRect.left && resultRect.right <= resultCellRect.right,
      resultInsideScrollport: resultRect.left >= scrollportRect.left && resultRect.right <= scrollportRect.right,
      resultLeftOfStickyAction: resultRect.right <= stickyActionRect.left,
      scrollable: scrollport.scrollWidth > scrollport.clientWidth,
    };
  })).toEqual({
    resultInsideCell: true,
    resultInsideScrollport: true,
    resultLeftOfStickyAction: true,
    scrollable: true,
  });

  await tableScrollport.evaluate((scrollport) => {
    scrollport.scrollLeft = 0;
  });
}

async function activateFrameLink(frame, name) {
  const link = frame.getByRole('link', { name });
  const isInViewport = await link.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });

  if (!isInViewport) {
    const sidebarToggle = frame.getByRole('button', { name: 'Toggle inspector sidebar' });
    await sidebarToggle.focus();
    await sidebarToggle.press('Enter');
    await expect(link).toBeInViewport();
  }

  await link.focus();
  await link.press('Enter');
}

async function expectFrameUrl(frame, pattern) {
  await expect.poll(() => frame.url()).toMatch(pattern);
}

function createEvidenceRecorder(page, testInfo) {
  const consoleErrors = [];
  const expectedDevKeyWarnings = [];
  const failedRequests = [];
  const requestedUrls = [];
  const unexpectedWarnings = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(redact(message.text()));
      return;
    }

    if (message.type() === 'warning') {
      const warning = redact(message.text());
      if (isExpectedClerkDevKeyWarning(warning)) {
        expectedDevKeyWarnings.push(warning);
      } else {
        unexpectedWarnings.push(warning);
      }
    }
  });
  page.on('request', (request) => {
    requestedUrls.push(redactUrl(request.url()));
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      failure: redact(request.failure()?.errorText ?? ''),
      method: request.method(),
      url: redactUrl(request.url()),
    });
  });

  return {
    assertNoPublAuthBoundaryTraffic() {
      expect(requestedUrls.filter(isPublForbiddenAuthUrl)).toEqual([]);
      expect(unexpectedWarnings).toEqual([]);
    },
    async capture({ apiState = null, extra = {}, frame, label }) {
      await mkdir(projectEvidencePath(testInfo.project.name), { recursive: true });
      const screenshotPath = path.join(projectEvidencePath(testInfo.project.name), `${label}.png`);
      await captureScreenshot(frame, screenshotPath);
      const counters = frame.evaluate ? await getSdkCounters(frame).catch(() => ({})) : {};
      const finalUrl = frame.url ? frame.url() : page.url();
      await writeJson(testInfo.project.name, `${label}.json`, {
        apiRequests: redactApiRequests(apiState?.requests ?? []),
        apiRequestHeaders: apiState?.requestHeaders ?? [],
        clerkDevBootstrapRequests: requestedUrls.filter(isExpectedClerkDevBootstrapUrl),
        consoleErrors,
        counters,
        expectedDevKeyWarnings,
        extra,
        failedRequests,
        finalUrl: redactUrl(finalUrl),
        forbiddenAuthRequests: requestedUrls.filter(isPublForbiddenAuthUrl),
        screenshotPath,
        unexpectedWarnings,
      });
    },
  };
}

function getSmsSendRequest(apiState) {
  return apiState.requests?.find((request) => request.pathname === '/api/messages/sms/send') ?? null;
}

function hasCsvExportRequest(apiState) {
  return apiState.requests.some((request) => request.pathname === '/api/message-logs/export');
}

function isExpectedClerkDevKeyWarning(value) {
  return /^(?:Clerk:\s+)?Clerk has been loaded with development keys\./u.test(value)
    && value.includes('https://clerk.com/docs/deployments/overview');
}

function isPublForbiddenAuthUrl(value) {
  const url = new URL(value);
  if (url.pathname === '/sign-in'
    || url.pathname.startsWith('/sign-in/')
  ) {
    return true;
  }

  const isClerkHost = url.hostname.endsWith('.clerk.accounts.dev') || url.hostname === 'api.clerk.com';
  if (!isClerkHost || url.pathname.startsWith('/npm/')) return false;
  if (isExpectedClerkDevBootstrapUrl(value)) return false;
  return isClerkAuthEndpoint(value);
}

function isExpectedClerkDevBootstrapUrl(value) {
  const url = new URL(value);
  const isClerkHost = url.hostname.endsWith('.clerk.accounts.dev') || url.hostname === 'api.clerk.com';
  if (!isClerkHost) return false;
  return [
    '/v1/client',
    '/v1/client/handshake',
    '/v1/dev_browser',
    '/v1/environment',
  ].includes(url.pathname);
}

function isClerkAuthEndpoint(value) {
  const url = new URL(value);
  const isClerkHost = url.hostname.endsWith('.clerk.accounts.dev') || url.hostname === 'api.clerk.com';
  return isClerkHost && url.pathname.startsWith('/v1/');
}

function redactApiRequests(requests) {
  return requests.map((request) => ({
    ...request,
    body: redactApiValue(request.body),
  }));
}

function redactApiValue(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => redactApiValue(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => (
      [entryKey, redactApiValue(entryValue, entryKey)]
    )));
  }
  if (typeof value !== 'string') return value;
  if (/phone|recipientNo|sendNo/iu.test(key)) return '<redacted-phone>';
  if (/authorization|cookie|jwt|secret|session|token/iu.test(key)) return '<redacted>';
  if (key === 'clientRequestId') return '<redacted-id>';
  return value.replace(PHONE_PATTERN, '<redacted-phone>');
}

async function captureScreenshot(frameOrPage, screenshotPath) {
  if (typeof frameOrPage.locator === 'function') {
    const body = frameOrPage.locator('body');
    await redactScreenshotSurface(body);
    await body.screenshot({ path: screenshotPath });
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
    .replace(/(?:authorization|cookie|jwt|secret|session|token)\s*[=:]\s*[^\s,;]+/giu, '<redacted>')
    .replace(/vizuo:publPapp:[A-Za-z]+/gu, 'vizuo:publPapp:<redacted>')
    .replace(PHONE_PATTERN, '<redacted-phone>');
}

async function redactScreenshotSurface(locator) {
  await locator.evaluate((element) => {
    const phonePattern = /(?<!\d)0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/gu;
    const redactPhones = (value) => value.replace(phonePattern, '<redacted-phone>');
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.textContent = redactPhones(node.textContent);
      node = walker.nextNode();
    }

    element.querySelectorAll('input, textarea').forEach((control) => {
      control.value = redactPhones(control.value);
    });
  });
}

async function redactLocatorText(locator, value, replacement) {
  await locator.evaluate((element, { replacementText, targetText }) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.textContent = node.textContent.replaceAll(targetText, replacementText);
      node = walker.nextNode();
    }
  }, { replacementText: replacement, targetText: value });
}

async function centerInHorizontalScrollport(locator) {
  await locator.evaluate((element) => {
    const scrollport = element.closest('.resend-email-table-scroll');
    if (!scrollport) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    const elementRect = range.getBoundingClientRect();
    const scrollportRect = scrollport.getBoundingClientRect();
    scrollport.scrollLeft += elementRect.left
      - scrollportRect.left
      - ((scrollportRect.width - elementRect.width) / 2);
  });
}

async function getHorizontalContainment(locator) {
  return locator.evaluate((element) => {
    const scrollport = element.closest('.resend-email-table-scroll');
    const range = document.createRange();
    range.selectNodeContents(element);
    const elementRect = range.getBoundingClientRect();
    const scrollportRect = scrollport?.getBoundingClientRect() ?? {
      left: 0,
      right: document.documentElement.clientWidth,
    };
    return {
      contained: elementRect.left >= scrollportRect.left
        && elementRect.right <= scrollportRect.right,
    };
  });
}

function redactUrl(value) {
  const url = new URL(value);
  for (const [key, entryValue] of [...url.searchParams.entries()]) {
    if (/authorization|cookie|jwt|phone|secret|session|token/iu.test(key)) {
      url.searchParams.set(key, '<redacted>');
    } else {
      const redactedValue = entryValue.replace(PHONE_PATTERN, '<redacted-phone>');
      if (redactedValue !== entryValue) url.searchParams.set(key, redactedValue);
    }
  }
  return `${url.origin}${url.pathname}${url.search}`;
}
