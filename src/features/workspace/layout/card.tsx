// Adapted from Apptension SaaS Boilerplate webapp-core/components/ui/card.tsx.
// React 19 ref-as-prop adaptation; see docs/template-source.md and Apptension-MIT.txt.
import type { ComponentProps } from 'react';
import { cn } from '@/utils/Helpers';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('bg-card text-card-foreground rounded-lg border shadow-sm', className)} {...props} />;
}
