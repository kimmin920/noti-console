import { PublClientRouteEntry } from '@/features/publClient/PublClientRouteEntry.jsx';
import { matchPublClientPath } from '@/features/console/routing.js';
import { resolvePublPappClientConfigResult } from '@/server/publPapp/clientConfig.js';

export const metadata = {
  title: 'Publ Client',
  description: 'Publ iframe client entry for the messaging console.',
};

export default async function PublClientCatchAllPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const nestedPath = Array.isArray(resolvedParams?.path) ? resolvedParams.path.join('/') : '';
  const pathname = nestedPath ? `/publ-client/${nestedPath}` : '/publ-client';
  const queryString = toQueryString(resolvedSearchParams);
  const clientConfigResult = resolvePublPappClientConfigResult();

  return (
    <PublClientRouteEntry
      clientConfig={clientConfigResult.ok ? clientConfigResult.config : null}
      clientConfigError={clientConfigResult.ok ? '' : clientConfigResult.message}
      routeResult={matchPublClientPath(queryString ? `${pathname}?${queryString}` : pathname)}
    />
  );
}

function toQueryString(params) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, entry));
    } else if (typeof value === 'string') {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
}
