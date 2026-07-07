'use client';

import { formatBuildInfoTitle, resolveBuildInfo } from '../../buildInfo.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/index.js';

export function BuildVersionBadge({ info = resolveBuildInfo() }) {
  const title = formatBuildInfoTitle(info);
  const details = formatBuildDetails(info);

  return (
    <Dialog>
      <DialogTrigger
        aria-label={`${title}. 자세히 보기`}
        asChild
        data-build-details={details}
      >
        <button className="build-version-badge" type="button">
          <span className="build-version-badge-version">v{info.version}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="build-version-dialog" size="small">
        <DialogHeader>
          <DialogTitle>버전 정보</DialogTitle>
          <DialogDescription>현재 실행 중인 클라이언트 빌드 정보입니다.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <dl className="build-version-dialog-list">
            <div className="build-version-dialog-row">
              <dt>Version</dt>
              <dd>v{info.version}</dd>
            </div>
            <div className="build-version-dialog-row">
              <dt>Build</dt>
              <dd>{info.shortSha}</dd>
            </div>
            {info.buildTime ? (
              <div className="build-version-dialog-row">
                <dt>Built</dt>
                <dd>{info.buildTime}</dd>
              </div>
            ) : null}
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function formatBuildDetails(info) {
  const parts = [`build ${info.shortSha}`];

  if (info.buildTime) {
    parts.push(`built ${info.buildTime}`);
  }

  return parts.join(', ');
}
