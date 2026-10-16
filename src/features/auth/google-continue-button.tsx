'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function GoogleContinueButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef(false);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function continueWithGoogle() {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setStatus('loading');
    // A local UI demonstration only: no SDK, request, account or session.
    timerRef.current = setTimeout(() => {
      pendingRef.current = false;
      setStatus('success');
    }, 800);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-3"
        disabled={status === 'loading'}
        aria-busy={status === 'loading'}
        aria-describedby="google-note google-status"
        onClick={continueWithGoogle}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z" />
          <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z" />
        </svg>
        {status === 'loading' ? '正在模拟登录…' : '使用 Google 继续'}
      </Button>
      <p id="google-note" className="mt-4 text-center text-xs leading-6 text-muted-foreground">
        登录与注册共用一个入口，首次使用将自动注册。
        <br />
        当前为本地交互演示，不会连接 Google。
      </p>
      <div id="google-status" role="status" aria-live="polite" aria-atomic="true" className="mt-5 min-h-20 text-center text-xs leading-6">
        {status === 'loading' && <p>正在模拟 Google 登录，请稍候…</p>}
        {status === 'success' && (
          <p className="rounded-md border bg-muted/50 p-3">
            模拟登录成功；首次使用将自动注册。本演示未创建账号或登录会话。
          </p>
        )}
      </div>
    </>
  );
}
