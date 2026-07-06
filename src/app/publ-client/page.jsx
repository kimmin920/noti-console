import { PublClientBootstrap } from '@/features/publClient/PublClientBootstrap.jsx';
import {
  DEFAULT_CONSOLE_PAGE_ID,
  normalizeConsolePageId,
} from '@/features/console/routing.js';

export const metadata = {
  title: 'Publ Client',
  description: 'Publ iframe client entry for the messaging console.',
};

export default async function PublClientPage({ searchParams }) {
  const params = await searchParams;

  return <PublClientBootstrap pageId={getPublClientPageId(params)} />;
}

function getPublClientPageId(params) {
  const requestedPage = getFirstParamValue(params?.page ?? params?.consolePage);

  if (!requestedPage) {
    return DEFAULT_CONSOLE_PAGE_ID;
  }

  return normalizeConsolePageId(requestedPage);
}

function getFirstParamValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return typeof value === 'string' ? value : '';
}
