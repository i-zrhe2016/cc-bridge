import Link from 'next/link';
import { CCBridgeLogo } from '@/components/brand/cc-bridge-logo';
import { CenteredContainer } from './CenteredContainer';
import GoogleContinueButton from './google-continue-button';

export default function SignInViewPage({ enabled, failed }: { enabled: boolean; failed: boolean }) {
  return (
    <main className="auth-page bg-muted/30">
      <CenteredContainer>
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <CCBridgeLogo />
          <section aria-labelledby="sign-in-title" className="w-full rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
            <div className="mb-8 text-center">
              <h1 id="sign-in-title" className="text-2xl font-semibold tracking-tight">欢迎使用 CC Bridge</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">登录或注册，继续你的开发之旅。</p>
            </div>
            <GoogleContinueButton enabled={enabled} failed={failed} />
          </section>
          <Link href="/" className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">← 返回首页</Link>
          <p className="text-center text-xs text-muted-foreground">CC Bridge · 让 Claude Code 使用 GPT。</p>
        </div>
      </CenteredContainer>
    </main>
  );
}
