export const templateQueryKeys = {
  alimtalkCatalog: ['templates', 'catalog', 'alimtalk'],
  brandCatalog: ['templates', 'catalog', 'brand'],
  catalog: (channelPath, params = {}) => ['templates', 'catalog', channelPath, params],
  smsCatalog: ['templates', 'catalog', 'sms'],
};
