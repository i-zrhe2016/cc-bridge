// Retired Better Auth endpoints cannot create or authenticate sessions.
export function GET() {
  return Response.json({ message: 'Authentication is managed by Clerk. Use /auth/sign-in.' }, { status: 410 });
}
export const POST = GET;
