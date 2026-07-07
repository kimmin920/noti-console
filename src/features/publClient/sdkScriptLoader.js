'use client';

const SDK_SCRIPT_ATTRIBUTE = 'data-publ-papp-sdk';

const pendingLoads = new Map();

export function isPublClientSdkAvailable(source = getGlobalSource()) {
  return Boolean(source?.PAppClientSDK && typeof source.PAppClientSDK.create === 'function');
}

export function loadPublClientSdkScript(src, { documentRef = getDocument() } = {}) {
  const normalizedSrc = normalizeScriptSrc(src);
  if (!normalizedSrc) {
    return Promise.reject(new Error('Publ SDK script source is not configured.'));
  }

  if (isPublClientSdkAvailable()) {
    return Promise.resolve();
  }

  if (!documentRef) {
    return Promise.reject(new Error('Publ SDK script can only be loaded in a browser.'));
  }

  if (pendingLoads.has(normalizedSrc)) {
    return pendingLoads.get(normalizedSrc);
  }

  const existingScript = findExistingSdkScript(documentRef, normalizedSrc);
  if (existingScript?.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  const promise = new Promise((resolve, reject) => {
    const script = existingScript ?? documentRef.createElement('script');
    script.src = normalizedSrc;
    script.async = true;
    script.dataset.publPappSdk = 'true';

    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      pendingLoads.delete(normalizedSrc);
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      pendingLoads.delete(normalizedSrc);
      removeFailedScript(script);
      reject(new Error('Publ SDK script failed to load.'));
    }, { once: true });

    if (!existingScript) {
      documentRef.head.appendChild(script);
    }
  });

  pendingLoads.set(normalizedSrc, promise);
  return promise;
}

function findExistingSdkScript(documentRef, src) {
  const scripts = Array.from(documentRef.querySelectorAll(`script[${SDK_SCRIPT_ATTRIBUTE}]`));
  return scripts.find((script) => script.src === new URL(src, documentRef.baseURI).href) ?? null;
}

function normalizeScriptSrc(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function removeFailedScript(script) {
  if (typeof script.remove === 'function') {
    script.remove();
    return;
  }

  script.parentNode?.removeChild?.(script);
}

function getDocument() {
  return typeof document === 'object' ? document : null;
}

function getGlobalSource() {
  return typeof globalThis === 'object' ? globalThis : {};
}
