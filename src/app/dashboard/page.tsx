import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AccessDenied from '@/features/auth/access-denied';
import LiveWorkspace from '@/features/workspace/live-workspace';
import { authConfigured, userSession } from '@/server/auth';
import { liveWorkspaceEnabled } from '@/server/workspace-auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '用户工作台', robots: { index: false, follow: false } };

export default async function DashboardPage() {
  if (!authConfigured()) {
    return (
      <main className="mx-auto mt-24 max-w-md px-6">
        <h1>CC Bridge 工作台</h1>
        <p role="alert">Google 登录尚未配置，请联系管理员。</p>
      </main>
    );
  }
  const session = await userSession(await headers());
  if (!session) {
    if ((await auth({ acceptsToken: 'session_token' })).isAuthenticated) {
      return <AccessDenied />;
    }
    redirect('/auth/sign-in');
  }
  if (!liveWorkspaceEnabled()) {
    return (
      <main className="mx-auto mt-24 max-w-md px-6">
        <h1>CC Bridge 工作台</h1>
        <p role="alert">工作台服务尚未配置，请联系管理员。</p>
      </main>
    );
  }
  return <LiveWorkspace user={{ name: session.user.name, email: session.user.email }} />;
}
