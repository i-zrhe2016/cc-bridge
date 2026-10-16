'use client';

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminRequest } from './client';

export default function AdminLogin({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await adminRequest('session', { token });
      setToken('');
      window.location.replace('/admin');
    }
    catch (error) {
      setToken('');
      setError(error instanceof Error ? error.message : '登录失败。');
    }
    finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <div className="admin-login-brand">
        CC
        <span>↗</span>
      </div>
      <h1>管理后台</h1>
      <p className="admin-muted">CC Bridge · 管理连接、访问密钥与网关</p>
      <form onSubmit={submit} className="admin-card admin-form">
        {enabled
          ? (
              <>
                <label htmlFor="operations-token">后台管理口令</label>
                <input id="operations-token" type="password" autoComplete="current-password" required value={token} onChange={event => setToken(event.target.value)} />
                <p className="admin-muted">使用独立的后台口令登录，会话有效期为 8 小时。</p>
                <Button disabled={busy} type="submit">{busy ? '正在登录…' : '登录管理后台'}</Button>
              </>
            )
          : <p role="status">管理后台尚未启用，请联系服务器管理员配置独立后台口令和 CCR 服务。</p>}
        {error && <p role="alert" className="admin-error">{error}</p>}
      </form>
      <Link href="/" className="admin-muted">返回官网 ↗</Link>
    </main>
  );
}
