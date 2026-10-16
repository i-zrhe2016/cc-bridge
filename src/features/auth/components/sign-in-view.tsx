import Link from 'next/link';
import { CCBridgeLogo } from '@/components/brand/cc-bridge-logo';
import { Icons } from '@/components/icons';
import GoogleContinueButton from './google-continue-button';

export default function SignInViewPage() {
  return (
    <main className='auth-page grid min-h-svh bg-white text-neutral-900 lg:grid-cols-2'>
      <aside
        aria-label='关于 CC Bridge'
        className='hidden flex-col justify-between border-r border-neutral-200 bg-[#f6f6f4] p-10 lg:flex xl:p-14'
      >
        <CCBridgeLogo />
        <div className='mx-auto w-full max-w-[460px] py-16'>
          <p className='mb-6 font-mono text-[10px] tracking-[0.2em] text-neutral-500'>
            YOUR TOOLS. MORE POSSIBILITIES.
          </p>
          <h2 className='text-[clamp(32px,3.2vw,48px)] leading-[1.4] font-medium tracking-[-1.5px]'>
            熟悉的 Claude Code，
            <br />
            <span className='text-neutral-500'>更多模型的可能。</span>
          </h2>
          <p className='mt-6 text-sm leading-7 text-neutral-500'>
            通过 CC Bridge，将 GPT 接入你的开发工作流。
            <br />
            继续在熟悉的终端里，专注于创造。
          </p>
          <div className='mt-12 rounded-lg border border-neutral-200 bg-white/80 px-5 py-7'>
            <div className='mb-6 flex items-center gap-1.5' aria-hidden='true'>
              <span className='size-1.5 rounded-full bg-neutral-300' />
              <span className='size-1.5 rounded-full bg-neutral-300' />
              <span className='size-1.5 rounded-full bg-neutral-300' />
              <span className='ml-2 font-mono text-[9px] tracking-wider text-neutral-400'>
                CC BRIDGE / CONNECT
              </span>
            </div>
            <ol
              aria-label='Claude Code 通过 CC Bridge 连接 GPT'
              className='flex items-center justify-between gap-2 text-center font-mono text-[11px] xl:text-xs'
            >
              <li className='flex-1 py-3'>Claude Code</li>
              <li aria-hidden='true' className='text-neutral-400'>
                →
              </li>
              <li className='flex-1 rounded-md bg-neutral-900 px-2 py-3 text-white'>CC Bridge</li>
              <li aria-hidden='true' className='text-neutral-400'>
                →
              </li>
              <li className='flex-1 py-3'>GPT</li>
            </ol>
            <p className='mt-5 text-center text-[10px] tracking-wide text-neutral-500'>
              一个网关，连接工具与模型。
            </p>
          </div>
        </div>
        <p className='text-[11px] text-neutral-500'>LESS FRICTION. MORE BUILDING.</p>
      </aside>

      <section
        aria-labelledby='sign-in-title'
        className='flex min-h-svh flex-col px-6 py-7 sm:px-10 lg:px-12 lg:py-10 xl:px-14 xl:py-14'
      >
        <header className='flex items-center justify-between gap-4 lg:justify-end'>
          <CCBridgeLogo className='text-lg lg:hidden' />
          <Link
            href='/'
            className='inline-flex shrink-0 items-center gap-1.5 rounded-sm text-xs text-neutral-500 transition-colors hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4'
          >
            <Icons.chevronLeft aria-hidden='true' className='size-3.5' />
            返回首页
          </Link>
        </header>
        <div className='mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-16'>
          <div
            className='mb-8 flex size-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50'
            aria-hidden='true'
          >
            <Icons.login className='size-5 text-neutral-700' />
          </div>
          <p className='mb-3 font-mono text-[10px] tracking-[0.18em] text-neutral-500'>
            LET’S GET STARTED
          </p>
          <h1
            id='sign-in-title'
            className='text-[28px] leading-[1.4] font-semibold tracking-[-0.8px] sm:text-[30px]'
          >
            欢迎使用 CC Bridge
          </h1>
          <p className='mt-3 mb-9 text-sm leading-7 text-neutral-500'>
            登录账号，继续你的开发之旅。
          </p>
          <GoogleContinueButton />
        </div>
        <footer className='text-center text-[10px] leading-5 text-neutral-500'>
          CC Bridge · 让 Claude Code 使用 GPT。
        </footer>
      </section>
    </main>
  );
}
