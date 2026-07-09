import { SignIn } from '@clerk/nextjs';

import { AuthPageShell, clerkAuthAppearance } from '../../AuthPageShell.jsx';
import { redirectSignedInUser } from '../../redirectSignedInUser.js';

export const metadata = {
  title: '로그인 - NOTI',
  description: 'NOTI에 로그인합니다.',
};

export default async function SignInPage() {
  await redirectSignedInUser('/message-send');

  return (
    <AuthPageShell>
      <SignIn
        appearance={clerkAuthAppearance}
        fallbackRedirectUrl="/message-send"
        forceRedirectUrl="/message-send"
        path="/sign-in"
        routing="path"
        signUpFallbackRedirectUrl="/message-send"
        signUpUrl="/sign-up"
      />
    </AuthPageShell>
  );
}
