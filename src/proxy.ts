import type { NextFetchEvent, NextRequest } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return NextResponse.next();
  }
  return clerkMiddleware({ authorizedParties: [process.env.CC_BRIDGE_PUBLIC_URL!] })(request, event);
}

// Bridge API keys and independent operations auth never enter Clerk's bearer-token path.
export const config = { matcher: ['/dashboard/:path*', '/api/workspace/:path*', '/auth/:path*'] };
