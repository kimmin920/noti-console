import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootUrl = new URL('../../', import.meta.url);

describe('console screen architecture', () => {
  it('lets every standalone console route import its screen directly', () => {
    const routeFiles = listPageFiles(new URL('app/(console)/', rootUrl));

    expect(routeFiles).toHaveLength(23);

    for (const routeFile of routeFiles) {
      const source = readFileSync(routeFile, 'utf8');

      expect(source).toContain('StandaloneConsoleRoute');
      expect(source).not.toContain('ConsoleScreenOutlet');
    }
  });

  it('keeps screen selection at the Publ embed boundary', () => {
    const messagingConsole = readSource('features/console/MessagingConsole.jsx');
    const screenOutlet = readSource('features/console/ConsoleScreenOutlet.jsx');
    const shells = readSource('features/console/ConsoleShells.jsx');

    expect(messagingConsole).toContain("import { ConsoleScreenOutlet } from './ConsoleScreenOutlet.jsx';");
    expect(messagingConsole).toContain('<ConsoleScreenOutlet');
    expect(screenOutlet).toContain("import { MessageSendPage, SmsBulkSendRunWatcher } from './messageSend/MessageSendPage.jsx';");
    expect(screenOutlet).toContain("import { MessageLogsPage } from './messageLogs/MessageLogsPage.jsx';");
    expect(screenOutlet).toContain("from './settings/SettingsPage.jsx';");
    expect(screenOutlet).toContain('<SettingsPage />');
    expect(shells).not.toContain('ConsoleScreenOutlet');
  });

  it('removes the legacy all-pages dispatcher chain', () => {
    for (const relativePath of [
      'features/console/ConsolePages.jsx',
      'features/console/ConsolePageOutlet.jsx',
      'features/console/ConsoleRoute.jsx',
    ]) {
      expect(existsSync(new URL(relativePath, rootUrl))).toBe(false);
    }
  });

  it('keeps console utility header controls out of standalone and embed shells', () => {
    const rootFrame = readSource('features/console/ConsoleRootFrame.jsx');
    const messagingConsole = readSource('features/console/MessagingConsole.jsx');
    const shells = readSource('features/console/ConsoleShells.jsx');
    const styles = readSource('styles/components.css');

    expect(shells).not.toContain('function Topbar');
    expect(shells).not.toContain('<Topbar');
    expect(shells).not.toContain('CommandPalette');
    expect(shells).not.toContain('빠른 이동');
    expect(shells).not.toContain('도움이 필요하신가요?');
    expect(shells).not.toContain('sidebar-utility-actions');
    expect(rootFrame).not.toContain('docsHref');
    expect(messagingConsole).not.toContain('docsHref');
    expect(styles).not.toMatch(/(^|\n)\.topbar\s*\{/);
  });

  it('shares sender resource type constants across settings and admin screens', () => {
    const adminScreen = readSource('features/console/admin/SenderResourceApplicationsPage.jsx');
    const settingsScreen = readSource('features/console/settings/SettingsPage.jsx');
    const sharedConfig = readSource('features/console/settings/senderResourceApplicationConfig.js');

    expect(sharedConfig).toContain("export const SMS_SENDER_RESOURCE_TYPE = 'sms_send_no';");
    expect(sharedConfig).toContain("export const KAKAO_SENDER_RESOURCE_TYPE = 'kakao_sender_key';");
    expect(adminScreen).toContain('SMS_SENDER_RESOURCE_TYPE,');
    expect(settingsScreen).toContain('KAKAO_SENDER_RESOURCE_TYPE,');
    expect(settingsScreen).toContain('SMS_SENDER_RESOURCE_TYPE,');
  });
});

function listPageFiles(directoryUrl) {
  return readdirSync(directoryUrl, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === 'page.jsx')
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, rootUrl), 'utf8');
}
