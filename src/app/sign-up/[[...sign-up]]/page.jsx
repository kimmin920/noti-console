import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main style={authPageStyle}>
      <SignUp />
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
