export function formatSmsSenderLabel(resource) {
  const number = formatPhoneNumber(resource.value);
  const displayName = String(resource.displayName ?? '').trim();
  const displayNameDigits = normalizePhoneDigits(displayName);
  const valueDigits = normalizePhoneDigits(resource.value);

  if (!displayName || displayName === resource.value) {
    return number || resource.id;
  }

  if (displayNameDigits && displayNameDigits === valueDigits) {
    return isPhoneOnlyLabel(displayName) ? number : displayName;
  }

  return `${displayName} ${number}`.trim();
}

export function formatPhoneNumber(value) {
  const input = String(value ?? '').trim();
  const digits = input.replace(/\D/g, '');

  if (!digits) {
    return input;
  }

  if (digits.startsWith('02')) {
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }

    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return input;
}

export const formatSettingsSmsSenderLabel = formatSmsSenderLabel;
export const formatSettingsPhoneNumber = formatPhoneNumber;

function normalizePhoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function isPhoneOnlyLabel(value) {
  return String(value ?? '').replace(/[0-9\s().+-]/g, '') === '';
}
