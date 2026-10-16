// Adapted from Kiranism components/layout/page-container.tsx (MIT).
import type { ReactNode } from 'react';

export default function PageContainer({ children, pageTitle, pageDescription, pageHeaderAction }: {
  children: ReactNode;
  pageTitle: string;
  pageDescription: string;
  pageHeaderAction?: ReactNode;
}) {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-6 md:px-6 md:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
        </div>
        {pageHeaderAction && <div className="flex shrink-0 gap-2">{pageHeaderAction}</div>}
      </div>
      {children}
    </main>
  );
}
