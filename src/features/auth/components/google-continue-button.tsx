'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function GoogleContinueButton() {
  const [message, setMessage] = useState('');

  // Future Google OAuth integration belongs here. No session is created in this release.
  function handleGoogleContinue() {
    setMessage('Google 登录即将开放，请稍后再试。');
  }

  return (
    <>
      <Button
        type='button'
        variant='outline'
        className='h-12 w-full gap-3 rounded-md border-neutral-300 bg-white text-[14px] text-neutral-900 shadow-none hover:bg-neutral-50 focus-visible:ring-neutral-500/40'
        onClick={handleGoogleContinue}
        aria-describedby='google-sign-in-note google-sign-in-status'
      >
        <Icons.googleColor aria-hidden='true' className='size-[18px]' />
        使用 Google 继续
      </Button>
      <p id='google-sign-in-note' className='mt-5 text-center text-xs leading-6 text-neutral-500'>
        首次使用 Google 登录时，将自动创建账号。
      </p>
      <div
        id='google-sign-in-status'
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='mt-5 min-h-14 text-center text-xs leading-6 text-neutral-600'
      >
        {message && (
          <p className='rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2'>{message}</p>
        )}
      </div>
    </>
  );
}
