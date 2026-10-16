import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { controlGateway, gatewayStatus, listKeys, listProviders, mutateKeys, mutateProviders, overview, usageStats } from '@/server/admin';
import { adminCookie, adminEnabled, validAdminSession } from '@/server/admin-auth';
import { WorkspaceError } from '@/server/ccr';
import { sameOrigin } from '@/server/workspace-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, context: { params: Promise<{ resource: string }> }, mutation: boolean) {
  try {
    if (!adminEnabled()) {
      throw new WorkspaceError(503, '管理后台尚未启用，请配置独立后台口令和 CCR 服务。');
    }
    if (!validAdminSession(request.cookies.get(adminCookie)?.value)) {
      throw new WorkspaceError(401, '请登录管理后台。');
    }
    if (mutation && !sameOrigin(request)) {
      throw new WorkspaceError(403, '请求来源不正确。');
    }
    const { resource } = await context.params;
    let result: unknown;
    if (mutation) {
      const body = await request.text();
      if (body.length > 32_768) {
        throw new WorkspaceError(413, '请求内容过大。');
      }
      let input: unknown;
      try {
        input = JSON.parse(body);
      }
      catch {
        throw new WorkspaceError(400, '请求格式不正确。');
      }
      switch (resource) {
        case 'providers': result = await mutateProviders(input);
          break;
        case 'keys': result = await mutateKeys(input);
          break;
        case 'gateway': result = await controlGateway(input);
          break;
        default: throw new WorkspaceError(404, '管理接口不存在。');
      }
    }
    else {
      switch (resource) {
        case 'overview': result = await overview();
          break;
        case 'providers': result = await listProviders();
          break;
        case 'keys': result = await listKeys();
          break;
        case 'gateway': result = await gatewayStatus();
          break;
        case 'usage': result = await usageStats(request.nextUrl.searchParams.get('range') || '7d', request.nextUrl.searchParams.get('provider') || undefined);
          break;
        default: throw new WorkspaceError(404, '管理接口不存在。');
      }
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }
  catch (error) {
    return NextResponse.json({ message: error instanceof WorkspaceError ? error.message : '管理服务暂时不可用，请稍后重试。' }, {
      status: error instanceof WorkspaceError ? error.status : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
export const GET = (request: NextRequest, context: { params: Promise<{ resource: string }> }) => handle(request, context, false);
export const POST = (request: NextRequest, context: { params: Promise<{ resource: string }> }) => handle(request, context, true);
