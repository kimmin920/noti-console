import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const PLAYWRIGHT_OUTPUT_DIR = path.join(
  tmpdir(),
  'messaging-app-publ-client-playwright-output'
);

export default async function removePlaywrightOutput() {
  await rm(PLAYWRIGHT_OUTPUT_DIR, { force: true, recursive: true });
}
