import { formatBuildInfoTitle, resolveBuildInfo } from '../../buildInfo.js';

export function BuildVersionBadge({ info = resolveBuildInfo() }) {
  const title = formatBuildInfoTitle(info);
  const details = formatBuildDetails(info);

  return (
    <div aria-label={title} className="build-version-badge" data-build-details={details}>
      <span className="build-version-badge-version">v{info.version}</span>
    </div>
  );
}

function formatBuildDetails(info) {
  const parts = [`build ${info.shortSha}`];

  if (info.buildTime) {
    parts.push(`built ${info.buildTime}`);
  }

  return parts.join(', ');
}
