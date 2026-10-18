'use client';

import { SignIn } from '@clerk/nextjs';

export default function GoogleContinueButton({ enabled, failed }: { enabled: boolean; failed: boolean }) {
  return (
    <>
      {enabled
        ? <SignIn routing="path" path="/auth/sign-in" withSignUp forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" appearance={{ elements: { rootBox: { width: '100%' }, cardBox: { width: '100%' } } }} />
        : (
            <>
              <button type="button" disabled className="h-12 w-full rounded-md border">使用 Google 继续</button>
              <p role="status" className="mt-4 text-center text-sm">Google 登录尚未配置，请联系管理员。</p>
            </>
          )}
      <p className="mt-4 text-center text-xs leading-6 text-muted-foreground">登录与注册共用一个入口，首次使用将自动注册。</p>
      {failed && <p role="alert">Google 登录未完成，请重试。</p>}
    </>
  );
}
