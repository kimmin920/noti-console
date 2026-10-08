import { SignIn } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';

import { LandingPage } from '../components/landing/LandingPage.jsx';
import { AuthPageShell, clerkAuthAppearance } from './AuthPageShell.jsx';
import { redirectSignedInUser } from './redirectSignedInUser.js';

export const metadata = {
  title: 'noti — 비즈니스를 위한 차세대 올인원 메시징 & 알림 자동화 플랫폼',
  description: 'SMS, LMS, 카카오 알림톡, 브랜드 메시지부터 웹훅 이벤트 자동화까지. 단 하나의 API와 고밀도 엔지니어링 콘솔로 운영하는 B2B 메시징 플랫폼. Built with Claude.',
  keywords: [
    'noti',
    '비즈니스 메시징',
    '카카오 알림톡',
    'SMS API',
    'LMS',
    '알림 자동화',
    'Built with Claude',
    'VIZUO',
    '비주오',
    'MessageOps',
  ],
  openGraph: {
    title: 'noti — 차세대 올인원 메시징 & 알림 자동화 플랫폼',
    description: 'SMS, 알림톡, 이벤트 기반 자동 발송을 한곳에서. 팀용 메시징 운영 플랫폼. Built by VIZUO.',
    url: 'https://home.vizuo.work',
    siteName: 'noti',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default async function HomePage({ searchParams }) {
  const params = await searchParams;

  // 임베드(iframe) 모드인 경우 기존 임베드 인증 셸 동작 유지
  if (params?.mode === 'embed') {
    const consoleHref = '/message-send?mode=embed';
    await redirectSignedInUser(consoleHref);

    return (
      <AuthPageShell>
        <SignIn
          appearance={clerkAuthAppearance}
          fallbackRedirectUrl={consoleHref}
          forceRedirectUrl={consoleHref}
          routing="virtual"
          signUpFallbackRedirectUrl={consoleHref}
          signUpUrl="/sign-up"
        />
      </AuthPageShell>
    );
  }

  let isSignedIn = false;
  try {
    const authSession = await auth();
    isSignedIn = Boolean(authSession?.userId);
  } catch {
    isSignedIn = false;
  }

  return <LandingPage isSignedIn={isSignedIn} />;
}
