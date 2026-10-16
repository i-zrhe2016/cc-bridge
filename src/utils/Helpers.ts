import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// SaaS-Boilerplate's class helper; service and locale URL helpers are omitted.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
