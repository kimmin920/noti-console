import { defineConfig, devices } from '@playwright/test';
import { PLAYWRIGHT_OUTPUT_DIR } from './tests/publ-client/global-teardown.mjs';

const APP_PORT = 3410;
const PARENT_PORT = 3411;
const DENIED_PARENT_PORT = 3412;

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  globalTeardown: './tests/publ-client/global-teardown.mjs',
  outputDir: PLAYWRIGHT_OUTPUT_DIR,
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        browserName: 'chromium',
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
  ],
  reporter: [['list']],
  testDir: './tests/publ-client',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: `npm run dev -- -H 127.0.0.1 -p ${APP_PORT}`,
      env: {
        PUBL_PAPP_CLIENT_STAGE: 'test',
        PUBL_PAPP_TEST_CLIENT_HASH: 'e2e-client-hash',
        PUBL_PAPP_TEST_MEMBER_CONTACTS_PERMISSION_ID: 'PM_19177_READ_MEMBER_CONTACTS',
        PUBL_PAPP_TEST_PARENT_ORIGINS: `https://console.dev.publ.biz,http://127.0.0.1:${PARENT_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `http://127.0.0.1:${APP_PORT}/publ-client/message-send`,
    },
    {
      command: `node tests/publ-client/fixtures/parent-server.mjs --app-port=${APP_PORT} --approved-port=${PARENT_PORT} --denied-port=${DENIED_PARENT_PORT}`,
      reuseExistingServer: false,
      timeout: 30_000,
      url: `http://127.0.0.1:${PARENT_PORT}/healthz`,
    },
  ],
});
