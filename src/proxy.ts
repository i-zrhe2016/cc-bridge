import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { isAuthConfigured } from '@/lib/auth-config';

const clerk = clerkMiddleware(async (auth) => {
  await auth.protect();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isApi = pathname === '/api' || pathname.startsWith('/api/');

  if (!isAuthConfigured()) {
    if (isDashboard) return NextResponse.redirect(new URL('/auth/sign-in', request.url));
    // Template demo APIs stay unavailable until backend authentication is configured.
    if (isApi)
      return NextResponse.json({ error: 'Authentication is not configured.' }, { status: 503 });
    return NextResponse.next();
  }
  // Public pages do not initialize Clerk or depend on its network services.
  if (!isDashboard && !isApi) return NextResponse.next();
  return clerk(request, event);
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
};
