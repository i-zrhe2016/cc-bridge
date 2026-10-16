import { NextResponse } from 'next/server';
import { createSession, liveWorkspaceEnabled, sameOrigin, sessionCookie, sessionSeconds, verifyAdminToken } from '@/server/workspace-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!liveWorkspaceEnabled()) {
    return NextResponse.json({ message: '工作台尚未启用。' }, { status: 503 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ message: '请求来源不正确。' }, { status: 403 });
  }
  try {
    const body = await request.text();
    const input = body.length <= 4096 ? JSON.parse(body) : null;
    if (typeof input?.token !== 'string' || !verifyAdminToken(input.token)) {
      return NextResponse.json({ message: '访问口令不正确。' }, { status: 401 });
    }
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(sessionCookie, createSession(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: new URL(process.env.CC_BRIDGE_PUBLIC_URL || request.url).protocol === 'https:',
      path: '/api/workspace',
      maxAge: sessionSeconds,
    });
    return response;
  }
  catch {
    return NextResponse.json({ message: '工作台配置不可用或请求格式错误。' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ message: '请求来源不正确。' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, '', { path: '/api/workspace', maxAge: 0 });
  return response;
}
