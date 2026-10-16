'use client';

import type { FormEvent } from 'react';
import type { WorkspaceSnapshot } from './contracts';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Workspace from './workspace';
import './workspace.css';

export default function LiveWorkspace() {
  const [initial, setInitial] = useState<WorkspaceSnapshot | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/workspace', { cache: 'no-store' });
    if (response.status === 401) {
      return;
    }
    const value = await response.json();
    if (!response.ok) {
      throw new Error(value.message || '工作台暂时不可用。');
    }
    setInitial(value);
  }

  useEffect(() => {
    void load().catch(error => setError(error.message)).finally(() => setChecking(false));
  }, []);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/workspace/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setToken('');
      if (!response.ok) {
        const value = await response.json();
        throw new Error(value.message || '无法进入工作台。');
      }
      await load();
    }
    catch (error) {
      setError(error instanceof Error ? error.message : '无法进入工作台。');
    }
    finally {
      setBusy(false);
    }
  }

  if (initial) {
    return (
      <Workspace
        initial={initial}
        onSignOut={async () => {
          const response = await fetch('/api/workspace/session', { method: 'DELETE' });
          if (response.ok) {
            setInitial(null);
          }
        }}
      />
    );
  }

  return (
    <main className="mx-auto mt-24 max-w-md px-6">
      <h1 className="text-2xl font-semibold">CC Bridge 工作台</h1>
      {checking
        ? <p role="status" className="mt-4">正在加载…</p>
        : (
            <form onSubmit={unlock} className="workspace-card mt-6">
              <p className="mb-4">输入管理口令，管理 GPT 连接和访问密钥。</p>
              <label htmlFor="workspace-token">管理口令</label>
              <input id="workspace-token" type="password" autoComplete="current-password" value={token} onChange={event => setToken(event.target.value)} required />
              {error && <p role="alert" className="form-error">{error}</p>}
              <Button type="submit" disabled={busy} className="mt-4">{busy ? '正在进入…' : '进入工作台'}</Button>
            </form>
          )}
    </main>
  );
}
