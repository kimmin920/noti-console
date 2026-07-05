const MESSAGE_SEND_TAB_QUERY_VALUES = Object.freeze({
  SMS: 'sms',
  '알림톡': 'alimtalk',
  '브랜드 메시지': 'brand',
});

const SETTINGS_TAB_QUERY_VALUES = Object.freeze({
  사용량: 'usage',
  '발신 수단 관리': 'sender-resources',
  청구: 'billing',
  연동: 'integrations',
  프로필: 'profile',
});

export function getMessageSendTabQueryValue(tab) {
  return MESSAGE_SEND_TAB_QUERY_VALUES[tab] ?? '';
}

export function getMessageSendTabFromQuery(searchParams, tabs) {
  return getTabFromQuery({
    fallbackTab: tabs[0],
    queryValues: MESSAGE_SEND_TAB_QUERY_VALUES,
    searchParams,
    tabs,
  });
}

export function getTemplateTabQueryValue(tab) {
  return getMessageSendTabQueryValue(tab);
}

export function getTemplateTabFromQuery(searchParams, tabs) {
  return getTabFromQuery({
    fallbackTab: tabs[0],
    queryValues: MESSAGE_SEND_TAB_QUERY_VALUES,
    searchParams,
    tabs,
  });
}

export function getSettingsTabQueryValue(tab) {
  return SETTINGS_TAB_QUERY_VALUES[tab] ?? '';
}

export function getSettingsTabFromQuery(searchParams, tabs) {
  return getTabFromQuery({
    fallbackTab: tabs[0],
    queryValues: SETTINGS_TAB_QUERY_VALUES,
    searchParams,
    tabs,
  });
}

export function buildTabQueryHref({ pathname, searchParams, tabQueryValue }) {
  const nextParams = new URLSearchParams(searchParams?.toString() ?? '');

  if (tabQueryValue) {
    nextParams.set('tab', tabQueryValue);
  } else {
    nextParams.delete('tab');
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getTabFromQuery({ fallbackTab, queryValues, searchParams, tabs }) {
  const value = searchParams?.get('tab') ?? '';
  const tab = Object.entries(queryValues).find(([, queryValue]) => queryValue === value)?.[0];

  if (tab && tabs.includes(tab)) {
    return tab;
  }

  return fallbackTab ?? '';
}
