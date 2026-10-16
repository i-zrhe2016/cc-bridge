import Link from 'next/link';
import { cn } from '@/utils/Helpers';

export function CCBridgeLogo({ className, prefetch }: { className?: string; prefetch?: boolean }) {
  return (
    <Link
      href="/"
      prefetch={prefetch}
      aria-label="CC Bridge 首页"
      className={cn(
        'inline-flex w-fit items-center gap-2.5 rounded-sm text-[22px] font-semibold tracking-[-0.8px] focus-visible:outline-2 focus-visible:outline-offset-4',
        className,
      )}
    >
      <span aria-hidden="true" className="flex h-7 w-7 -skew-y-[18deg] items-center gap-1">
        <span className="h-6 w-1.5 bg-current" />
        <span className="h-4 w-1.5 bg-current" />
        <span className="h-6 w-1.5 bg-current" />
      </span>
      <span>
        CC Bridge
        <span className="font-normal text-neutral-400">.</span>
      </span>
    </Link>
  );
}
