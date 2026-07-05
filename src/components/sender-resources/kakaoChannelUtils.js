export function normalizeKakaoPhone(value) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

export function normalizeKakaoPlusFriendId(value) {
  const trimmed = String(value ?? '').trim();

  if (!trimmed) {
    return '';
  }

  return trimmed.startsWith('@') ? trimmed : `@${trimmed.replace(/^@+/, '')}`;
}

export function buildResolvedKakaoCategoryCode(form) {
  return [form.largeCategoryCode, form.middleCategoryCode, form.smallCategoryCode]
    .map((code) => String(code ?? '').trim())
    .filter(Boolean)
    .reduce((accumulator, code) => {
      if (!accumulator || code.startsWith(accumulator)) {
        return code;
      }

      return `${accumulator}${code}`;
    }, '');
}

export function getKakaoCategoryState(categories, form) {
  const largeOptions = categories;
  const selectedLarge = largeOptions.find((item) => item.code === form.largeCategoryCode) ?? null;
  const middleOptions = selectedLarge?.children ?? [];
  const selectedMiddle = middleOptions.find((item) => item.code === form.middleCategoryCode) ?? null;
  const smallOptions = selectedMiddle?.children ?? [];
  const selectedSmall = smallOptions.find((item) => item.code === form.smallCategoryCode) ?? null;

  return {
    largeOptions,
    middleOptions,
    selectedLarge,
    selectedMiddle,
    selectedSmall,
    smallOptions,
  };
}

export function getKakaoSelectedCategoryLabel(categoryState, categoryCode) {
  return [
    categoryState.selectedLarge?.label,
    categoryState.selectedMiddle?.label,
    categoryState.selectedSmall?.label,
  ].filter(Boolean).join(' / ') || (categoryCode ? categoryCode : '');
}
