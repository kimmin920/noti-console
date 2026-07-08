import { SignIn } from '@clerk/nextjs';

import { AuthPageShell, clerkAuthAppearance } from './AuthPageShell.jsx';
import { redirectSignedInUser } from './redirectSignedInUser.js';

export const metadata = {
  title: 'NOTI 로그인',
  description: 'NOTI에 로그인합니다.',
};

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const consoleHref = params?.mode === 'embed' ? '/message-send?mode=embed' : '/message-send';
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
