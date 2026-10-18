import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AccessDenied from '@/features/auth/access-denied';
import SignInViewPage from '@/features/auth/sign-in-view';
import { authConfigured, userSession } from '@/server/auth';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await userSession(await headers())) {
    redirect('/dashboard');
  }
  if (authConfigured() && (await auth({ acceptsToken: 'session_token' })).isAuthenticated) {
    return <AccessDenied />;
  }
  return <SignInViewPage enabled={authConfigured()} failed={Boolean((await searchParams).error)} />;
}
