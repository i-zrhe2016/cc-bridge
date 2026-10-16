import { internalUrl, WorkspaceError } from '@/server/ccr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Context { params: Promise<{ path: string[] }> }

function failure(status: number, message: string) {
  return Response.json({ type: 'error', error: { type: status === 401 ? 'authentication_error' : 'api_error', message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function forward(request: Request, context: Context) {
  const path = (await context.params).path.join('/');
  if (!((request.method === 'POST' && ['messages', 'messages/count_tokens'].includes(path)) || (request.method === 'GET' && path === 'models'))) {
    return failure(404, '接口不存在。');
  }
  // CCR authenticates its own client keys; never forward workspace cookies or management credentials.
  const headers = new Headers();
  for (const name of ['authorization', 'x-api-key', 'content-type', 'anthropic-version', 'anthropic-beta', 'user-agent', 'x-claude-code-session-id', 'x-claude-session-id']) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  if (!headers.has('authorization') && !headers.has('x-api-key')) {
    return failure(401, '请提供访问密钥。');
  }
  try {
    const destination = new URL(`/v1/${path}`, internalUrl('CCR_GATEWAY_URL'));
    destination.search = new URL(request.url).search;
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(600_000)]),
    };
    if (request.method === 'POST') {
      init.body = request.body;
      init.duplex = 'half';
    }
    const upstream = await fetch(destination, init);
    if (!upstream.ok) {
      await upstream.body?.cancel();
      const status = [400, 401, 403, 404, 413, 429].includes(upstream.status) ? upstream.status : 502;
      return failure(status, status === 401 || status === 403 ? '访问密钥无效、已停用或无权限。' : status === 429 ? '请求过于频繁或已达到用量限制。' : '模型请求未完成，请检查配置或稍后重试。');
    }
    const responseHeaders = new Headers({
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    // Pass successful JSON and SSE bytes through unchanged, including tools and thinking.
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  }
  catch (error) {
    return failure(error instanceof WorkspaceError ? error.status : 502, '模型服务暂时不可用，请稍后重试。');
  }
}

export const GET = forward;
export const POST = forward;
