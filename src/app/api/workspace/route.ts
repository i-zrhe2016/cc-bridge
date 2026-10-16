import type { NextRequest } from 'next/server';
import type { WorkspaceAction } from '@/features/workspace/contracts';
import { NextResponse } from 'next/server';
import { mutate, snapshot, WorkspaceError } from '@/server/ccr';
import { liveWorkspaceEnabled, sameOrigin, sessionCookie, validSession } from '@/server/workspace-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, mutation: boolean) {
  try {
    if (!liveWorkspaceEnabled()) {
      throw new WorkspaceError(503, '工作台尚未启用。');
    }
    if (!validSession(request.cookies.get(sessionCookie)?.value)) {
      throw new WorkspaceError(401, '请使用管理口令进入工作台。');
    }
    if (mutation && !sameOrigin(request)) {
      throw new WorkspaceError(403, '请求来源不正确。');
    }
    let value;
    if (mutation) {
      const text = await request.text();
      if (text.length > 16_384) {
        throw new WorkspaceError(413, '请求内容过大。');
      }
      let input;
      try {
        input = JSON.parse(text);
      }
      catch {
        throw new WorkspaceError(400, '请求格式不正确。');
      }
      if (!input || !['save', 'delete', 'rotate', 'revoke'].includes(input.action)) {
        throw new WorkspaceError(400, '不支持的操作。');
      }
      value = await mutate(input as WorkspaceAction);
    }
    else {
      value = await snapshot();
    }
    return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } });
  }
  catch (error) {
    return NextResponse.json({ message: error instanceof WorkspaceError ? error.message : '工作台暂时不可用，请稍后重试。' }, {
      status: error instanceof WorkspaceError ? error.status : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export const GET = (request: NextRequest) => handle(request, false);
export const POST = (request: NextRequest) => handle(request, true);
