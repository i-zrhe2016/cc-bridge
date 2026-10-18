'use client';

import type { WorkspaceSnapshot } from './contracts';
import { useClerk } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { workspaceRequest } from './contracts';
import Workspace from './workspace';
import './workspace.css';

export default function LiveWorkspace({ user }: { user: { name: string; email: string } }) {
  const clerk = useClerk();
  const [initial, setInitial] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setInitial(await workspaceRequest());
    }
    catch (error) {
      setError(error instanceof Error ? error.message : '工作台暂不可用。');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function signOut() {
    try {
      await clerk.signOut({ redirectUrl: '/auth/sign-in' });
    }
    catch {
      setError('退出失败，请重试。');
    }
  }

  return (
    <>
      <div className="relative z-50 flex flex-wrap items-center justify-end gap-3 border-b bg-background px-6 py-2 text-sm">
        <span>
          {user.name}
          {' '}
          ·
          {' '}
          {user.email}
        </span>
        <Button variant="ghost" onClick={() => void signOut()}>退出登录</Button>
      </div>
      {error && <p role="alert" className="relative z-50 bg-background p-4">{error}</p>}
      {initial
        ? <Workspace initial={initial} onSignOut={signOut} />
        : (
            <main className="mx-auto mt-24 max-w-md px-6">
              {error ? <Button onClick={() => void load()}>重试</Button> : <p role="status">正在加载…</p>}
            </main>
          )}
    </>
  );
}
