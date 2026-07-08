import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export async function redirectSignedInUser(href) {
  const { userId } = await auth();

  if (userId) {
    redirect(href);
  }
}
