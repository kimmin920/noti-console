import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main style={authPageStyle}>
      <SignIn />
    </main>
  );
}

const authPageStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '32px 16px',
  background: '#f7f7f8',
};
