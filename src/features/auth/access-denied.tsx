'use client';

import { SignOutButton } from '@clerk/nextjs';

export default function AccessDenied() {
  return (
    <main className="mx-auto mt-24 max-w-md space-y-6 px-6">
      <h1>无法访问工作台</h1>
      <p role="alert">当前登录账号无法关联已验证的 Google 身份。请退出后使用 Google 重新登录；若仍然失败，请联系管理员。</p>
      <SignOutButton redirectUrl="/auth/sign-in">
        <button type="button" className="rounded-md border px-4 py-2">退出当前账号</button>
      </SignOutButton>
    </main>
  );
}
