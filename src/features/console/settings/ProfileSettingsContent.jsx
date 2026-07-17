'use client';

import { useMemo } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { Button } from '../../../components/ui/index.js';

export function ProfileSettingsContent() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const profile = useMemo(() => getProfileViewModel(user), [user]);

  if (!isLoaded) {
    return <div className="profile-state">프로필을 불러오는 중입니다.</div>;
  }

  if (!isSignedIn || !user) {
    return <div className="profile-state">로그인하면 프로필을 관리할 수 있습니다.</div>;
  }

  return (
    <div className="profile-stack">
      <section className="profile-card profile-overview-card" aria-labelledby="profile-overview-title">
        <div className="profile-card-heading">
          <h2 className="profile-section-title" id="profile-overview-title">내 프로필</h2>
        </div>
        <div className="profile-overview-body">
          <div className="profile-identity">
            <span className="profile-avatar" aria-hidden="true">
              {user.imageUrl ? (
                <Image alt="" height={48} src={user.imageUrl} unoptimized width={48} />
              ) : profile.initial}
            </span>
            <span className="profile-identity-copy">
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
            </span>
          </div>
          <div className="profile-field-grid">
            <ProfileField label="이름" value={profile.name} />
            <ProfileField label="이메일 주소" value={profile.email} />
            <ProfileField label="전화번호" value={profile.phone} />
            <ProfileField label="가입일" value={profile.createdAt} />
          </div>
        </div>
        <div className="profile-card-actions">
          <Button onClick={() => clerk.openUserProfile()} variant="secondary">계정 정보 관리</Button>
        </div>
      </section>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="profile-field-wrap">
      <span className="profile-label">{label}</span>
      <span className="profile-field-value">{value}</span>
    </div>
  );
}

function getProfileViewModel(user) {
  const email = user?.primaryEmailAddress?.emailAddress
    ?? user?.emailAddresses?.[0]?.emailAddress
    ?? '이메일 정보 없음';
  const name = user?.fullName?.trim()
    || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || (email.includes('@') ? email.split('@')[0] : '사용자');

  return {
    createdAt: formatDate(user?.createdAt),
    email,
    initial: name.charAt(0).toUpperCase() || '?',
    name,
    phone: user?.primaryPhoneNumber?.phoneNumber
      ?? user?.phoneNumbers?.[0]?.phoneNumber
      ?? '등록된 전화번호 없음',
  };
}

function formatDate(value) {
  if (!value) return '정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
