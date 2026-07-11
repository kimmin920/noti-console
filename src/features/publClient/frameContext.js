'use client';

export function isPublIframeContext(windowRef = getWindow()) {
  if (!windowRef) {
    return false;
  }

  try {
    return windowRef.self !== windowRef.top;
  } catch {
    return true;
  }
}

function getWindow() {
  return typeof window === 'object' ? window : null;
}
