import type { Metadata } from 'next';
import LiveWorkspace from '@/features/workspace/live-workspace';
import Workspace from '@/features/workspace/workspace';
import { liveWorkspaceEnabled } from '@/server/workspace-auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '用户工作台', robots: { index: false, follow: false } };

export default function DashboardPage() {
  return liveWorkspaceEnabled() ? <LiveWorkspace /> : <Workspace />;
}
