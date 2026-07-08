import { SignUp } from '@clerk/nextjs';

import { AuthPageShell, clerkAuthAppearance } from '../../AuthPageShell.jsx';
import { redirectSignedInUser } from '../../redirectSignedInUser.js';

export const metadata = {
  title: '회원가입 - NOTI',
  description: 'NOTI 메시징 콘솔을 시작합니다.',
};

export default async function SignUpPage() {
  await redirectSignedInUser('/message-send');

  return (
    <AuthPageShell>
      <SignUp
        appearance={clerkAuthAppearance}
        fallbackRedirectUrl="/message-send"
        forceRedirectUrl="/message-send"
        path="/sign-up"
        routing="path"
        signInFallbackRedirectUrl="/message-send"
        signInUrl="/sign-in"
      />
    </AuthPageShell>
  );
}
