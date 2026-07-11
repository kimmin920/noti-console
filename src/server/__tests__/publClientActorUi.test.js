import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Publ client actor UI boundaries', () => {
  it('uses relay actor state for operator navigation instead of Clerk signed-in state', () => {
    const shellSource = readSource('../../features/console/ConsoleShells.jsx');

    expect(shellSource).toContain('useConsoleNavigation');
    expect(shellSource).toContain("currentActorQuery.data?.user?.isOperator");
    expect(shellSource).not.toContain('isSignedIn === true && Boolean(currentActorQuery.data?.user?.isOperator)');
    expect(shellSource).not.toContain('useCurrentActorQuery({ enabled: isSignedIn === true })');
  });

  it('hides Clerk profile/account controls from Publ settings while leaving other settings tabs', () => {
    const pagesSource = readSource('../../features/console/settings/SettingsPage.jsx');

    expect(pagesSource).toContain("navigation.mode === 'embed'");
    expect(pagesSource).toContain('getVisibleSettingsTabs');
    expect(pagesSource).toContain("activeTab === '프로필' && !isPublEmbed");
  });
});

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
