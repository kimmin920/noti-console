import { describe, expect, it, vi } from 'vitest';

import {
  isPublClientSdkAvailable,
  loadPublClientSdkScript,
} from '../../features/publClient/sdkScriptLoader.js';

describe('Publ client SDK script loader', () => {
  it('detects an available official SDK global', () => {
    expect(isPublClientSdkAvailable({
      PAppClientSDK: {
        create: () => ({}),
      },
    })).toBe(true);
    expect(isPublClientSdkAvailable({ PAppClientSDK: {} })).toBe(false);
  });

  it('loads the configured SDK script once', async () => {
    const documentRef = createDocumentStub();
    const pending = loadPublClientSdkScript('/vendor/sdk.js', { documentRef });

    expect(documentRef.head.appendChild).toHaveBeenCalledTimes(1);
    const script = documentRef.createdScripts[0];
    expect(script.src).toBe('/vendor/sdk.js');
    expect(script.async).toBe(true);
    expect(script.dataset.publPappSdk).toBe('true');

    script.listeners.load();
    await expect(pending).resolves.toBeUndefined();
    expect(script.dataset.loaded).toBe('true');
  });

  it('removes a failed SDK script so retry can load it again', async () => {
    const documentRef = createDocumentStub();
    const failedLoad = loadPublClientSdkScript('/vendor/sdk.js', { documentRef });

    const failedScript = documentRef.createdScripts[0];
    failedScript.listeners.error();

    await expect(failedLoad).rejects.toThrow('Publ SDK script failed to load.');
    expect(failedScript.remove).toHaveBeenCalledTimes(1);

    const retryLoad = loadPublClientSdkScript('/vendor/sdk.js', { documentRef });
    const retryScript = documentRef.createdScripts[1];

    expect(documentRef.head.appendChild).toHaveBeenCalledTimes(2);
    retryScript.listeners.load();
    await expect(retryLoad).resolves.toBeUndefined();
  });

  it('rejects when the SDK source is missing', async () => {
    await expect(loadPublClientSdkScript('')).rejects.toThrow(
      'Publ SDK script source is not configured.'
    );
  });
});

function createDocumentStub() {
  const createdScripts = [];

  return {
    baseURI: 'https://noti-dev.vizuo.work/publ-client',
    createdScripts,
    createElement: vi.fn(() => {
      const script = {
        addEventListener: vi.fn((event, listener) => {
          script.listeners[event] = listener;
        }),
        async: false,
        dataset: {},
        listeners: {},
        remove: vi.fn(),
        src: '',
      };
      createdScripts.push(script);
      return script;
    }),
    head: {
      appendChild: vi.fn(),
    },
    querySelectorAll: vi.fn(() => []),
  };
}
