import { NextResponse } from 'next/server';
import { adminCookie, adminEnabled, adminSessionSeconds, createAdminSession, verifyOperationsToken } from '@/server/admin-auth';
import { sameOrigin } from '@/server/workspace-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!adminEnabled()) {
    return NextResponse.json({ message: '管理后台尚未启用。' }, { status: 503 });
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ message: '请求来源不正确。' }, { status: 403 });
  }
  try {
    const body = await request.text();
    const input = body.length <= 4096 ? JSON.parse(body) : null;
    if (typeof input?.token !== 'string' || !verifyOperationsToken(input.token)) {
      return NextResponse.json({ message: '后台管理口令不正确。' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(adminCookie, createAdminSession(), {
      httpOnly: true,
      sameSite: 'strict',
      secure: new URL(process.env.CC_BRIDGE_PUBLIC_URL || request.url).protocol === 'https:',
      path: '/',
      maxAge: adminSessionSeconds,
    });
    return response;
  }
  catch {
    return NextResponse.json({ message: '请求格式不正确。' }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ message: '请求来源不正确。' }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(adminCookie, '', { path: '/', maxAge: 0 });
  return response;
}
