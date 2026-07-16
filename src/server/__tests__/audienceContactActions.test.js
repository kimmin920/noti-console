import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ruiRoot = path.join(repoRoot, 'src/ui-kits/resend');
const audienceRoot = path.join(ruiRoot, 'domain/audience-contact-list');

describe('Audience contact action integration', () => {
  it('tracks the complete generated action surface in the RUI manifest', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ruiRoot, 'copy-manifest.json'), 'utf8'));

    expect(manifest.requested).toContain('domain/audience-contact-list');
    expect(manifest.requested).toContain('domain/audience-management-list');
    expect(manifest.files).toHaveProperty('domain/audience-contact-list/audience-add-contacts-modal.tsx');
    expect(manifest.files).toHaveProperty('domain/audience-contact-list/audience-import-csv-modal.tsx');
    expect(manifest.files).toHaveProperty('domain/audience-contact-list/audience-contact-action-modals.tsx');
    expect(manifest.files).toHaveProperty('domain/audience-contact-list/audience-contact-list.css');
    expect(manifest.files).toHaveProperty('domain/delete-confirmation-modal/delete-confirmation-modal.tsx');
  });

  it('opens copied add modals from the application header without a source-repository import', () => {
    const source = fs.readFileSync(
      path.join(repoRoot, 'src/features/console/audience/AudienceTable.jsx'),
      'utf8'
    );

    expect(source).toContain("from '../../../ui-kits/resend/domain/audience-contact-list/audience-add-contacts-modal.tsx'");
    expect(source).toContain("from '../../../ui-kits/resend/domain/audience-contact-list/audience-import-csv-modal.tsx'");
    expect(source).toContain('setManualOpen(true)');
    expect(source).toContain('setCsvOpen(true)');
    expect(source).not.toContain('/resends-clone/');
  });

  it('uses the copied row action dialogs and the latest ellipsis trigger styling', () => {
    const rowActions = fs.readFileSync(path.join(audienceRoot, 'audience-contact-row-actions.tsx'), 'utf8');
    const css = fs.readFileSync(path.join(audienceRoot, 'audience-contact-list.css'), 'utf8');

    expect(rowActions).toContain('<AudienceEditContactModal');
    expect(rowActions).toContain('<AudienceDeleteContactsModal');
    expect(rowActions).toContain('className="resend-ui-audience-contact-list__row-action-trigger"');
    expect(css).toContain('.resend-ui-audience-contact-list__row-action-trigger .resend-ui-icon-button__icon svg');
    expect(css).toContain('background-color: var(--rui-bg-interactive-hover);');
  });

  it('keeps copied modal close buttons positioned after primitive button styles load', () => {
    const css = fs.readFileSync(path.join(repoRoot, 'src/styles/rui-extensions.css'), 'utf8');
    const modalSources = [
      path.join(audienceRoot, 'audience-contact-modal-shell.tsx'),
      path.join(ruiRoot, 'domain/delete-confirmation-modal/delete-confirmation-modal.tsx'),
      path.join(ruiRoot, 'domain/export-modal/export-modal.tsx'),
    ].map((filePath) => fs.readFileSync(filePath, 'utf8'));
    const commonCloseRule = css.match(
      /\.resend-ui-button\.resend-ui-icon-button\[aria-label='Close dialog'\]\s*\{([^}]*)\}/
    )?.[1];

    expect(commonCloseRule).toContain('justify-content: center;');
    expect(commonCloseRule).toContain('min-width: calc(var(--rui-spacing) * 8);');
    expect(commonCloseRule).toContain('padding: 0;');
    expect(commonCloseRule).toContain('position: absolute;');
    expect(commonCloseRule).toContain('width: calc(var(--rui-spacing) * 8);');
    modalSources.forEach((source) => expect(source).toContain('label="Close dialog"'));
  });
});
